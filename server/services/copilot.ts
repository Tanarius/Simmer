import Anthropic from '@anthropic-ai/sdk';
import { storage } from '../storage';
import { buildHouseholdTasteProfile } from './tasteProfile';
import { searchRecipeImage } from './spoonacular';
import { CopilotMessage, ProposedAction } from '../types/ai';

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
}) : null;

export async function chatWithCopilot(
  userId: number, 
  sessionId: string, 
  userMessageContent: string
): Promise<CopilotMessage> {
  if (!anthropic) {
    throw new Error('Anthropic API key is not configured.');
  }

  // 1. Fetch complete state context
  const tasteProfile = await buildHouseholdTasteProfile(userId);
  const userProfile = await storage.getUserTasteProfile(userId);
  const pantryStaples = await storage.getPantryStaples();
  const recipes = await storage.getRecipes(); // household recipes

  // Format summaries to save tokens
  const pantryString = pantryStaples.map(s => s.name).join(', ');
  const recipeSummaries = recipes.map(r => `- ${r.name} (${r.cuisineType || r.cuisine}, ${r.difficulty})`).join('\n');
  const tasteString = JSON.stringify(tasteProfile, null, 2);

  // Format ingredient avoidances & substitutions
  const subs = (userProfile?.ingredientSubstitutions as Record<string, string | null>) || {};
  const avoided = userProfile?.dislikedIngredients || [];
  const avoidanceLines = avoided.map(ing => {
    const sub = subs[ing];
    return sub ? `- Avoid ${ing} → substitute with ${sub}` : `- Avoid ${ing}`;
  }).join('\n');

  // 2. Fetch recent conversation history
  const history = await storage.getCopilotHistory(userId, sessionId, 10);
  const recentHistory = history.reverse();

  // 3. Construct system prompt
  const systemPrompt = `You are the MealPrep Kitchen Copilot, an expert culinary assistant deeply integrated into the user's digital kitchen.

CURRENT STATE:
User's Household Taste Profile:
${tasteString}

User's Saved Recipe Library:
${recipeSummaries}

User's Current Pantry Staples:
${pantryString}
${avoidanceLines ? `\nIngredient Avoidances & Substitutions (CRITICAL — always follow these):\n${avoidanceLines}` : ''}

YOUR ROLE:
You help the user figure out what to cook, generate recipes, add items to their weekly plan, and modify their shopping list.
You MUST prioritize their Taste Profile! If they ask for a suggestion, suggest recipes from their Saved Recipe Library FIRST if they have the pantry staples for them.
CRITICAL: Never use avoided ingredients in recipes. If an ingredient has a substitute listed, use the substitute instead. Do not mention the original avoided ingredient in the recipe at all.

IMPORTANT RULE:
You are not allowed to directly modify the database. If you decide the user wants to take an action (saving a recipe, adding to plan, updating shopping list), you MUST use a Tool.
Your tools do NOT execute the action directly; they propose the action to the user as a UI card. You should narrate what you are proposing like: "I found a great Stir Fry recipe! I've attached it below, let me know if you want me to save it." and then invoke the tool.

If you use a tool, return ONLY ONE TOOL INVOCATION per message. Do not chain multiple tools.`;

  // 4. Construct Anthropic Message History
  const messages: Anthropic.MessageParam[] = recentHistory.map(msg => {
    // If the assistant previously proposed a tool, we don't have perfect serialization for Anthropic's strict tool roles
    // We will just represent it as text for the context window so Claude remembers its suggestions
    let content = msg.content;
    if (msg.role === 'assistant' && msg.proposedAction) {
      const action = typeof msg.proposedAction === 'string' ? JSON.parse(msg.proposedAction) : msg.proposedAction;
      content += `\n[System note: You previously proposed the action ${action?.toolName} which the user either applied or dismissed]`;
    }
    return {
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: content
    };
  });

  // Append current message
  messages.push({ role: 'user', content: userMessageContent });

  // 5. Tool Definitions
  const tools: Anthropic.Tool[] = [
    {
      name: "save_new_recipe",
      description: "Proposes to save a recipe to the user's Recipe Library. Provide full, accurate recipe details. The system will automatically find a real photo and source link for this dish.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string", description: "One sentence description of the dish." },
          cuisine: { type: "string", enum: ["tex-mex", "italian", "asian", "american", "indian", "other"] },
          mealType: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          servings: { type: "number" },
          prepTime: { type: "number", description: "Prep time in minutes" },
          cookTime: { type: "number", description: "Cook time in minutes" },
          ingredients: {
            type: "array",
            items: { type: "string" },
            description: "Ingredient list. Each item must start with quantity and unit, e.g. '2 pounds chicken breasts', '3 cloves garlic minced'."
          },
          instructions: {
            type: "array",
            items: { type: "string" },
            description: "Ordered list of instruction steps. Each step is one sentence."
          },
          tip: { type: "string", description: "One practical chef's tip or pro note that makes this dish noticeably better." },
          servingSuggestion: { type: "string", description: "One sentence on how to serve or plate this dish." },
        },
        required: ["name", "cuisine", "ingredients", "instructions", "servings", "prepTime", "cookTime", "difficulty", "mealType"]
      }
    },
    {
      name: "add_to_weekly_plan",
      description: "Proposes to schedule a recipe in the user's weekly plan.",
      input_schema: {
        type: "object",
        properties: {
          weekStart: { type: "string", description: "ISO date string" },
          dayOfWeek: { type: "string", enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] },
          mealType: { type: "string", enum: ["breakfast", "lunch", "dinner"] },
          recipeName: { type: "string" }
        },
        required: ["weekStart", "dayOfWeek", "mealType", "recipeName"]
      }
    },
    {
      name: "add_to_shopping_list",
      description: "Proposes to add missing ingredients to the user's shopping list.",
      input_schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["items"]
      }
    }
  ];

  // 6. Execute Call
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: systemPrompt,
    messages: messages,
    tools: tools,
    tool_choice: { type: "auto" }
  });

  // 7. Parse Response
  let replyText = "";
  let proposedAction: ProposedAction | null = null;

  for (const block of response.content) {
    if (block.type === 'text') {
      replyText += block.text;
    } else if (block.type === 'tool_use') {
      let displayText = "Proposed Action";
      let parameters = block.input as Record<string, unknown>;

      if (block.name === 'save_new_recipe') {
        const p = block.input as any;
        displayText = `Save new recipe: ${p.name} (${p.cuisine})`;

        // Look up a REAL image + source URL using Spoonacular/TheMealDB
        // This replaces any AI-hallucinated sourceUrl with a verified one
        try {
          const imageResult = await searchRecipeImage(p.name);
          parameters = {
            ...parameters,
            resolvedImageUrl: imageResult.imageUrl,
            resolvedSourceUrl: imageResult.sourceUrl,
            // Override any AI-generated sourceUrl with the verified one
            sourceUrl: imageResult.sourceUrl,
          };
        } catch {
          // Fail silently — card will show emoji fallback
        }
      } else if (block.name === 'add_to_weekly_plan') {
        const p = block.input as any;
        displayText = `Add ${p.recipeName} to ${p.dayOfWeek} ${p.mealType}`;
      } else if (block.name === 'add_to_shopping_list') {
        const p = block.input as any;
        displayText = `Add ${p.items?.length || 0} items to shopping list`;
      }

      proposedAction = {
        toolName: block.name as ProposedAction['toolName'],
        parameters,
        displayText,
        status: 'pending'
      };
    }
  }

  const finalMessage: CopilotMessage = {
    role: 'assistant',
    content: replyText.trim() || "[No text provided]",
    timestamp: new Date().toISOString(),
    proposedAction
  };

  // 8. Log message history to DB
  await storage.saveCopilotMessage(userId, sessionId, { role: 'user', content: userMessageContent });
  const savedId = await storage.saveCopilotMessage(userId, sessionId, finalMessage);
  finalMessage.id = savedId;

  return finalMessage;
}

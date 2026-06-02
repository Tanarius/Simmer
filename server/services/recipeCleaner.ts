import Anthropic from '@anthropic-ai/sdk';
import { RawRecipe, CleanedRecipe } from '../types/ai';

// Initialize anthropic client only if key is available
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
}) : null;

const PLACEHOLDER_RE = [
  /full\s*(recipe\s*)?(instructions?\s*)?on\s*(the\s*)?(source|original)\s*site/i,
  /see\s+(full\s*)?(recipe|instructions?)\s*(on|at)/i,
  /instructions?\s*(are\s*)?(available\s*)?(on|at)\s*(the\s*)?(source|original)\s*site/i,
  /visit\s+(the\s*)?(original\s*)?site\s+for/i,
  /full\s+recipe\s+at\s+\w/i,
  /get\s+(the\s+)?full\s+recipe/i,
  /find\s+(the\s+)?(full\s+)?recipe\s+(on|at)/i,
];

function instructionsArePlaceholder(instructions: string): boolean {
  if (!instructions || instructions.trim().length === 0) return true;
  const stripped = instructions.replace(/[\[\]"\\]/g, ' ').trim();
  if (stripped.length < 5) return true;
  if (stripped.length > 400) return false;
  return PLACEHOLDER_RE.some(p => p.test(stripped));
}

/**
 * AI-driven Recipe Cleaning Pipeline.
 * Takes messy, unstructured recipe text/data and forces it into a strict, unified JSON format.
 * When instructions are missing or placeholder, generates them from name + ingredients instead.
 */
export async function cleanRecipe(rawRecipe: RawRecipe): Promise<CleanedRecipe> {
  if (!anthropic) {
    throw new Error('Anthropic API key is not configured.');
  }

  const needsGeneration = instructionsArePlaceholder(rawRecipe.instructions);

  const systemPrompt = needsGeneration
    ? `You are a professional recipe developer. Given only a recipe name and its ingredient list, write clear, accurate, step-by-step cooking instructions. Your steps must be realistic, correctly ordered, and cover all the ingredients provided.`
    : `You are a professional recipe editor. Your job is to take messy, unstructured recipe text and produce a clean, standardized, unambiguous step-by-step recipe. Never invent steps or ingredients that aren't implied by the source material. Never remove steps. Your job is to clarify and structure, not to rewrite.`;

  const JSON_SCHEMA = `
Return ONLY raw JSON with no markdown block formatting in this exact structure:
{
  "cleanedName": "string",
  "sections": [
    {
      "sectionName": "string",
      "steps": [
        {
          "stepNumber": 1,
          "instruction": "string",
          "durationMinutes": null,
          "linkedIngredients": ["string"]
        }
      ]
    }
  ],
  "totalPrepTime": 0,
  "totalCookTime": 0,
  "totalTime": 0,
  "servings": 0,
  "difficulty": "medium",
  "tips": []
}

Rules:
- sectionName groups logical phases like 'Prepare the Marinade', 'Cook the Protein', 'Assemble' — use 'Main' if the recipe has no natural sections.
- stepNumber is globally sequential across all sections (1, 2, 3... not restarting per section).
- linkedIngredients is a list of exact ingredient names from the ingredients list that are used in this specific step.
- durationMinutes is extracted from the step text if a time is mentioned, otherwise null.
- tips captures any notes, variations, or chef's tips found in the original text that don't fit cleanly into a step.
- The root structure must EXACTLY MATCH the schema requested. Return NOTHING BUT valid JSON.`;

  const userPrompt = needsGeneration
    ? `Generate step-by-step cooking instructions for this recipe. Cover every ingredient.
Recipe name: ${rawRecipe.name}
Ingredients: ${JSON.stringify(rawRecipe.ingredients)}
${JSON_SCHEMA}`
    : `Clean and structure this recipe.
Raw name: ${rawRecipe.name}
Raw ingredients: ${JSON.stringify(rawRecipe.ingredients)}
Raw steps/instructions: ${rawRecipe.instructions}
${JSON_SCHEMA}`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2500,
    temperature: 0.2, // Low temperature for maximum compliance
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt }
    ]
  });

  const content = response.content[0];
  if (!content || content.type !== 'text') {
    throw new Error("Invalid response from Anthropic");
  }

  try {
    let jsonStr = content.text.trim();
    // Robust JSON extraction block using regex:
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0].trim();
    }

    const cleaned: CleanedRecipe = JSON.parse(jsonStr);

    // Safety enforcements
    if (!cleaned.sections) cleaned.sections = [];
    if (!cleaned.tips) cleaned.tips = [];
    if (typeof cleaned.difficulty !== 'string') cleaned.difficulty = 'medium';

    return cleaned;
  } catch (error: any) {
    console.error("Failed to parse cleaned recipe JSON:", error?.message, "\nRaw Response:", content.text);
    throw new Error("AI returned invalid JSON: " + (error?.message ?? "parse error"));
  }
}

import Anthropic from '@anthropic-ai/sdk';
import { RawRecipe, CleanedRecipe } from '../types/ai';

// Initialize anthropic client only if key is available
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
}) : null;

/**
 * AI-driven Recipe Cleaning Pipeline.
 * Takes messy, unstructured recipe text/data and forces it into a strict, unified JSON format.
 */
export async function cleanRecipe(rawRecipe: RawRecipe): Promise<CleanedRecipe> {
  if (!anthropic) {
    throw new Error('Anthropic API key is not configured.');
  }

  const systemPrompt = `You are a professional recipe editor. Your job is to take messy, unstructured recipe text and produce a clean, standardized, unambiguous step-by-step recipe. 
Never invent steps or ingredients that aren't implied by the source material. 
Never remove steps. Your job is to clarify and structure, not to rewrite.`;

  const userPrompt = `Clean and structure this recipe. 
Raw name: ${rawRecipe.name}
Raw ingredients: ${JSON.stringify(rawRecipe.ingredients)}
Raw steps/instructions: ${rawRecipe.instructions}

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

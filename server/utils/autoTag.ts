/**
 * Auto-tag detection for recipes.
 *
 * Derives method/time tags from a recipe title and total cook time.
 * Always pass existingTags so diet tags from external APIs are preserved.
 */
export function detectTags(title: string, totalMinutes: number, existingTags: string[] = []): string[] {
  const lower = title.toLowerCase();
  const tags = [...existingTags];
  const add = (tag: string) => { if (!tags.includes(tag)) tags.push(tag); };

  if (/crock.?pot|slow.?cook/.test(lower)) add("crockpot");
  if (/instant.?pot|pressure.?cook/.test(lower)) { add("quick"); add("one-pot"); }
  if (/air.?fry/.test(lower)) add("quick");
  if (/grill|bbq|barbecue/.test(lower)) add("grilled");
  if (totalMinutes > 0 && totalMinutes <= 30) add("quick");
  if (totalMinutes >= 240 && !tags.includes("crockpot")) add("slow-cook");
  if (/one.?pot|one.?pan|sheet.?pan/.test(lower)) add("one-pot");

  return tags;
}

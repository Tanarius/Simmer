import axios from "axios";

export interface OFFProduct {
  offId: string;       // barcode / UPC
  name: string;
  brand: string;
  imageUrl: string | null;
  calories: number | null;
  protein: string | null;
  carbs: string | null;
  fat: string | null;
  categories: string[];
}

export async function searchProducts(query: string, limit = 12): Promise<OFFProduct[]> {
  if (!query.trim()) return [];
  try {
    const res = await axios.get("https://world.openfoodfacts.org/cgi/search.pl", {
      params: {
        search_terms: query,
        search_simple: 1,
        action: "process",
        json: 1,
        page_size: limit,
        fields: "code,product_name,brands,image_thumb_url,nutriments,categories_tags",
        lc: "en",
      },
      timeout: 6000,
    });

    const products: any[] = res.data?.products ?? [];
    return products
      .filter((p) => p.product_name?.trim())
      .map((p) => ({
        offId: p.code ?? "",
        name: p.product_name.trim(),
        brand: (p.brands ?? "").split(",")[0].trim(),
        imageUrl: p.image_thumb_url || null,
        calories: p.nutriments?.["energy-kcal_serving"]
          ? Math.round(p.nutriments["energy-kcal_serving"])
          : p.nutriments?.["energy-kcal_100g"]
            ? Math.round(p.nutriments["energy-kcal_100g"])
            : null,
        protein: p.nutriments?.proteins_serving
          ? `${Math.round(p.nutriments.proteins_serving)}g`
          : p.nutriments?.proteins_100g
            ? `${Math.round(p.nutriments.proteins_100g)}g`
            : null,
        carbs: p.nutriments?.carbohydrates_serving
          ? `${Math.round(p.nutriments.carbohydrates_serving)}g`
          : p.nutriments?.carbohydrates_100g
            ? `${Math.round(p.nutriments.carbohydrates_100g)}g`
            : null,
        fat: p.nutriments?.fat_serving
          ? `${Math.round(p.nutriments.fat_serving)}g`
          : p.nutriments?.fat_100g
            ? `${Math.round(p.nutriments.fat_100g)}g`
            : null,
        categories: (p.categories_tags ?? [])
          .filter((c: string) => c.startsWith("en:"))
          .slice(0, 3)
          .map((c: string) => c.replace("en:", "").replace(/-/g, " ")),
      }));
  } catch {
    return [];
  }
}

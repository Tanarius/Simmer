import { useState } from "react";
import { Wheat, Flame, Soup, Drumstick, Leaf, CookingPot, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { Recipe } from "@shared/schema";
import { cn } from "@/lib/utils";

interface RecipeImageProps {
  recipe: Pick<Recipe, "imageUrl" | "cuisine" | "name">;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** When false, the cuisine placeholder omits the cuisine label + title text
   *  (keeps only the corner glyph) — used where the surrounding card already
   *  shows the recipe name. Has no effect on the photo path. Default true. */
  showTitle?: boolean;
}

interface CuisineStyle {
  bg: string;
  tint: string;
  Icon: LucideIcon;
}

const CUISINE_STYLES: Record<string, CuisineStyle> = {
  "italian":       { bg: "#C44A2E", tint: "#F2C7B8", Icon: Wheat },
  "tex-mex":       { bg: "#BA7517", tint: "#F4DBB0", Icon: Flame },
  "asian":         { bg: "#0F6E56", tint: "#A7DCC9", Icon: Soup },
  "american":      { bg: "#185FA5", tint: "#AFD0EE", Icon: Drumstick },
  "mediterranean": { bg: "#3B6D11", tint: "#C7E29A", Icon: Leaf },
  "indian":        { bg: "#A8521C", tint: "#F0CFA8", Icon: CookingPot },
  "other":         { bg: "#5F5E5A", tint: "#CFCEC8", Icon: UtensilsCrossed },
};

const DEFAULT_STYLE = CUISINE_STYLES["other"];

const SIZE_SCALE = {
  sm: { padding: "8px", title: "12px", icon: 11, label: "7px", titleClamp: "line-clamp-2", iconInset: 4 },
  md: { padding: "13px", title: "16px", icon: 19, label: "9px", titleClamp: "line-clamp-3", iconInset: 0 },
  lg: { padding: "15px", title: "20px", icon: 20, label: "10px", titleClamp: "line-clamp-3", iconInset: 0 },
};

export function RecipeImage({ recipe, size = "md", className, showTitle = true }: RecipeImageProps) {
  const [imgError, setImgError] = useState(false);
  const hasImage = recipe.imageUrl && !imgError;

  if (hasImage) {
    return (
      <img
        src={recipe.imageUrl!}
        alt={recipe.name}
        className={cn("w-full h-full object-cover", className)}
        loading="lazy"
        onError={() => setImgError(true)}
      />
    );
  }

  const style = CUISINE_STYLES[recipe.cuisine] ?? DEFAULT_STYLE;
  const scale = SIZE_SCALE[size];
  const { Icon } = style;

  return (
    <div
      className={cn("relative w-full h-full overflow-hidden flex flex-col justify-between", className)}
      style={{ backgroundColor: style.bg, padding: scale.padding }}
    >
      <div className={cn("flex items-start gap-2", showTitle ? "justify-between" : "justify-end")}>
        {showTitle && (
          <span
            className="font-sans font-semibold uppercase tracking-widest truncate min-w-0"
            style={{ color: style.tint, fontSize: scale.label }}
          >
            {recipe.cuisine}
          </span>
        )}
        <Icon
          style={{
            color: style.tint,
            width: scale.icon,
            height: scale.icon,
            marginTop: scale.iconInset,
            marginRight: scale.iconInset,
          }}
          className="shrink-0"
        />
      </div>
      {showTitle && (
        <span
          className={cn("font-serif font-semibold leading-tight text-white/90", scale.titleClamp)}
          style={{ fontSize: scale.title }}
        >
          {recipe.name}
        </span>
      )}
    </div>
  );
}

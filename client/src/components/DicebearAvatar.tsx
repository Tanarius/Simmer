import { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import {
  adventurer, bottts, funEmoji, lorelei, micah, pixelArt, rings, thumbs,
} from "@dicebear/collection";
import { cn } from "@/lib/utils";

export const AVATAR_STYLES = [
  { key: "adventurer", label: "Adventurer", style: adventurer },
  { key: "lorelei",    label: "Lorelei",    style: lorelei },
  { key: "bottts",     label: "Bottts",     style: bottts },
  { key: "micah",      label: "Micah",      style: micah },
  { key: "funEmoji",   label: "Fun Emoji",  style: funEmoji },
  { key: "pixelArt",   label: "Pixel Art",  style: pixelArt },
  { key: "rings",      label: "Rings",      style: rings },
  { key: "thumbs",     label: "Thumbs",     style: thumbs },
] as const;

export type AvatarStyleKey = typeof AVATAR_STYLES[number]["key"];

const STYLE_MAP = Object.fromEntries(
  AVATAR_STYLES.map(s => [s.key, s.style])
) as Record<string, typeof adventurer>;

const FALLBACK_COLORS = [
  "from-orange-600 to-amber-700",
  "from-orange-500 to-amber-500",
  "from-green-500 to-emerald-600",
  "from-pink-500 to-rose-600",
  "from-cyan-500 to-blue-600",
];

interface DicebearAvatarProps {
  username: string;
  avatarStyle?: string | null;
  /** Pixel size — default 40 */
  size?: number;
  className?: string;
}

export function DicebearAvatar({ username, avatarStyle, size = 40, className }: DicebearAvatarProps) {
  const src = useMemo(() => {
    const styleObj = avatarStyle ? STYLE_MAP[avatarStyle] : null;
    if (!styleObj) return null;
    try {
      return createAvatar(styleObj, { seed: username }).toDataUri();
    } catch {
      return null;
    }
  }, [avatarStyle, username]);

  if (!src) {
    const color = FALLBACK_COLORS[(username?.charCodeAt(0) ?? 0) % FALLBACK_COLORS.length];
    return (
      <div
        className={cn(
          "rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold shrink-0",
          color,
          className,
        )}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.35) }}
      >
        {(username ?? "?").slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${username}'s avatar`}
      width={size}
      height={size}
      className={cn("rounded-full shrink-0 object-cover", className)}
    />
  );
}

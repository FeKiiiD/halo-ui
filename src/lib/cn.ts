import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge only knows Tailwind's own scales. Without teaching it Halo's,
 * `px-control-px` and `px-0` would be treated as unrelated and both survive —
 * so a consumer's override would lose to whichever the stylesheet happened to
 * order last. Every custom scale registered in theme.css belongs here.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display-xl",
            "display-l",
            "heading-m",
            "heading-s",
            "eyebrow",
            "body-l",
            "body",
            "body-s",
            "stat",
            "button",
            "app-title",
          ],
        },
      ],
      rounded: [{ rounded: ["pill", "card", "panel", "chip", "input"] }],
      shadow: [{ shadow: ["float"] }],

      // Named spacing steps. They collide with the numeric scale (p-4, px-6),
      // so they must join those groups rather than form new ones.
      p: [{ p: ["card", "gutter", "section", "page"] }],
      px: [{ px: ["card", "gutter", "section", "page", "control-px"] }],
      py: [{ py: ["card", "gutter", "section", "page"] }],
      mx: [{ mx: ["card", "gutter", "section", "page"] }],
      gap: [{ gap: ["card", "gutter", "section", "page"] }],

      h: [{ h: ["control", "control-counter"] }],
      "max-w": [{ "max-w": ["content"] }],

      ease: [{ ease: ["standard"] }],
    },
  },
});

/** Merge class names, with later Tailwind utilities beating earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

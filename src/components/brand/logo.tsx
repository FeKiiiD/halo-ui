import * as React from "react";
import { cn } from "../../lib/cn";

export interface LogoSources {
  /** For light surfaces — usually the ink artwork. */
  light: string;
  /** For the ink régime — usually the white artwork. */
  dark: string;
}

export interface LogoProps {
  /**
   * The artwork, one file per régime. Omit and the wordmark renders as live
   * type — see the note on `wordmark` below.
   */
  src?: LogoSources;
  /** Intrinsic width ÷ height of the artwork, so the box reserves the right space. */
  ratio?: number;
  /**
   * `auto` follows `data-theme` on the document element. Pass an explicit
   * régime for a logo sitting on a surface that does not match the page — a
   * dark footer on a light page.
   */
  theme?: "auto" | "light" | "dark";
  height?: number;

  /** The product name. Used as the alt text, and as the fallback wordmark. */
  wordmark?: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * The product's mark.
 *
 * NO ARTWORK SHIPS WITH THIS LIBRARY. Pass your own files through `src`; with
 * none, the name renders as type so a page is never left with a broken image.
 *
 * THE TYPE FALLBACK IS A DEVELOPMENT AFFORDANCE, NOT A LOGO. A wordmark set in
 * the UI font is not the same artwork as a drawn one, and shipping it to
 * production means shipping a logo nobody designed. Supply `src` before
 * release.
 *
 * With `theme="auto"` a MutationObserver watches `data-theme`, so the artwork
 * swaps the moment the régime does — including when the user toggles it, which
 * a CSS media query alone would miss.
 */
export function Logo({
  src,
  ratio = 3,
  theme = "auto",
  height = 30,
  wordmark = "Halo",
  href,
  onClick,
  className,
}: LogoProps) {
  const [detected, setDetected] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    if (theme !== "auto") return;

    const read = () =>
      setDetected(
        document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light",
      );
    read();

    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [theme]);

  const mode = theme === "auto" ? detected : theme;

  const content = src ? (
    <img
      src={src[mode]}
      alt={wordmark}
      height={height}
      width={Math.round(height * ratio)}
      className="block h-auto w-auto"
      style={{ height }}
    />
  ) : (
    <span
      className="font-sans font-semibold tracking-[-0.03em]"
      // Sized from the box height rather than a token: the fallback has to
      // occupy the same space the artwork would.
      style={{ fontSize: Math.round(height * 0.68), lineHeight: `${height}px` }}
    >
      {wordmark}
    </span>
  );

  if (!href && !onClick) {
    return <span className={cn("inline-flex text-text-primary", className)}>{content}</span>;
  }

  return (
    <a
      href={href ?? "#"}
      onClick={(event) => {
        if (!onClick) return;
        event.preventDefault();
        onClick();
      }}
      className={cn("inline-flex text-text-primary no-underline halo-focus", className)}
    >
      {content}
    </a>
  );
}

import * as React from "react";
import { cn } from "../../lib/cn";
import { formatNumber } from "../../lib/number-format";
import { MatrixFrame } from "./matrix-frame";

export type BcgQuadrant = "star" | "question" | "cow" | "dog";

export interface BcgItem {
  id: string;
  label: string;
  /** Relative market share. 1 means parity with the largest competitor. */
  share: number;
  /** Market growth, in percent. */
  growth: number;
  /** Revenue. Drives the bubble's area. */
  value: number;
  units?: number;
  unitsLabel?: string;
  margin?: number;
  trend?: number;
}

export interface BcgMatrixProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  items: BcgItem[];
  onChange?: (id: string, position: { share: number; growth: number }) => void;
  onSelect?: (item: BcgItem) => void;

  height?: number;
  maxShare?: number;
  maxGrowth?: number;
  /** Where the horizontal divider sits, in growth percent. */
  growthPivot?: number;
  /** Where the vertical divider sits, in relative share. */
  sharePivot?: number;

  editable?: boolean;
  unit?: string;
  list?: boolean;
  quadrantLabels?: Partial<Record<BcgQuadrant, { label: string; hint: string }>>;
  className?: string;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const quadrantMeta: Record<BcgQuadrant, { label: string; hint: string }> = {
  star: { label: "Stars", hint: "High share, growing market — invest." },
  question: { label: "Question marks", hint: "Growing market, low share — decide." },
  cow: { label: "Cash cows", hint: "High share, mature market — harvest." },
  dog: { label: "Dogs", hint: "Low share, mature market — divest." },
};

/**
 * Bubble skins stay inside the base palette: accent, ink, mist, alt. The
 * quadrant a bubble sits in decides its skin, so dragging one across a divider
 * visibly changes what it is — which is the whole argument of the model.
 */
const skins: Record<BcgQuadrant, string> = {
  star: "bg-accent text-accent-ink",
  cow: "bg-ink text-accent",
  question: "bg-mist-strong text-ink",
  dog: "bg-surface-alt text-text-secondary",
};

/**
 * Relative market share on x (reversed, as the model is always drawn), market
 * growth on y, one bubble per activity sized by revenue.
 *
 * SHARE RUNS HIGH ON THE LEFT. It is counter-intuitive and it is the
 * convention — a BCG drawn the other way round is unreadable to anyone who
 * knows the model.
 *
 * The bubble radius scales with the square root of revenue, so the AREA is
 * proportional. Scaling the radius directly makes a twice-as-large business
 * look four times the size.
 */
export function BcgMatrix({
  title = "BCG matrix",
  subtitle,
  items,
  onChange,
  onSelect,
  height = 360,
  maxShare = 2,
  maxGrowth = 20,
  growthPivot = 10,
  sharePivot = 1,
  editable = true,
  unit = "€",
  list = true,
  quadrantLabels,
  className,
}: BcgMatrixProps) {
  const plot = React.useRef<HTMLDivElement>(null);
  const [drag, setDrag] = React.useState<{ id: string; share: number; growth: number } | null>(null);
  const [hover, setHover] = React.useState<string | null>(null);

  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });

  React.useEffect(() => {
    if (!drag) return;

    const move = (event: PointerEvent) => {
      const box = plot.current?.getBoundingClientRect();
      if (!box) return;

      // Both axes are inverted: share runs right-to-left, growth bottom-to-top.
      const share = clamp(maxShare - ((event.clientX - box.left) / box.width) * maxShare, 0, maxShare);
      const growth = clamp(maxGrowth - ((event.clientY - box.top) / box.height) * maxGrowth, 0, maxGrowth);
      setDrag((current) => (current ? { ...current, share, growth } : current));
    };

    const up = () =>
      setDrag((current) => {
        if (current) {
          onChangeRef.current?.(current.id, {
            share: Math.round(current.share * 100) / 100,
            growth: Math.round(current.growth * 10) / 10,
          });
        }
        return null;
      });

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, maxShare, maxGrowth]);

  // The dragged item follows the pointer; everything else keeps its own values.
  const live = items.map((item) =>
    drag?.id === item.id ? { ...item, share: drag.share, growth: drag.growth } : item,
  );

  const total = live.reduce((sum, item) => sum + (item.value || 0), 0) || 1;
  const largest = Math.max(...live.map((item) => item.value || 0), 1);

  const quadrantOf = (item: BcgItem): BcgQuadrant =>
    item.growth >= growthPivot
      ? item.share >= sharePivot
        ? "star"
        : "question"
      : item.share >= sharePivot
        ? "cow"
        : "dog";

  // sqrt so area, not radius, tracks revenue.
  const radiusOf = (item: BcgItem) => 16 + Math.sqrt((item.value || 0) / largest) * 26;

  /**
   * Bubbles are placed inside an inset area rather than across the full plot: a
   * bubble centred at 0% or 100% is half outside its own chart, which clipped
   * "Catering" against the right edge. The inset is the largest radius plus a
   * little, expressed in px so it does not scale with the plot.
   */
  const inset = Math.max(...items.map(radiusOf), 16) + 4;

  const positionOf = (item: BcgItem) => ({
    left: `calc(${inset}px + ${(1 - item.share / maxShare) * 100}% - ${(inset * 2 * (1 - item.share / maxShare)).toFixed(1)}px)`,
    top: `calc(${inset}px + ${(1 - item.growth / maxGrowth) * 100}% - ${(inset * 2 * (1 - item.growth / maxGrowth)).toFixed(1)}px)`,
  });

  const hovered = live.find((item) => item.id === hover);

  const zone = (key: BcgQuadrant, className: string) => {
    const meta = quadrantLabels?.[key] ?? quadrantMeta[key];
    return (
      <span
        className={cn("pointer-events-none absolute flex flex-col gap-0.5 p-2.5", className)}
      >
        <span className="text-[12px] font-medium text-text-primary">{meta.label}</span>
        <span className="max-w-[168px] text-[11px] leading-[1.35] text-text-secondary">
          {meta.hint}
        </span>
      </span>
    );
  };

  return (
    <MatrixFrame
      title={title}
      subtitle={subtitle}
      meta={`${items.length} activities`}
      className={className}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <span
            className="flex w-5 shrink-0 items-center justify-center text-[11.5px] text-text-secondary"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Market growth
          </span>

          <div className="min-w-0 flex-1">
            <div
              ref={plot}
              className="relative overflow-hidden rounded-panel border border-border-subtle bg-surface-alt"
              style={{ height }}
            >
              {/* The dividers, not gridlines: a BCG has exactly two. */}
              <span
                aria-hidden="true"
                className="absolute inset-x-0 h-px bg-border-subtle"
                style={{ top: `${(1 - growthPivot / maxGrowth) * 100}%` }}
              />
              <span
                aria-hidden="true"
                className="absolute inset-y-0 w-px bg-border-subtle"
                style={{ left: `${(1 - sharePivot / maxShare) * 100}%` }}
              />

              {zone("star", "left-0 top-0")}
              {zone("question", "right-0 top-0 items-end text-right")}
              {zone("cow", "bottom-0 left-0")}
              {zone("dog", "bottom-0 right-0 items-end text-right")}

              {live.map((item) => {
                const quadrant = quadrantOf(item);
                const radius = radiusOf(item);
                const dragging = drag?.id === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onPointerDown={(event) => {
                      if (!editable) return;
                      // Capture so the drag continues outside the bubble.
                      event.currentTarget.releasePointerCapture?.(event.pointerId);
                      setDrag({ id: item.id, share: item.share, growth: item.growth });
                    }}
                    onMouseEnter={() => setHover(item.id)}
                    onMouseLeave={() => setHover((current) => (current === item.id ? null : current))}
                    onClick={() => onSelect?.(item)}
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-none",
                      "font-sans text-[12px] font-medium leading-tight halo-focus",
                      "transition-[box-shadow] duration-[140ms] ease-standard",
                      skins[quadrant],
                      editable ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-pointer",
                      // No transition while dragging: the bubble must track the
                      // pointer exactly.
                      !dragging && "transition-[left,top] duration-[200ms] ease-standard",
                      hover === item.id && "shadow-[0_0_0_3px_var(--color-border-strong)]",
                    )}
                    style={{ ...positionOf(item), width: radius * 2, height: radius * 2 }}
                  >
                    <span className="line-clamp-2 px-1">{item.label}</span>
                  </button>
                );
              })}

              {hovered ? (
                <BcgCard
                  item={hovered}
                  radius={radiusOf(hovered)}
                  position={positionOf(hovered)}
                  flip={1 - hovered.share / maxShare > 0.55}
                  share={Math.round(((hovered.value || 0) / total) * 100)}
                  unit={unit}
                />
              ) : null}
            </div>

            <div className="mt-1.5 flex justify-between text-[11.5px] text-text-secondary">
              <span>High relative share</span>
              <span>Low relative share</span>
            </div>
          </div>
        </div>

        {list ? (
          <ul className="m-0 grid list-none grid-cols-1 gap-1.5 p-0 sm:grid-cols-2">
            {live.map((item) => {
              const quadrant = quadrantOf(item);
              return (
                <li
                  key={item.id}
                  onMouseEnter={() => setHover(item.id)}
                  onMouseLeave={() => setHover((current) => (current === item.id ? null : current))}
                  onClick={() => onSelect?.(item)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border border-border-subtle px-3 py-2",
                    "text-[13px] transition-colors duration-[140ms] ease-standard",
                    hover === item.id ? "bg-surface-alt" : "bg-transparent",
                    onSelect ? "cursor-pointer" : "cursor-default",
                  )}
                >
                  <span className={cn("size-2.5 shrink-0 rounded-full", skins[quadrant])} />
                  <span className="truncate font-medium text-text-primary">{item.label}</span>
                  <span className="ml-auto shrink-0 tabular-nums text-text-secondary">
                    {formatNumber(item.value)} {unit}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </MatrixFrame>
  );
}

/** The read-out beside a hovered bubble. */
function BcgCard({
  item,
  radius,
  position,
  flip,
  share,
  unit,
}: {
  item: BcgItem;
  radius: number;
  position: { left: string; top: string };
  /** Computed by the caller: the position is now a calc() and cannot be parsed. */
  flip: boolean;
  share: number;
  unit: string;
}) {

  const rows: [string, string][] = [
    ["Relative share", `${item.share.toFixed(2)}×`],
    ["Market growth", `${item.growth >= 0 ? "+" : ""}${item.growth.toFixed(1)} %`],
    ["Revenue", `${formatNumber(item.value)} ${unit}`],
    ["Share of portfolio", `${share} %`],
    ...(item.units !== undefined
      ? ([["Units sold", `${formatNumber(item.units)}${item.unitsLabel ? ` ${item.unitsLabel}` : ""}`]] as [string, string][])
      : []),
    ...(item.margin !== undefined ? ([["Gross margin", `${item.margin} %`]] as [string, string][]) : []),
    ...(item.trend !== undefined
      ? ([["12-month change", `${item.trend >= 0 ? "+" : ""}${item.trend} %`]] as [string, string][])
      : []),
  ];

  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute z-400 w-[252px] overflow-hidden rounded-panel border border-border-subtle bg-surface-card shadow-float"
      style={{
        ...position,
        transform: `translate(${flip ? `calc(-100% - ${radius + 12}px)` : `${radius + 12}px`}, -50%)`,
      }}
    >
      <span className="flex flex-col gap-0.5 px-3.25 pb-2.25 pt-2.75">
        <strong className="text-[14.5px] font-semibold tracking-[-0.01em] text-text-primary">
          {item.label}
        </strong>
      </span>

      <span className="block border-t border-hairline px-3.25 py-2">
        {rows.map(([label, value]) => (
          <span key={label} className="flex justify-between gap-3 py-0.75 text-[12.5px]">
            <span className="text-text-secondary">{label}</span>
            <span className="font-medium tabular-nums text-text-primary">{value}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

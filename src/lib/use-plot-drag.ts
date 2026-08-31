import * as React from "react";

export interface PlotAxis {
  /** Value at the left (x) or bottom (y) edge. */
  min?: number;
  /** Value at the right (x) or top (y) edge. */
  max: number;
  /** Reverses the axis: high values on the left, or at the bottom. */
  reversed?: boolean;
  /** Decimal places to round to on commit. */
  precision?: number;
}

export interface UsePlotDragOptions<T> {
  x?: PlotAxis;
  y?: PlotAxis;
  /** Fired once on release, with the rounded position. */
  onCommit?: (id: string, position: T) => void;
}

export interface PlotDragState {
  id: string;
  x: number;
  y: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const round = (value: number, precision = 1) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

/**
 * Dragging a point around a plot, in the plot's own units.
 *
 * TWO THINGS MAKE THIS BEHAVE. The listeners live on the window rather than the
 * dragged element, so the pointer can leave the bubble — and the plot — without
 * the drag stopping. And `onCommit` fires once on release rather than on every
 * frame, so a caller persisting to a server does not send sixty requests a
 * second.
 *
 * The live position is returned separately from the committed one: the caller
 * renders the dragged item from `drag` and everything else from its own state,
 * which is what keeps the drag smooth without the caller re-rendering on each
 * move.
 */
export function usePlotDrag<T extends Record<string, number>>({
  x,
  y,
  onCommit,
}: UsePlotDragOptions<T>): {
  plotRef: React.RefObject<HTMLDivElement | null>;
  drag: PlotDragState | null;
  start: (id: string, from: { x?: number; y?: number }) => void;
  dragging: boolean;
} {
  const plotRef = React.useRef<HTMLDivElement>(null);
  const [drag, setDrag] = React.useState<PlotDragState | null>(null);

  const onCommitRef = React.useRef(onCommit);
  React.useEffect(() => {
    onCommitRef.current = onCommit;
  });

  // Axes are held in a ref so the effect does not resubscribe when a caller
  // passes them as an object literal.
  const axesRef = React.useRef({ x, y });
  axesRef.current = { x, y };

  React.useEffect(() => {
    if (!drag) return;

    const move = (event: PointerEvent) => {
      const box = plotRef.current?.getBoundingClientRect();
      if (!box) return;

      const { x: xAxis, y: yAxis } = axesRef.current;

      setDrag((current) => {
        if (!current) return current;

        let nextX = current.x;
        let nextY = current.y;

        if (xAxis) {
          const min = xAxis.min ?? 0;
          const ratio = (event.clientX - box.left) / box.width;
          const value = min + (xAxis.reversed ? 1 - ratio : ratio) * (xAxis.max - min);
          nextX = clamp(value, min, xAxis.max);
        }

        if (yAxis) {
          const min = yAxis.min ?? 0;
          // Screen y grows downward, so a normal axis is already reversed.
          const ratio = (event.clientY - box.top) / box.height;
          const value = min + (yAxis.reversed ? ratio : 1 - ratio) * (yAxis.max - min);
          nextY = clamp(value, min, yAxis.max);
        }

        return { ...current, x: nextX, y: nextY };
      });
    };

    const up = () =>
      setDrag((current) => {
        if (current) {
          const { x: xAxis, y: yAxis } = axesRef.current;
          onCommitRef.current?.(current.id, {
            ...(xAxis ? { x: round(current.x, xAxis.precision) } : null),
            ...(yAxis ? { y: round(current.y, yAxis.precision) } : null),
          } as T);
        }
        return null;
      });

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [drag]);

  const start = React.useCallback((id: string, from: { x?: number; y?: number }) => {
    setDrag({ id, x: from.x ?? 0, y: from.y ?? 0 });
  }, []);

  return { plotRef, drag, start, dragging: drag !== null };
}

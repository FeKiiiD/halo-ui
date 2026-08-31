import * as React from "react";

/**
 * The controlled-first, uncontrolled-friendly pattern every Halo input uses:
 * pass `value` and the component defers to you, omit it and it keeps its own
 * state. `onChange` fires either way.
 *
 * Whether a component is controlled is decided on first render and never
 * re-read, matching React's own rule for form elements — switching modes
 * mid-life is a bug in the caller, not a case to support.
 */
export function useControllableState<T>(options: {
  value: T | undefined;
  defaultValue: T;
  onChange?: (value: T) => void;
}): [T, (next: T) => void] {
  const { value, defaultValue, onChange } = options;

  const isControlled = React.useRef(value !== undefined).current;
  const [uncontrolled, setUncontrolled] = React.useState<T>(defaultValue);

  const resolved = isControlled ? (value as T) : uncontrolled;

  // The callback is held in a ref so the returned setter stays referentially
  // stable — otherwise every consumer passing an inline arrow would break the
  // memoisation of anything downstream.
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });

  const set = React.useCallback(
    (next: T) => {
      if (!isControlled) setUncontrolled(next);
      onChangeRef.current?.(next);
    },
    [isControlled],
  );

  return [resolved, set];
}

import { useRef, useCallback, useEffect } from "react";

// For continuous events (drag/zoom) — fires at most once per intervalMs.
export function useThrottledCallback(fn, intervalMs) {
  const lastRun = useRef(0);
  const fnRef = useRef(fn);

  // Keep the ref current after each commit — refs must not be written during render.
  useEffect(() => {
    fnRef.current = fn;
  });

  return useCallback((...args) => {
    const now = Date.now();
    if (now - lastRun.current >= intervalMs) {
      lastRun.current = now;
      fnRef.current(...args);
    }
  }, [intervalMs]);
}

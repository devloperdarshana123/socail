import { useRef, useCallback, useEffect } from "react";

export function useDebouncedCallback(fn, delayMs) {
  const timerRef = useRef(null);
  const fnRef = useRef(fn);

  // Keep the ref current after each commit — refs must not be written during render.
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return useCallback((...args) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fnRef.current(...args), delayMs);
  }, [delayMs]);
}

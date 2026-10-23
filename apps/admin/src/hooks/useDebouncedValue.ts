import { useEffect, useState } from 'react';

/** Значення після паузи в його зміні: запит до API — не на кожну літеру. */
export function useDebouncedValue<Value>(value: Value, delayMs: number): Value {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debouncedValue;
}

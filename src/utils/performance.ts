/**
 * Performance utilities for debouncing and throttling
 */

/**
 * Debounces a function call - delays execution until after a specified time has elapsed
 * since the last invocation. Useful for expensive operations triggered by frequent events.
 * 
 * @param fn - The function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 * 
 * @example
 * const debouncedSearch = debounce((query) => performSearch(query), 300);
 * // Will only execute after 300ms of no calls
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function(this: any, ...args: Parameters<T>) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttles a function call - ensures it's called at most once per specified time period.
 * First call executes immediately, subsequent calls within the limit are ignored.
 * 
 * @param fn - The function to throttle
 * @param limit - Minimum time between calls in milliseconds
 * @returns Throttled function
 * 
 * @example
 * const throttledScroll = throttle(() => handleScroll(), 100);
 * // Will execute at most once every 100ms
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

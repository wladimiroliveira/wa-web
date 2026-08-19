/**
 * The API stores `margin` as a fraction: `0.35` prices at cost × 1,35. The
 * screen never shows one. `nonnegative` has no ceiling on the server, so a raw
 * field that accepts `35` stores a 3500 % margin and prices a hundred at forty
 * times its cost without a single error anywhere.
 *
 * Multiplying is what needs rounding — `0.35 * 100` is 35.000000000000004.
 * Dividing does not: `35 / 100` is the nearest double to 0.35, which is exactly
 * what `JSON.stringify` writes as `0.35`.
 *
 * `toPercent` keeps one decimal place, on purpose, to match what the field
 * shows. A margin stored with more precision than that is rounded the moment
 * a form opens it and saves it back untouched — `0.12345` round-trips as
 * `0.123`.
 */
export function toPercent(fraction: number): number {
  return Math.round(fraction * 1000) / 10;
}

export function fromPercent(percent: number): number {
  return percent / 100;
}

/** The params `pattern` captures from `pathname`, or null when the two do not line up. */
export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const expected = pattern.split("/").filter(Boolean);
  const actual = pathname.split("/").filter(Boolean);

  if (expected.length !== actual.length) return null;

  const params: Record<string, string> = {};

  for (const [index, segment] of expected.entries()) {
    const value = actual[index]!;

    if (segment.startsWith(":")) params[segment.slice(1)] = decodeURIComponent(value);
    else if (segment !== value) return null;
  }

  return params;
}

/** How many segments of a pattern are dynamic. A static segment wins over a dynamic one, as `/plan` does over `/:id`. */
export const dynamicSegmentsOf = (pattern: string) =>
  pattern.split("/").filter((segment) => segment.startsWith(":")).length;

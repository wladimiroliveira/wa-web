import { describe, expect, it } from "vitest";
import { formatDateTime } from "@/lib/dates";

describe("formatDateTime", () => {
  // Midday UTC is the same calendar day in every timezone the suite may run in.
  it("writes an API timestamp as a Brazilian date and time", () => {
    expect(formatDateTime("2026-10-02T12:00:00.000Z")).toMatch(/^02\/10\/2026 \d{2}:00$/);
  });
});

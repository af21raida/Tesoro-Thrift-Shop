import { describe, expect, it } from "vitest";
import { createAuctionSchema } from "@/lib/validation/auction";

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const baseInput = {
  name: "Vintage Camera",
  description: "A well-loved 35mm film camera, fully functional.",
  condition: "GOOD" as const,
  categoryId: "test-category-id",
  images: "",
  startingPrice: "50.00",
  minIncrement: "5.00",
};

describe("createAuctionSchema", () => {
  it("rejects a startTime in the past (Phase 11 issue #3)", () => {
    const past = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const result = createAuctionSchema.safeParse({
      ...baseInput,
      startTime: toLocalDatetimeString(past),
      endTime: toLocalDatetimeString(future),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.startTime).toBeDefined();
    }
  });

  it("accepts a startTime a few seconds in the past (submit-latency tolerance)", () => {
    const justPast = new Date(Date.now() - 5_000);
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const result = createAuctionSchema.safeParse({
      ...baseInput,
      startTime: toLocalDatetimeString(justPast),
      endTime: toLocalDatetimeString(future),
    });
    expect(result.success).toBe(true);
  });

  it("rejects endTime before startTime, independent of the startTime check", () => {
    const start = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const end = new Date(Date.now() + 60 * 60 * 1000); // before start
    const result = createAuctionSchema.safeParse({
      ...baseInput,
      startTime: toLocalDatetimeString(start),
      endTime: toLocalDatetimeString(end),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.endTime).toBeDefined();
    }
  });

  it("accepts a valid future window", () => {
    const start = new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const result = createAuctionSchema.safeParse({
      ...baseInput,
      startTime: toLocalDatetimeString(start),
      endTime: toLocalDatetimeString(end),
    });
    expect(result.success).toBe(true);
  });
});

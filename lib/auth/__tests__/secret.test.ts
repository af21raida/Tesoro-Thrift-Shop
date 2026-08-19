import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAuthSecretBytes, InsecureAuthSecretError, isKnownPlaceholderSecret } from "@/lib/auth/secret";

describe("isKnownPlaceholderSecret", () => {
  it("flags the exact .env.example placeholder value", () => {
    expect(isKnownPlaceholderSecret("replace-with-a-long-random-string")).toBe(true);
  });

  it("does not flag a real-looking secret", () => {
    expect(isKnownPlaceholderSecret("kX9dQwErTyUiOpAsDfGhJkLzXcVbNm12")).toBe(false);
  });

  it("does not flag undefined (that's the separate 'missing' case)", () => {
    expect(isKnownPlaceholderSecret(undefined)).toBe(false);
  });
});

describe("getAuthSecretBytes", () => {
  const originalSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    delete process.env.AUTH_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = originalSecret;
    }
  });

  it("throws InsecureAuthSecretError when AUTH_SECRET is unset (Phase 11 issue #5/#8)", () => {
    expect(() => getAuthSecretBytes()).toThrow(InsecureAuthSecretError);
  });

  it("throws InsecureAuthSecretError when AUTH_SECRET is the known placeholder", () => {
    process.env.AUTH_SECRET = "replace-with-a-long-random-string";
    expect(() => getAuthSecretBytes()).toThrow(InsecureAuthSecretError);
  });

  it("returns encoded bytes for a real secret", () => {
    process.env.AUTH_SECRET = "a-sufficiently-long-real-secret-value";
    const bytes = getAuthSecretBytes();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(bytes)).toBe("a-sufficiently-long-real-secret-value");
  });
});

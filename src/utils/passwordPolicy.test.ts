import { describe, expect, it } from "vitest";
import { scorePassword, validatePassword } from "./passwordPolicy";

describe("password policy", () => {
  it.each([
    ["valid password", "Abcdefgh12!x", []],
    ["too short", "Abcdef1!", ["Use at least 12 characters."]],
    ["missing uppercase", "abcdefgh12!x", ["Include an uppercase letter."]],
    ["missing lowercase", "ABCDEFGH12!X", ["Include a lowercase letter."]],
    ["missing number", "Abcdefghij!x", ["Include a number."]],
    ["missing symbol", "Abcdefgh12ax", ["Include a symbol."]],
    ["unicode letters and numbers", "Ábcdefgh١٢!x", []],
    ["surrogate pair is one character", "Abcdefgh1!😀", ["Use at least 12 characters."]],
  ] as const)("%s", (_label, password, expectedFailures) => {
    const result = validatePassword(password);
    expect(result.failures).toEqual(expectedFailures);
    expect(result.valid).toBe(expectedFailures.length === 0);
  });

  it("scores the number of satisfied rules", () => {
    expect(scorePassword("Abcdefgh12!x")).toBe(5);
    expect(scorePassword("abcdefg1")).toBe(2);
  });
});

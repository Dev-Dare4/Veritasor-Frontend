/**
 * mockAuth — demo-only authentication helpers.
 *
 * Recovery codes are pre-defined for the demo account so that the recovery
 * flow is reachable and testable without a real backend.  Each code is
 * single-use: calling `verifyRecoveryCode` with a valid code consumes it so
 * subsequent calls with the same code return `false`.
 *
 * New codes generated after re-enrollment use `crypto.getRandomValues` rather
 * than `Math.random`; the latter is not suitable for security material.
 *
 * SECURITY NOTE: This module is intentionally demo-only and ships with
 * well-known codes in plain source.  A production implementation must never
 * embed recovery codes in frontend source.
 */

// ─── Character set ───────────────────────────────────────────────────────────
// Omits visually ambiguous characters: 0/O, 1/I/L.
const RECOVERY_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// ─── Demo account codes ──────────────────────────────────────────────────────
// These are the codes that were "shown at enrollment" for the demo account.
// They are intentionally documented so testers can use them.
const DEMO_RECOVERY_CODES: string[] = [
  "ABCD-EFGH-2345",
  "JKLM-NPQR-6789",
  "STUV-WXYZ-2346",
  "ABCE-FGHJ-3456",
  "KLMN-PQRS-4567",
  "TUVW-XYZ2-5678",
  "BCDE-FGHK-6789",
  "LMNP-QRST-7890",
  "UVWX-YZ23-8901",
  "CDEF-GHJK-9012",
];

// ─── Mutable state ───────────────────────────────────────────────────────────
// A Set gives O(1) membership checks and cheap deletion (consume on use).
// Exported for test resets only; do not mutate directly outside tests.
export let _remainingCodes: Set<string> = new Set(DEMO_RECOVERY_CODES);

/** Reset the in-memory code store to the original demo set.  Call this in
 *  `beforeEach` / `afterEach` in tests that mutate the store. */
export function resetMockAuthCodes(): void {
  _remainingCodes = new Set(DEMO_RECOVERY_CODES);
}

// ─── Normalisation ───────────────────────────────────────────────────────────
/** Strip dashes and non-alphanumeric, upper-case.  Allows users to paste with
 *  or without dashes, and forgives mixed case. */
function normalise(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Verify a recovery code entered by the user.
 *
 * Returns `true` and consumes (removes) the code if it matches any remaining
 * code.  Returns `false` if there is no match or the code was already used.
 *
 * Matching is case-insensitive and dash-tolerant.
 */
export function verifyRecoveryCode(input: string): boolean {
  const normalised = normalise(input);
  for (const stored of _remainingCodes) {
    if (normalise(stored) === normalised) {
      _remainingCodes.delete(stored);
      return true;
    }
  }
  return false;
}

/** How many recovery codes are still available for the demo account. */
export function remainingCodeCount(): number {
  return _remainingCodes.size;
}

/** The list of demo codes originally shown at enrollment.
 *  Read-only; used to seed UI hints in development. */
export const DEMO_CODES_READONLY: readonly string[] = Object.freeze([
  ...DEMO_RECOVERY_CODES,
]);

// ─── Code generation (post re-enrollment) ────────────────────────────────────
/**
 * Generate a fresh set of 10 recovery codes using `crypto.getRandomValues`.
 *
 * Format: XXXX-XXXX-XXXX (three groups of 4 chars from RECOVERY_CODE_CHARS).
 *
 * This replaces the `Math.random`-based `generateRecoveryCodes` that was
 * previously inlined in Login.tsx.
 */
export function generateRecoveryCodes(): string[] {
  return Array.from({ length: 10 }, () => {
    const seg = (): string => {
      const buf = new Uint32Array(4);
      crypto.getRandomValues(buf);
      return Array.from(buf, (n) => RECOVERY_CODE_CHARS[n % RECOVERY_CODE_CHARS.length]).join("");
    };
    return `${seg()}-${seg()}-${seg()}`;
  });
}

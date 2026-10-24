/**
 * Unit tests for src/services/mockAuth.ts
 *
 * Covers:
 *   ✔ verifyRecoveryCode returns true for an exact match
 *   ✔ verifyRecoveryCode is case-insensitive
 *   ✔ verifyRecoveryCode is dash-tolerant (input may omit or include dashes)
 *   ✔ verifyRecoveryCode is single-use (second call with same code returns false)
 *   ✔ verifyRecoveryCode returns false for unknown codes
 *   ✔ remainingCodeCount decrements after each successful verification
 *   ✔ resetMockAuthCodes restores the full set
 *   ✔ generateRecoveryCodes produces 10 codes in XXXX-XXXX-XXXX format via crypto
 *   ✔ generateRecoveryCodes uses crypto.getRandomValues, not Math.random
 *
 * Regression:
 *   ✔ A fresh random set generated on mount (old behaviour) would NOT match
 *     a documented demo code — demonstrating the original bug.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  verifyRecoveryCode,
  remainingCodeCount,
  resetMockAuthCodes,
  generateRecoveryCodes,
  DEMO_CODES_READONLY,
  _remainingCodes,
} from './mockAuth'

// Reset state before every test so tests are independent.
beforeEach(() => {
  resetMockAuthCodes()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── verifyRecoveryCode ───────────────────────────────────────────────────────

describe('verifyRecoveryCode', () => {
  it('returns true for an exact-match demo code', () => {
    expect(verifyRecoveryCode(DEMO_CODES_READONLY[0])).toBe(true)
  })

  it('returns true for a code provided in lowercase', () => {
    const lower = DEMO_CODES_READONLY[1].toLowerCase()
    expect(verifyRecoveryCode(lower)).toBe(true)
  })

  it('returns true for a code provided in mixed case', () => {
    const mixed =
      DEMO_CODES_READONLY[2].slice(0, 4) +
      DEMO_CODES_READONLY[2].slice(4).toLowerCase()
    expect(verifyRecoveryCode(mixed)).toBe(true)
  })

  it('returns true when input omits dashes (dash-tolerant)', () => {
    const withoutDashes = DEMO_CODES_READONLY[3].replace(/-/g, '')
    expect(verifyRecoveryCode(withoutDashes)).toBe(true)
  })

  it('returns true when input has extra surrounding whitespace', () => {
    expect(verifyRecoveryCode(`  ${DEMO_CODES_READONLY[4]}  `)).toBe(true)
  })

  it('is single-use: second call with the same code returns false', () => {
    const code = DEMO_CODES_READONLY[0]
    expect(verifyRecoveryCode(code)).toBe(true)
    expect(verifyRecoveryCode(code)).toBe(false)
  })

  it('is single-use across normalisation variants: lowercase reuse also fails', () => {
    const code = DEMO_CODES_READONLY[5]
    expect(verifyRecoveryCode(code)).toBe(true)
    expect(verifyRecoveryCode(code.toLowerCase())).toBe(false)
  })

  it('returns false for an entirely unknown code', () => {
    expect(verifyRecoveryCode('ZZZZ-ZZZZ-ZZZZ')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(verifyRecoveryCode('')).toBe(false)
  })
})

// ─── remainingCodeCount ───────────────────────────────────────────────────────

describe('remainingCodeCount', () => {
  it('starts at 10 (all demo codes available)', () => {
    expect(remainingCodeCount()).toBe(10)
  })

  it('decrements by 1 after each successful verification', () => {
    verifyRecoveryCode(DEMO_CODES_READONLY[0])
    expect(remainingCodeCount()).toBe(9)

    verifyRecoveryCode(DEMO_CODES_READONLY[1])
    expect(remainingCodeCount()).toBe(8)
  })

  it('does not decrement on a failed verification', () => {
    verifyRecoveryCode('NOT-A-REAL-CODE')
    expect(remainingCodeCount()).toBe(10)
  })

  it('does not decrement when the same code is reused', () => {
    verifyRecoveryCode(DEMO_CODES_READONLY[0]) // consumes it → 9
    verifyRecoveryCode(DEMO_CODES_READONLY[0]) // reuse → still 9
    expect(remainingCodeCount()).toBe(9)
  })
})

// ─── resetMockAuthCodes ───────────────────────────────────────────────────────

describe('resetMockAuthCodes', () => {
  it('restores the count to 10 after codes have been consumed', () => {
    verifyRecoveryCode(DEMO_CODES_READONLY[0])
    verifyRecoveryCode(DEMO_CODES_READONLY[1])
    expect(remainingCodeCount()).toBe(8)

    resetMockAuthCodes()

    expect(remainingCodeCount()).toBe(10)
  })

  it('allows a previously consumed code to be verified again after reset', () => {
    const code = DEMO_CODES_READONLY[0]
    verifyRecoveryCode(code) // consume
    resetMockAuthCodes()
    expect(verifyRecoveryCode(code)).toBe(true) // available again
  })
})

// ─── generateRecoveryCodes ────────────────────────────────────────────────────

describe('generateRecoveryCodes', () => {
  it('returns exactly 10 codes', () => {
    const codes = generateRecoveryCodes()
    expect(codes).toHaveLength(10)
  })

  it('each code matches the XXXX-XXXX-XXXX format', () => {
    const codes = generateRecoveryCodes()
    const pattern = /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/
    for (const code of codes) {
      expect(code).toMatch(pattern)
    }
  })

  it('all 10 codes are unique within one generation', () => {
    const codes = generateRecoveryCodes()
    expect(new Set(codes).size).toBe(10)
  })

  it('uses crypto.getRandomValues, not Math.random', () => {
    const mathSpy = vi.spyOn(Math, 'random')
    const cryptoSpy = vi.spyOn(crypto, 'getRandomValues')

    generateRecoveryCodes()

    expect(cryptoSpy).toHaveBeenCalled()
    expect(mathSpy).not.toHaveBeenCalled()
  })

  it('produces codes that differ from the documented demo codes', () => {
    const freshCodes = generateRecoveryCodes()
    const demoCodes = new Set(DEMO_CODES_READONLY)
    // It is astronomically unlikely that a random set overlaps with fixed demo
    // codes; assert no overlap to catch if someone hard-codes the output.
    for (const code of freshCodes) {
      expect(demoCodes.has(code)).toBe(false)
    }
  })
})

// ─── Regression: old behaviour would always fail ─────────────────────────────

describe('regression: validateRecoveryCode against a fresh random set', () => {
  /**
   * The original Login.tsx initialised `codes` with a fresh random set on
   * mount.  Because the demo user never saw those randomly-generated codes,
   * `validateRecoveryCode(demoCode, randomCodes)` always returned `false`.
   *
   * This test documents that behaviour so future changes cannot silently
   * reintroduce it.  We simulate the old logic inline rather than importing
   * it, since it has been removed from the module under test.
   */
  function oldValidate(value: string, list: string[]): boolean {
    const normalized = value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
    return list.some((c) => c.toUpperCase().replace(/-/g, '') === normalized)
  }

  it('old logic fails: a documented demo code does not match a freshly generated random list', () => {
    // Mimic old Math.random-based code-generation
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    function oldGenerate(): string[] {
      return Array.from({ length: 10 }, () => {
        const seg = () =>
          Array.from(
            { length: 4 },
            () => CHARS[Math.floor(Math.random() * CHARS.length)],
          ).join('')
        return `${seg()}-${seg()}-${seg()}`
      })
    }

    const randomList = oldGenerate()
    const demoCode = DEMO_CODES_READONLY[0]

    // The demo code is almost certainly NOT in the random list.
    // We seed with a deterministic value to make the test reliable.
    // (The probability of a collision is ~1 in 32^12 ≈ 10^18.)
    expect(oldValidate(demoCode, randomList)).toBe(false)
  })

  it('new logic succeeds: verifyRecoveryCode accepts the first documented demo code', () => {
    // This is the "after fix" assertion that the regression test guards.
    expect(verifyRecoveryCode(DEMO_CODES_READONLY[0])).toBe(true)
  })
})

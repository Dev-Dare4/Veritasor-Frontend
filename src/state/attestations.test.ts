import { describe, expect, it } from 'vitest'
import { attestationsReducer, type Attestation } from './attestations'
import { MOCK_ATTESTATIONS } from './attestationMocks'

const pendingAttestation: Attestation = {
  id: 'att-new',
  status: 'pending',
  createdAt: '2026-07-01T12:00:00Z',
  timestamp: '2026-07-01T12:00:00Z',
  stellarTxHash: '',
  totalRevenue: '0.00',
  currency: 'USD',
  source: 'Stripe (live)',
  period: 'July 2026',
  recordCount: 10,
  merkleRoot: '0xabcdef',
}

describe('attestationsReducer', () => {
  it('inserts a new attestation as pending', () => {
    const result = attestationsReducer(MOCK_ATTESTATIONS, {
      type: 'trigger',
      attestation: pendingAttestation,
    })

    expect(result[0]).toEqual(pendingAttestation)
    expect(result).toHaveLength(MOCK_ATTESTATIONS.length + 1)
  })

  it('transitions an attestation to verified', () => {
    const result = attestationsReducer([pendingAttestation], {
      type: 'transition',
      id: pendingAttestation.id,
      status: 'verified',
    })

    expect(result[0].status).toBe('verified')
  })

  it('transitions a failed attestation with failure details', () => {
    const result = attestationsReducer([pendingAttestation], {
      type: 'transition',
      id: pendingAttestation.id,
      status: 'failed',
      failureReason: 'The revenue report contains no records.',
      remediation: 'Add revenue records to the report and try again.',
    })

    expect(result[0]).toMatchObject({
      status: 'failed',
      failureReason: 'The revenue report contains no records.',
      remediation: 'Add revenue records to the report and try again.',
    })
  })
})

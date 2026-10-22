import type { Attestation } from './attestations'

export const DEFAULT_TRIGGER_DETAILS = {
  source: 'Stripe (live)',
  period: 'May 2026',
  recordCount: 1247,
  merkleRoot: '0x4a2f8c3d1e6b9f0a2d5c8e1b4f7a0d3c6e9b2f5a8d1c4e7b0a3f6c9d2e5b8a1c4',
}

export const MOCK_ATTESTATIONS: Attestation[] = [
  {
    id: 'att-001',
    status: 'verified',
    createdAt: '2026-05-28T14:32:00Z',
    timestamp: '2026-05-28T14:32:00Z',
    merkleRoot: '0x3a7bd3e2360a3d29eea436fcfb7e44c735d117c9f4e4b5e6a1c2d3e4f5a6b7c8',
    stellarTxHash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
    recordCount: 142,
    totalRevenue: '84,320.00',
    currency: 'USD',
    source: 'Stripe Connect API',
    period: 'May 2026',
  },
  {
    id: 'att-002',
    status: 'pending',
    createdAt: '2026-05-15T09:10:00Z',
    timestamp: '2026-05-15T09:10:00Z',
    merkleRoot: '0x9f8e7d6c5b4a3928170605040302010f0e0d0c0b0a090807060504030201000f',
    stellarTxHash: 'f0e1d2c3b4a5968778695a4b3c2d1e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
    recordCount: 98,
    totalRevenue: '61,450.00',
    currency: 'USD',
    source: 'Stripe Connect API',
    period: 'May 2026',
  },
  {
    id: 'att-003',
    status: 'failed',
    createdAt: '2026-05-20T11:45:00Z',
    timestamp: '2026-05-20T11:45:00Z',
    merkleRoot: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    stellarTxHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    recordCount: 56,
    totalRevenue: '12,300.00',
    currency: 'USD',
    source: 'Stripe Connect API',
    period: 'May 2026',
    failureReason: 'Stellar network timeout during transaction submission.',
    remediation: 'Verify network connectivity and retry the attestation proof submission.',
  },
]

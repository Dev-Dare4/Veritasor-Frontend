import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import type { AttestationDetails } from '../components/AttestationConfirmModal'
import { MOCK_ATTESTATIONS } from './attestationMocks'

export type AttestationStatus = 'verified' | 'pending' | 'failed'

export interface Attestation extends AttestationDetails {
  id: string
  status: AttestationStatus
  createdAt: string
  timestamp: string
  stellarTxHash: string
  totalRevenue: string
  currency: string
  failureReason?: string
  remediation?: string
}

export type AttestationAction =
  | { type: 'trigger'; attestation: Attestation }
  | {
      type: 'transition'
      id: string
      status: Exclude<AttestationStatus, 'pending'>
      failureReason?: string
      remediation?: string
    }

export function attestationsReducer(
  state: Attestation[],
  action: AttestationAction,
): Attestation[] {
  switch (action.type) {
    case 'trigger':
      return [action.attestation, ...state]
    case 'transition':
      return state.map((attestation) =>
        attestation.id === action.id
          ? {
              ...attestation,
              status: action.status,
              failureReason: action.failureReason,
              remediation: action.remediation,
            }
          : attestation,
      )
  }
}

interface AttestationsContextValue {
  list: Attestation[]
  getById: (id: string) => Attestation | undefined
  trigger: (details: AttestationDetails) => Promise<Attestation>
}

const AttestationsContext = createContext<AttestationsContextValue | undefined>(undefined)

export function AttestationsProvider({ children }: { children: ReactNode }) {
  const [list, dispatch] = useReducer(attestationsReducer, MOCK_ATTESTATIONS)
  const nextId = useRef(1)

  const getById = useCallback(
    (id: string) => list.find((attestation) => attestation.id === id),
    [list],
  )

  const trigger = useCallback(async (details: AttestationDetails) => {
    const now = new Date().toISOString()
    const attestation: Attestation = {
      ...details,
      id: `att-${Date.now()}-${nextId.current++}`,
      status: 'pending',
      createdAt: now,
      timestamp: now,
      stellarTxHash: '',
      totalRevenue: '0.00',
      currency: 'USD',
    }

    dispatch({ type: 'trigger', attestation })
    await new Promise((resolve) => setTimeout(resolve, 1000))

    if (details.recordCount <= 0) {
      const failureReason = 'The revenue report contains no records.'
      dispatch({
        type: 'transition',
        id: attestation.id,
        status: 'failed',
        failureReason,
        remediation: 'Add revenue records to the report and try again.',
      })
      throw new Error(failureReason)
    }

    dispatch({ type: 'transition', id: attestation.id, status: 'verified' })
    return { ...attestation, status: 'verified' }
  }, [])

  const value = useMemo(
    () => ({ list, getById, trigger }),
    [list, getById, trigger],
  )

  return <AttestationsContext.Provider value={value}>{children}</AttestationsContext.Provider>
}

export function useAttestations() {
  const context = useContext(AttestationsContext)
  if (!context) {
    throw new Error('useAttestations must be used within an AttestationsProvider.')
  }
  return context
}

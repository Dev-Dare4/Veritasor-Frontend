export type AttestationStatus = 'verified' | 'pending' | 'failed';

export interface AttestationTrendDatum {
  date: string;
  verified: number;
  pending: number;
  failed: number;
  total: number;
}

export interface AttestationInput {
  id?: string;
  status?: string;
  date?: string;
  createdAt?: string;
}

function normalizeDate(input: AttestationInput): string {
  const raw = input.date ?? input.createdAt ?? '';
  if (!raw) return 'Unknown';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    const match = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return match.slice(1).join('-');
    return 'Unknown';
  }
  return date.toISOString().slice(0, 10);
}

function statusKey(status?: string): AttestationStatus {
  const normalized = status?.toLowerCase() ?? '';
  if (normalized.includes('verif') || normalized.includes('success') || normalized.includes('valid')) return 'verified';
  if (normalized.includes('pend') || normalized.includes('review') || normalized.includes('process') || normalized.includes('wait')) return 'pending';
  return 'failed';
}

export function aggregateAttestationTrend(records: AttestationInput[]): AttestationTrendDatum[] {
  const grouped = new Map<string, { verified: number; pending: number; failed: number }>();

  for (const record of records) {
    const date = normalizeDate(record);
    const status = statusKey(record.status);
    const current = grouped.get(date) ?? { verified: 0, pending: 0, failed: 0 };
    current[status] += 1;
    grouped.set(date, current);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({
      date,
      ...counts,
      total: counts.verified + counts.pending + counts.failed,
    }));
}

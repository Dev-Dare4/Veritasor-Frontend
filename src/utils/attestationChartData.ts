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

export interface AttestationChartGeometry {
  barWidth: number;
  positions: number[];
}

export function getAttestationChartGeometry(
  bucketCount: number,
  chartWidth = 640,
  padding = 12,
): AttestationChartGeometry {
  const count = Math.max(0, Math.floor(bucketCount));
  const bandWidth = Math.max(0, chartWidth - padding * 2) / Math.max(count, 1);
  const barWidth = count === 0 ? 0 : Math.min(48, bandWidth * 0.7);

  return {
    barWidth,
    positions: Array.from({ length: count }, (_, index) =>
      padding + index * bandWidth + (bandWidth - barWidth) / 2,
    ),
  };
}

export function getAttestationChartLabelIndices(labels: string[], centers: number[]): number[] {
  const candidates = labels
    .map((label, index) => ({ index, center: centers[index], width: label.length * 6 }))
    .filter(({ center }) => center !== undefined);
  if (candidates.length <= 1) return candidates.map(({ index }) => index);

  const selected = [candidates[0]];
  for (const candidate of candidates.slice(1, -1)) {
    const previous = selected[selected.length - 1];
    if (candidate.center - candidate.width / 2 >= previous.center + previous.width / 2 + 6) {
      selected.push(candidate);
    }
  }

  const last = candidates[candidates.length - 1];
  while (
    selected.length > 1 &&
    last.center - last.width / 2 <
      selected[selected.length - 1].center + selected[selected.length - 1].width / 2 + 6
  ) {
    selected.pop();
  }
  if (
    last.center - last.width / 2 >=
    selected[selected.length - 1].center + selected[selected.length - 1].width / 2 + 6
  ) {
    selected.push(last);
  }

  return selected.map(({ index }) => index);
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

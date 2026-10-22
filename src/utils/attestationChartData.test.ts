import { describe, expect, it } from 'vitest';
import { getAttestationChartGeometry, getAttestationChartLabelIndices } from './attestationChartData';

describe('getAttestationChartGeometry', () => {
  it.each([1, 2, 7, 31])('keeps %i bars inside the viewBox without overlap', (count) => {
    const chartWidth = 640;
    const padding = 12;
    const { barWidth, positions } = getAttestationChartGeometry(count, chartWidth, padding);

    expect(positions).toHaveLength(count);
    for (let index = 0; index < positions.length; index += 1) {
      expect(positions[index]).toBeGreaterThanOrEqual(padding);
      expect(positions[index] + barWidth).toBeLessThanOrEqual(chartWidth - padding);
      if (index > 0) {
        expect(positions[index]).toBeGreaterThanOrEqual(positions[index - 1] + barWidth);
      }
    }
  });
});

describe('getAttestationChartLabelIndices', () => {
  it('thins labels so their estimated text widths do not overlap', () => {
    const labels = Array.from({ length: 31 }, (_, index) => `Oct ${index + 1}`);
    const centers = Array.from({ length: 31 }, (_, index) => 22 + index * 19.87);
    const indices = getAttestationChartLabelIndices(labels, centers);

    expect(indices.length).toBeLessThan(labels.length);
    for (let index = 1; index < indices.length; index += 1) {
      const previous = indices[index - 1];
      const current = indices[index];
      expect(centers[current] - labels[current].length * 3).toBeGreaterThanOrEqual(
        centers[previous] + labels[previous].length * 3 + 6,
      );
    }
  });
});

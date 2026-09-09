import { expect, test } from 'bun:test';
import { Chart } from 'chart.js';
import { generateChart } from '../chart.js';

test('chart rendering releases registered Chart.js instances', () => {
  const count = Object.keys(Chart.instances).length;
  for (let i = 0; i < 5; i++) {
    const result = generateChart(
      [
        { _id: 900000, count: 1 },
        { _id: 900001, count: 2 },
      ],
      false
    );
    expect(result.chartBuffer.subarray(1, 4).toString()).toBe('PNG');
    expect(Object.keys(Chart.instances).length).toBe(count);
  }
});

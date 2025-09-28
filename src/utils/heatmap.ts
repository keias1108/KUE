import { ReactionDiffusionParams } from '../components/AutomataCanvas';

export interface HeatmapAxisConfig {
  key: keyof ReactionDiffusionParams;
  label: string;
  min: number;
  max: number;
  bins: number;
}

export interface HeatmapCell {
  count: number;
  normalized: number;
}

export interface HeatmapData {
  axisX: { label: string; ticks: string[] };
  axisY: { label: string; ticks: string[] };
  grid: HeatmapCell[][];
  total: number;
  max: number;
}

type ParamsCarrier = { params: ReactionDiffusionParams };

const clampIndex = (value: number, maxIndex: number) => {
  if (Number.isNaN(value)) {
    return null;
  }
  if (value < 0) {
    return 0;
  }
  if (value > maxIndex) {
    return maxIndex;
  }
  return Math.min(maxIndex, Math.max(0, Math.floor(value)));
};

const createTicks = (min: number, max: number, bins: number) => {
  if (bins <= 0) {
    return [];
  }
  const step = (max - min) / bins;
  return Array.from({ length: bins }, (_, index) => {
    const center = min + step * (index + 0.5);
    return center >= 1 ? center.toFixed(2) : center.toPrecision(2);
  });
};

export const buildHeatmap = (
  records: ParamsCarrier[],
  axisX: HeatmapAxisConfig,
  axisY: HeatmapAxisConfig,
): HeatmapData | null => {
  if (!records.length) {
    return null;
  }

  const width = axisX.bins;
  const height = axisY.bins;
  if (width <= 0 || height <= 0) {
    return null;
  }

  const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => ({ count: 0, normalized: 0 })));
  let maxCount = 0;
  let total = 0;

  const xRange = axisX.max - axisX.min;
  const yRange = axisY.max - axisY.min;
  if (xRange <= 0 || yRange <= 0) {
    return null;
  }

  records.forEach((record) => {
    const xValue = record.params[axisX.key];
    const yValue = record.params[axisY.key];

    if (typeof xValue !== 'number' || typeof yValue !== 'number') {
      return;
    }

    if (xValue < axisX.min || xValue > axisX.max || yValue < axisY.min || yValue > axisY.max) {
      return;
    }

    const xRatio = (xValue - axisX.min) / xRange;
    const yRatio = (yValue - axisY.min) / yRange;
    const xIndex = clampIndex(xRatio * width, width - 1);
    const yIndex = clampIndex(yRatio * height, height - 1);

    if (xIndex === null || yIndex === null) {
      return;
    }

    const cell = grid[yIndex][xIndex];
    cell.count += 1;
    total += 1;
    if (cell.count > maxCount) {
      maxCount = cell.count;
    }
  });

  if (total === 0 || maxCount === 0) {
    return null;
  }

  const inverseMax = 1 / maxCount;
  grid.forEach((row) => {
    row.forEach((cell) => {
      cell.normalized = cell.count * inverseMax;
    });
  });

  return {
    axisX: { label: axisX.label, ticks: createTicks(axisX.min, axisX.max, axisX.bins) },
    axisY: { label: axisY.label, ticks: createTicks(axisY.min, axisY.max, axisY.bins) },
    grid,
    total,
    max: maxCount,
  };
};

export interface ReactionDiffusionMetrics {
  meanU: number;
  meanV: number;
  stdU: number;
  stdV: number;
  activity: number;
  entropy: number;
}

interface MetricsResult {
  metrics: ReactionDiffusionMetrics;
  snapshot: Float32Array;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export type VitalityCategory = 'balanced' | 'dormant' | 'chaotic' | 'structured';

export interface VitalityAssessment {
  classification: VitalityCategory;
  score: number;
}

export const computeMetrics = (
  buffer: Float32Array,
  width: number,
  height: number,
  previous: Float32Array | null,
): MetricsResult => {
  const texelCount = width * height;
  const invCount = 1 / Math.max(1, texelCount);

  let meanU = 0;
  let meanV = 0;

  for (let index = 0; index < texelCount; index += 1) {
    const offset = index * 4;
    meanU += buffer[offset];
    meanV += buffer[offset + 1];
  }

  meanU *= invCount;
  meanV *= invCount;

  let varianceU = 0;
  let varianceV = 0;
  let activity = 0;

  const histogramBins = 32;
  const histogram = new Array<number>(histogramBins).fill(0);

  for (let index = 0; index < texelCount; index += 1) {
    const offset = index * 4;
    const u = buffer[offset];
    const v = buffer[offset + 1];

    const deltaU = u - meanU;
    const deltaV = v - meanV;
    varianceU += deltaU * deltaU;
    varianceV += deltaV * deltaV;

    if (previous && previous.length === buffer.length) {
      const previousU = previous[offset];
      const previousV = previous[offset + 1];
      activity += Math.abs(u - previousU) + Math.abs(v - previousV);
    }

    const luminance = clamp01(v - u * 0.6);
    const bin = Math.min(histogramBins - 1, Math.floor(luminance * histogramBins));
    histogram[bin] += 1;
  }

  const stdU = Math.sqrt(varianceU * invCount);
  const stdV = Math.sqrt(varianceV * invCount);

  const entropy = histogram.reduce((acc, count) => {
    if (count === 0) {
      return acc;
    }
    const probability = count * invCount;
    return acc - probability * Math.log2(probability);
  }, 0);

  const activityScore = previous ? (activity * invCount) * 0.5 : 0;

  return {
    metrics: {
      meanU,
      meanV,
      stdU,
      stdV,
      activity: activityScore,
      entropy,
    },
    snapshot: buffer,
  };
};

export const assessVitality = (metrics: ReactionDiffusionMetrics): VitalityAssessment => {
  const avgStd = (metrics.stdU + metrics.stdV) * 0.5;
  const activity = metrics.activity;
  const entropy = metrics.entropy;

  let classification: VitalityCategory;
  const structuredCandidate = avgStd > 0.15 || entropy > 0.8;

  if (activity < 0.006) {
    classification = structuredCandidate ? 'structured' : 'dormant';
  } else if (activity > 0.14 || avgStd > 0.32 || entropy > 4.4) {
    classification = 'chaotic';
  } else if (avgStd < 0.03 || entropy < 0.7) {
    classification = 'dormant';
  } else {
    classification = 'balanced';
  }

  let composite: number;
  if (classification === 'structured') {
    const entropyScore = clamp01((entropy - 0.6) / 2.2);
    const textureScore = clamp01((avgStd - 0.15) / 0.25);
    composite = clamp01(0.65 * entropyScore + 0.35 * textureScore);
  } else {
    const activityScore = clamp01((activity - 0.006) / 0.09);
    const entropyScore = 1 - clamp01(Math.abs(entropy - 2.4) / 2.0);
    const stdScore = 1 - clamp01(Math.abs(avgStd - 0.1) / 0.08);
    composite = clamp01(0.5 * activityScore + 0.3 * entropyScore + 0.2 * stdScore);
  }

  return {
    classification,
    score: composite,
  };
};

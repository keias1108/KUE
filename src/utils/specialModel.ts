import specialModel from '../data/special-model.json';
import type { ReactionDiffusionParams } from '../components/AutomataCanvas';
import type { ReactionDiffusionMetrics } from './metrics';

type ModelPayload = {
  features: string[];
  weights: number[];
  bias: number;
  means: number[];
  stds: number[];
};

const model = specialModel as ModelPayload;

const FEATURE_INDEX: Record<string, number> = model.features.reduce<Record<string, number>>(
  (acc, feature, index) => {
    acc[feature] = index;
    return acc;
  },
  {},
);

const logistic = (value: number) => {
  if (value >= 0) {
    const e = Math.exp(-value);
    return 1 / (1 + e);
  }
  const e = Math.exp(value);
  return e / (1 + e);
};

export const estimateSpecialProbability = (
  metrics: ReactionDiffusionMetrics,
  params: ReactionDiffusionParams,
): number => {
  const vector: number[] = new Array(model.features.length).fill(0);
  vector[FEATURE_INDEX.activity] = metrics.activity ?? 0;
  vector[FEATURE_INDEX.entropy] = metrics.entropy ?? 0;
  vector[FEATURE_INDEX.stdU] = metrics.stdU ?? 0;
  vector[FEATURE_INDEX.stdV] = metrics.stdV ?? 0;
  vector[FEATURE_INDEX.feed] = params.feed ?? 0;
  vector[FEATURE_INDEX.kill] = params.kill ?? 0;
  vector[FEATURE_INDEX.threshold] = params.threshold ?? 0;
  vector[FEATURE_INDEX.dt] = params.dt ?? 1;
  vector[FEATURE_INDEX.contrast] = params.contrast ?? 1;
  vector[FEATURE_INDEX.gamma] = params.gamma ?? 1;
  vector[FEATURE_INDEX.invert] = params.invert ? 1 : 0;

  let sum = model.bias;
  for (let index = 0; index < vector.length; index += 1) {
    const std = model.stds[index] || 1;
    const z = (vector[index] - model.means[index]) / std;
    sum += model.weights[index] * z;
  }

  return Math.min(1, Math.max(0, logistic(sum)));
};

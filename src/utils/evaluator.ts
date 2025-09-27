import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer';
import computeShaderSource from '../shaders/compute.glsl?raw';
import { ReactionDiffusionParams } from '../components/AutomataCanvas';
import { computeMetrics, ReactionDiffusionMetrics } from './metrics';

export interface EvaluationOptions {
  resolution?: number;
  iterations?: number;
  sampleInterval?: number;
  onProgress?: (index: number, total: number) => void;
}

export interface EvaluationResult {
  params: ReactionDiffusionParams;
  samples: ReactionDiffusionMetrics[];
  average: ReactionDiffusionMetrics;
}

const defaultOptions: Required<Omit<EvaluationOptions, 'onProgress'>> = {
  resolution: 128,
  iterations: 200,
  sampleInterval: 20,
};

const seedInitialState = (dataTexture: THREE.DataTexture, size: number) => {
  const data = dataTexture.image.data as Float32Array;
  const center = size / 2;
  const radius = size * 0.1;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (x + y * size) * 4;
      const dx = x - center;
      const dy = y - center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const noise = Math.random() * 0.02;
      data[index] = 1 - noise;
      data[index + 1] = distance < radius ? 0.6 + Math.random() * 0.2 : noise;
      data[index + 2] = 0;
      data[index + 3] = 1;
    }
  }

  dataTexture.needsUpdate = true;
};

const averageMetrics = (samples: ReactionDiffusionMetrics[]): ReactionDiffusionMetrics => {
  if (samples.length === 0) {
    return {
      meanU: 0,
      meanV: 0,
      stdU: 0,
      stdV: 0,
      activity: 0,
      entropy: 0,
    };
  }

  const totals = samples.reduce(
    (acc, sample) => {
      acc.meanU += sample.meanU;
      acc.meanV += sample.meanV;
      acc.stdU += sample.stdU;
      acc.stdV += sample.stdV;
      acc.activity += sample.activity;
      acc.entropy += sample.entropy;
      return acc;
    },
    { meanU: 0, meanV: 0, stdU: 0, stdV: 0, activity: 0, entropy: 0 },
  );

  const inv = 1 / samples.length;

  return {
    meanU: totals.meanU * inv,
    meanV: totals.meanV * inv,
    stdU: totals.stdU * inv,
    stdV: totals.stdV * inv,
    activity: totals.activity * inv,
    entropy: totals.entropy * inv,
  };
};

const buildRunner = (resolution: number) => {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  renderer.setPixelRatio(1);
  renderer.setSize(resolution, resolution);

  const gpuCompute = new GPUComputationRenderer(resolution, resolution, renderer);
  const initialTexture = gpuCompute.createTexture();
  seedInitialState(initialTexture, resolution);
  const variable = gpuCompute.addVariable('textureState', computeShaderSource, initialTexture);
  const uniforms = variable.material.uniforms as Record<string, { value: unknown }>;
  uniforms.du = { value: 0 };
  uniforms.dv = { value: 0 };
  uniforms.feed = { value: 0 };
  uniforms.kill = { value: 0 };
  uniforms.dt = { value: 0 };

  gpuCompute.setVariableDependencies(variable, [variable]);
  const error = gpuCompute.init();
  if (error) {
    throw new Error(`GPUComputationRenderer init failed: ${error}`);
  }

  return { renderer, gpuCompute, variable, uniforms };
};

const disposeRunner = (
  renderer: THREE.WebGLRenderer,
  gpuCompute: GPUComputationRenderer & { dispose?: () => void },
) => {
  gpuCompute.dispose?.();
  renderer.dispose();
  renderer.forceContextLoss();
};

const applyParams = (
  uniforms: Record<string, { value: unknown }>,
  params: ReactionDiffusionParams,
) => {
  if (uniforms.du) uniforms.du.value = params.du;
  if (uniforms.dv) uniforms.dv.value = params.dv;
  if (uniforms.feed) uniforms.feed.value = params.feed;
  if (uniforms.kill) uniforms.kill.value = params.kill;
  if (uniforms.dt) uniforms.dt.value = params.dt;
};

const reseedTexture = (
  gpuCompute: GPUComputationRenderer,
  variable: ReturnType<GPUComputationRenderer['addVariable']>,
  resolution: number,
) => {
  const freshTexture = gpuCompute.createTexture();
  seedInitialState(freshTexture, resolution);

  const renderTargets = (variable as unknown as { renderTargets: THREE.WebGLRenderTarget[] }).renderTargets;
  for (let i = 0; i < renderTargets.length; i += 1) {
    gpuCompute.renderTexture(freshTexture, renderTargets[i]);
  }

  freshTexture.dispose?.();
};

export const evaluateParameterSets = async (
  paramsList: ReactionDiffusionParams[],
  options: EvaluationOptions = {},
): Promise<EvaluationResult[]> => {
  const { resolution, iterations, sampleInterval } = { ...defaultOptions, ...options };
  const totalCandidates = paramsList.length;
  const results: EvaluationResult[] = [];

  for (let index = 0; index < paramsList.length; index += 1) {
    const params = paramsList[index];
    options.onProgress?.(index, totalCandidates);

    const { renderer, gpuCompute, variable, uniforms } = buildRunner(resolution);
    applyParams(uniforms, params);

    reseedTexture(gpuCompute, variable, resolution);

    const samples: ReactionDiffusionMetrics[] = [];
    let previousSnapshot: Float32Array | null = null;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      gpuCompute.compute();

      const shouldSample = (iteration + 1) % sampleInterval === 0 || iteration === iterations - 1;
      if (shouldSample) {
        const renderTarget = gpuCompute.getCurrentRenderTarget(variable) as THREE.WebGLRenderTarget;
        const buffer = new Float32Array(resolution * resolution * 4);
        renderer.readRenderTargetPixels(renderTarget, 0, 0, resolution, resolution, buffer);
        const { metrics, snapshot } = computeMetrics(buffer, resolution, resolution, previousSnapshot);
        previousSnapshot = snapshot;
        samples.push(metrics);
      }
    }

    disposeRunner(renderer, gpuCompute);

    results.push({
      params,
      samples,
      average: averageMetrics(samples),
    });

    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  }

  options.onProgress?.(totalCandidates, totalCandidates);
  return results;
};

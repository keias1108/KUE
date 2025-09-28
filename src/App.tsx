import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AutomataCanvas, {
  AutomataCanvasHandle,
  ReactionDiffusionParams,
} from './components/AutomataCanvas';
import RuleControls from './components/RuleControls';
import Codex, { CodexEntry, CodexHandle } from './components/Codex';
import AutoScanResults, {
  AutoScanItem,
  SeedFeedbackEntry,
  SeedFeedbackLabel,
} from './components/AutoScanResults';
import ParameterHeatmap from './components/ParameterHeatmap';
import { evaluateParameterSets } from './utils/evaluator';
import { ReactionDiffusionMetrics, VitalityCategory, assessVitality } from './utils/metrics';
import { estimateSpecialProbability } from './utils/specialModel';
import { buildHeatmap } from './utils/heatmap';

const createDefaultParams = (): ReactionDiffusionParams => ({
  du: 0.16,
  dv: 0.08,
  feed: 0.06,
  kill: 0.062,
  dt: 1.0,
  threshold: 0.2,
  contrast: 1.5,
  gamma: 1.1,
  invert: false,
});

const resolutionOptions = [256, 384, 512, 768, 1024];
const speedOptions = [1, 2, 4, 8];
const TARGET_QUEUE_SIZE = 50;
const MAX_SCAN_BATCHES = 12;
const SCAN_BATCH_SIZE = 6;
const AUTO_SPECIAL_THRESHOLD_DEFAULT = 0.22;
const AUTO_NORMAL_THRESHOLD_DEFAULT = 0.05;

const NORMALIZED_MANUAL_NORMALS = new Set(['manual-2', 'manual-4', 'manual-5']);

const PARAM_RANGES = {
  du: [0.02, 1.0],
  dv: [0.005, 0.4],
  feed: [0.001, 0.12],
  kill: [0.02, 0.08],
  dt: [0.5, 2.0],
  threshold: [0.05, 0.4],
  contrast: [0.8, 5.0],
  gamma: [0.2, 1.5],
} as const;

const GOLDILOCKS_BAND = {
  feed: [0.001, 0.1] as const,
  kill: [0.021, 0.077] as const,
  dt: [1.3, 1.7] as const,
  threshold: [0.16, 0.24] as const,
  contrast: [1.5, 5.0] as const,
  gamma: [0.2, 1.1] as const,
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const randomNormal = () => {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(Math.max(u1, Number.EPSILON))) * Math.cos(2 * Math.PI * u2);
};

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

const createRandomParams = (): ReactionDiffusionParams => ({
  du: randomBetween(0.05, 0.9),
  dv: randomBetween(0.01, 0.28),
  feed: randomBetween(PARAM_RANGES.feed[0], Math.min(0.11, PARAM_RANGES.feed[1])),
  kill: randomBetween(0.025, Math.min(0.078, PARAM_RANGES.kill[1])),
  dt: randomBetween(0.7, 1.8),
  threshold: randomBetween(0.12, 0.32),
  contrast: randomBetween(1.0, 4.0),
  gamma: randomBetween(0.3, 1.4),
  invert: Math.random() < 0.45,
});

interface SeedFeedbackRecord extends SeedFeedbackEntry {
  id: string;
  params: ReactionDiffusionParams;
  metrics: ReactionDiffusionMetrics;
  classification: VitalityCategory;
  score: number;
  source: 'auto-scan' | 'manual' | 'auto-tag';
}

const DEFAULT_FEEDBACK_SEEDS: SeedFeedbackRecord[] = [
  {
    id: 'manual-1',
    label: 'special',
    notedAt: '2025-09-27T23:28:41.000Z',
    params: {
      du: 0.043,
      dv: 0.009,
      feed: 0.001,
      kill: 0.026,
      dt: 2.0,
      threshold: 0.2,
      contrast: 5.0,
      gamma: 0.2,
      invert: false,
    },
    metrics: {
      meanU: 0,
      meanV: 0,
      stdU: 0.272,
      stdV: 0.044,
      activity: 0,
      entropy: 0.21,
    },
    classification: 'structured',
    score: 0.65,
    source: 'manual',
  },
  {
    id: 'manual-2',
    label: 'normal',
    notedAt: '2025-09-27T23:27:48.000Z',
    params: {
      du: 0.043,
      dv: 0.009,
      feed: 0.002,
      kill: 0.021,
      dt: 1.5,
      threshold: 0.2,
      contrast: 5.0,
      gamma: 0.2,
      invert: false,
    },
    metrics: {
      meanU: 0,
      meanV: 0,
      stdU: 0.339,
      stdV: 0.074,
      activity: 0,
      entropy: 0.73,
    },
    classification: 'structured',
    score: 0.72,
    source: 'manual',
  },
  {
    id: 'manual-3',
    label: 'special',
    notedAt: '2025-09-27T23:25:55.000Z',
    params: {
      du: 0.621,
      dv: 0.07,
      feed: 0.003,
      kill: 0.021,
      dt: 1.5,
      threshold: 0.2,
      contrast: 5.0,
      gamma: 0.2,
      invert: false,
    },
    metrics: {
      meanU: 0,
      meanV: 0,
      stdU: 0,
      stdV: 0,
      activity: 0,
      entropy: 0,
    },
    classification: 'structured',
    score: 0.55,
    source: 'manual',
  },
  {
    id: 'manual-4',
    label: 'normal',
    notedAt: '2025-09-27T23:22:05.000Z',
    params: {
      du: 0.722,
      dv: 0.08,
      feed: 0.02,
      kill: 0.056,
      dt: 1.5,
      threshold: 0.16,
      contrast: 5.0,
      gamma: 0.2,
      invert: true,
    },
    metrics: {
      meanU: 0,
      meanV: 0,
      stdU: 0.116,
      stdV: 0.329,
      activity: 0,
      entropy: 2.61,
    },
    classification: 'structured',
    score: 0.88,
    source: 'manual',
  },
  {
    id: 'manual-5',
    label: 'normal',
    notedAt: '2025-09-27T23:19:10.000Z',
    params: {
      du: 0.621,
      dv: 0.07,
      feed: 0.1,
      kill: 0.07,
      dt: 1.5,
      threshold: 0.2,
      contrast: 5.0,
      gamma: 0.2,
      invert: false,
    },
    metrics: {
      meanU: 0,
      meanV: 0,
      stdU: 0.264,
      stdV: 0.25,
      activity: 0,
      entropy: 1.24,
    },
    classification: 'structured',
    score: 0.81,
    source: 'manual',
  },
  {
    id: 'manual-6',
    label: 'special',
    notedAt: '2025-09-27T23:16:49.000Z',
    params: {
      du: 0.547,
      dv: 0.089,
      feed: 0.084,
      kill: 0.077,
      dt: 1.5,
      threshold: 0.2,
      contrast: 5.0,
      gamma: 0.2,
      invert: false,
    },
    metrics: {
      meanU: 0,
      meanV: 0,
      stdU: 0.201,
      stdV: 0.169,
      activity: 0,
      entropy: 0.6,
    },
    classification: 'structured',
    score: 0.7,
    source: 'manual',
  },
  {
    id: 'manual-7',
    label: 'special',
    notedAt: '2025-09-27T23:13:46.000Z',
    params: {
      du: 1.0,
      dv: 0.306,
      feed: 0.023,
      kill: 0.06,
      dt: 1.0,
      threshold: 0.2,
      contrast: 1.5,
      gamma: 1.1,
      invert: false,
    },
    metrics: {
      meanU: 0,
      meanV: 0,
      stdU: 0.123,
      stdV: 0.125,
      activity: 0,
      entropy: 1.35,
    },
    classification: 'structured',
    score: 0.78,
    source: 'manual',
  },
  {
    id: 'manual-8',
    label: 'special',
    notedAt: '2025-09-27T23:06:48.000Z',
    params: {
      du: 1.0,
      dv: 0.266,
      feed: 0.1,
      kill: 0.054,
      dt: 1.0,
      threshold: 0.2,
      contrast: 1.5,
      gamma: 1.1,
      invert: false,
    },
    metrics: {
      meanU: 0,
      meanV: 0,
      stdU: 0.208,
      stdV: 0.14,
      activity: 0,
      entropy: 0.84,
    },
    classification: 'structured',
    score: 0.69,
    source: 'manual',
  },
  {
    id: 'manual-9',
    label: 'special',
    notedAt: '2025-09-27T23:19:56.000Z',
    params: {
      du: 0.041,
      dv: 0.028,
      feed: 0.015,
      kill: 0.044,
      dt: 2.0,
      threshold: 0.21,
      contrast: 2.45,
      gamma: 0.4,
      invert: false,
    },
    metrics: {
      meanU: 0,
      meanV: 0,
      stdU: 0.262,
      stdV: 0.074,
      activity: 0,
      entropy: 0.34,
    },
    classification: 'structured',
    score: 0.67,
    source: 'manual',
  },
];

interface SeedFeedbackRecord extends SeedFeedbackEntry {
  id: string;
  params: ReactionDiffusionParams;
  metrics: ReactionDiffusionMetrics;
  classification: VitalityCategory;
  score: number;
  source: 'auto-scan' | 'manual' | 'auto-tag';
}

const mapFeedbackSummary = (
  records: Record<string, SeedFeedbackRecord>,
): Record<string, SeedFeedbackEntry> =>
  Object.entries(records).reduce<Record<string, SeedFeedbackEntry>>((acc, [id, entry]) => {
    acc[id] = {
      label: entry.label,
      notedAt: entry.notedAt,
      note: entry.note,
    };
    return acc;
  }, {});

const App: React.FC = () => {
  const [params, setParams] = useState<ReactionDiffusionParams>(() => createDefaultParams());
  const [resolution, setResolution] = useState<number>(512);
  const [isRunning, setIsRunning] = useState<boolean>(true);
const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
const [autoScanState, setAutoScanState] = useState<{
    running: boolean;
    progress: number;
    results: AutoScanItem[];
  }>(() => ({ running: false, progress: 0, results: [] }));
const canvasRef = useRef<AutomataCanvasHandle>(null);
const codexRef = useRef<CodexHandle>(null);
const canvasSectionRef = useRef<HTMLDivElement>(null);
  const [codexEntries, setCodexEntries] = useState<CodexEntry[]>([]);
  const [specialFilterState, setSpecialFilterState] = useState<{
    enabled: boolean;
    threshold: number;
  }>({ enabled: false, threshold: 0.2 });

  const [autoTagState, setAutoTagState] = useState({
    enabled: true,
    specialThreshold: AUTO_SPECIAL_THRESHOLD_DEFAULT,
    normalThreshold: AUTO_NORMAL_THRESHOLD_DEFAULT,
  });
  const [focusUndecidedOnly, setFocusUndecidedOnly] = useState(false);
  const FEEDBACK_STORAGE_KEY = 'personal-universe-feedback';
  const createInitialFeedback = () => {
    const base = DEFAULT_FEEDBACK_SEEDS.reduce<Record<string, SeedFeedbackRecord>>((acc, entry) => {
      const normalized = NORMALIZED_MANUAL_NORMALS.has(entry.id)
        ? { ...entry, label: 'normal' as SeedFeedbackLabel }
        : entry;
      acc[normalized.id] = normalized;
      return acc;
    }, {});

    if (typeof window === 'undefined') {
      return base;
    }

    try {
      const raw = window.localStorage.getItem(FEEDBACK_STORAGE_KEY);
      if (!raw) {
        return base;
      }
      const parsed = JSON.parse(raw) as Array<SeedFeedbackRecord & { id: string }>;
      return parsed.reduce<Record<string, SeedFeedbackRecord>>((acc, entry) => {
        const normalized = NORMALIZED_MANUAL_NORMALS.has(entry.id)
          ? { ...entry, label: 'normal' as SeedFeedbackLabel }
          : entry;
        acc[normalized.id] = { ...normalized };
        return acc;
      }, base);
    } catch (error) {
      console.warn('failed to parse feedback store', error);
      return base;
    }
  };

  const [seedFeedback, setSeedFeedback] = useState<Record<string, SeedFeedbackRecord>>(createInitialFeedback);

  useEffect(() => {
    setSeedFeedback((prev) => {
      const next = { ...prev };
      const codexIds = new Set(codexEntries.map((entry) => `codex-${entry.id}`));

      Object.keys(next).forEach((id) => {
        if (id.startsWith('codex-') && !codexIds.has(id)) {
          delete next[id];
        }
      });

      codexEntries.forEach((entry) => {
        const id = `codex-${entry.id}`;
        const metrics = entry.metrics ?? {
          meanU: 0,
          meanV: 0,
          stdU: 0,
          stdV: 0,
          activity: 0,
          entropy: 0,
        };
        const vitality = assessVitality(metrics);
        next[id] = {
          id,
          label: 'special',
          notedAt: entry.savedAt,
          params: entry.params,
          metrics,
          classification: vitality.classification,
          score: vitality.score,
          source: 'manual',
          note: entry.note,
        };
      });

      return next;
    });
  }, [codexEntries]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const serialized = JSON.stringify(Object.values(seedFeedback));
    window.localStorage.setItem(FEEDBACK_STORAGE_KEY, serialized);
  }, [seedFeedback]);

  const scrollCanvasIntoView = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const element = canvasSectionRef.current;
    if (!element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const currentScroll = window.scrollY || window.pageYOffset;
    const headerSlack = 110;
    const target = Math.max(currentScroll + rect.top - headerSlack, 0);
    window.scrollTo({ top: target, behavior: 'smooth' });
  }, []);

  const handleParamsChange = (next: ReactionDiffusionParams) => {
    setParams(next);
  };

  const handleResolutionChange = (next: number) => {
    setResolution(next);
  };

  const handleSpeedChange = (next: number) => {
    setSimulationSpeed(next);
  };

  const handleToggleRun = () => {
    setIsRunning((prev) => !prev);
  };

  const handleSnapshot = () => {
    const dataUrl = canvasRef.current?.capture();
    if (!dataUrl) {
      return;
    }
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `personal-universe-${Date.now()}.png`;
    link.click();
  };

  const handleReset = () => {
    setParams(createDefaultParams());
    canvasRef.current?.resetState();
  };

  const handleLoadEntry = (entry: CodexEntry) => {
    setParams(entry.params);
    setResolution(entry.resolution);
    setIsRunning(false);
    canvasRef.current?.resetState();
    scrollCanvasIntoView();
  };

  const normalizeAutoScanItem = useCallback(
    (item: AutoScanItem): AutoScanItem => {
      const vitalityScore =
        typeof item.vitalityScore === 'number' ? item.vitalityScore : assessVitality(item.metrics).score;
      const specialLikelihood =
        typeof item.specialLikelihood === 'number'
          ? item.specialLikelihood
          : estimateSpecialProbability(item.metrics, item.params);
      const blendedScore = 0.7 * vitalityScore + 0.3 * specialLikelihood;
      return {
        ...item,
        vitalityScore,
        specialLikelihood,
        score: blendedScore,
      };
    },
    [],
  );

  const passesFilter = useCallback(
    (item: AutoScanItem) =>
      !specialFilterState.enabled || (item.specialLikelihood ?? 0) >= specialFilterState.threshold,
    [specialFilterState.enabled, specialFilterState.threshold],
  );

  const sampleGoldilocks = useCallback((): ReactionDiffusionParams => {
    const jittered = (range: readonly [number, number], jitter = 0.15) => {
      const span = range[1] - range[0];
      if (span <= 0) {
        return range[0];
      }
      const base = randomBetween(range[0], range[1]);
      const offset = randomNormal() * span * jitter;
      return clamp(base + offset, range[0], range[1]);
    };

    return {
      du: clamp(randomBetween(0.04, 0.95), PARAM_RANGES.du[0], PARAM_RANGES.du[1]),
      dv: clamp(randomBetween(0.009, 0.32), PARAM_RANGES.dv[0], PARAM_RANGES.dv[1]),
      feed: jittered(GOLDILOCKS_BAND.feed, 0.1),
      kill: jittered(GOLDILOCKS_BAND.kill, 0.1),
      dt: clamp(jittered(GOLDILOCKS_BAND.dt, 0.25), PARAM_RANGES.dt[0], PARAM_RANGES.dt[1]),
      threshold: clamp(jittered(GOLDILOCKS_BAND.threshold, 0.35), PARAM_RANGES.threshold[0], PARAM_RANGES.threshold[1]),
      contrast: clamp(jittered(GOLDILOCKS_BAND.contrast, 0.2), PARAM_RANGES.contrast[0], PARAM_RANGES.contrast[1]),
      gamma: clamp(jittered(GOLDILOCKS_BAND.gamma, 0.25), PARAM_RANGES.gamma[0], PARAM_RANGES.gamma[1]),
      invert: Math.random() > 0.18 ? false : Math.random() < 0.5,
    };
  }, []);

  const sampleAround = useCallback((params: ReactionDiffusionParams): ReactionDiffusionParams => {
    const scale = 0.12; // perturbation scale relative to parameter range
    return {
      du: clamp(
        params.du + randomNormal() * (PARAM_RANGES.du[1] - PARAM_RANGES.du[0]) * scale,
        PARAM_RANGES.du[0],
        PARAM_RANGES.du[1],
      ),
      dv: clamp(
        params.dv + randomNormal() * (PARAM_RANGES.dv[1] - PARAM_RANGES.dv[0]) * scale,
        PARAM_RANGES.dv[0],
        PARAM_RANGES.dv[1],
      ),
      feed: clamp(
        params.feed + randomNormal() * (PARAM_RANGES.feed[1] - PARAM_RANGES.feed[0]) * scale,
        PARAM_RANGES.feed[0],
        PARAM_RANGES.feed[1],
      ),
      kill: clamp(
        params.kill + randomNormal() * (PARAM_RANGES.kill[1] - PARAM_RANGES.kill[0]) * scale,
        PARAM_RANGES.kill[0],
        PARAM_RANGES.kill[1],
      ),
      dt: clamp(
        params.dt + randomNormal() * (PARAM_RANGES.dt[1] - PARAM_RANGES.dt[0]) * scale,
        PARAM_RANGES.dt[0],
        PARAM_RANGES.dt[1],
      ),
      threshold: clamp(
        params.threshold + randomNormal() * (PARAM_RANGES.threshold[1] - PARAM_RANGES.threshold[0]) * scale,
        PARAM_RANGES.threshold[0],
        PARAM_RANGES.threshold[1],
      ),
      contrast: clamp(
        params.contrast + randomNormal() * (PARAM_RANGES.contrast[1] - PARAM_RANGES.contrast[0]) * scale,
        PARAM_RANGES.contrast[0],
        PARAM_RANGES.contrast[1],
      ),
      gamma: clamp(
        params.gamma + randomNormal() * (PARAM_RANGES.gamma[1] - PARAM_RANGES.gamma[0]) * scale,
        PARAM_RANGES.gamma[0],
        PARAM_RANGES.gamma[1],
      ),
      invert: Math.random() < 0.7 ? params.invert : Math.random() < 0.5,
    };
  }, []);

  const generateCandidateParams = useCallback((): ReactionDiffusionParams => {
    const specials = DEFAULT_FEEDBACK_SEEDS.filter((seed) => seed.label === 'special').concat(
      Object.values(seedFeedback).filter((entry) => entry.label === 'special'),
    );
    const sampleRoll = Math.random();

    if (sampleRoll < 0.5) {
      return sampleGoldilocks();
    }

    if (specials.length >= 5 && sampleRoll < 0.85) {
      const base = specials[Math.floor(Math.random() * specials.length)];
      if (base) {
        return sampleAround(base.params);
      }
    }
    return createRandomParams();
  }, [sampleAround, sampleGoldilocks, seedFeedback]);

  const autoTagItem = useCallback(
    (item: AutoScanItem) => {
      if (!autoTagState.enabled) {
        return;
      }
      const likelihood = item.specialLikelihood ?? estimateSpecialProbability(item.metrics, item.params);
      const label: SeedFeedbackLabel | null =
        likelihood >= autoTagState.specialThreshold
          ? 'special'
          : likelihood <= autoTagState.normalThreshold
            ? 'normal'
            : null;
      if (!label) {
        return;
      }
      setSeedFeedback((prev) => {
        const existing = prev[item.id];
        if (existing && existing.source !== 'auto-tag') {
          return prev;
        }
        if (existing && existing.label === label && existing.source === 'auto-tag') {
          return prev;
        }
        return {
          ...prev,
          [item.id]: {
            id: item.id,
            label,
            notedAt: new Date().toISOString(),
            params: item.params,
            metrics: item.metrics,
            classification: item.classification,
            score: item.score,
            source: 'auto-tag',
            note: existing?.note,
          },
        };
      });
    },
    [autoTagState.enabled, autoTagState.normalThreshold, autoTagState.specialThreshold],
  );

  const handleAutoScan = useCallback(async () => {
    if (autoScanState.running) {
      return;
    }

    const existingNormalized = autoScanState.results.map((item) => normalizeAutoScanItem(item));
    const initialVisible = existingNormalized.filter(passesFilter).length;
    if (initialVisible >= TARGET_QUEUE_SIZE) {
      setAutoScanState((prev) => ({ ...prev, running: false, progress: 1, results: existingNormalized }));
      return;
    }

    const requiredBatches = Math.max(
      1,
      Math.ceil((TARGET_QUEUE_SIZE - initialVisible) / SCAN_BATCH_SIZE),
    );

    setAutoScanState((prev) => ({ ...prev, running: true, progress: 0, results: existingNormalized }));

    let combinedResults = [...existingNormalized];
    let visibleCount = initialVisible;

    for (let batchIndex = 0; batchIndex < Math.min(requiredBatches, MAX_SCAN_BATCHES); batchIndex += 1) {
      const candidates = Array.from({ length: SCAN_BATCH_SIZE }, () => generateCandidateParams());
      // eslint-disable-next-line no-await-in-loop
      const results = await evaluateParameterSets(candidates, {
        resolution: 128,
        iterations: 240,
        sampleInterval: 40,
        onProgress: (index, total) => {
          if (total === 0) {
            return;
          }
          const fraction = (batchIndex + index / total) / requiredBatches;
          setAutoScanState((prev) => ({ ...prev, progress: Math.min(1, fraction) }));
        },
      });

      const timestamp = Date.now();
      const normalizedBatch = results.map<AutoScanItem>((entry, idx) => {
        const vitality = assessVitality(entry.average);
        return normalizeAutoScanItem({
          id: `${timestamp}-${batchIndex}-${idx}`,
          params: entry.params,
          metrics: entry.average,
          classification: vitality.classification,
          vitalityScore: vitality.score,
          specialLikelihood: estimateSpecialProbability(entry.average, entry.params),
          score: vitality.score,
        });
      });

      combinedResults = [...combinedResults, ...normalizedBatch].sort((a, b) => b.score - a.score);
      visibleCount = combinedResults.filter(passesFilter).length;

      normalizedBatch.forEach(autoTagItem);

      if (visibleCount >= TARGET_QUEUE_SIZE) {
        break;
      }
    }

    setAutoScanState({ running: false, progress: 1, results: combinedResults });
  }, [
    assessVitality,
    autoScanState.results,
    autoScanState.running,
    autoTagItem,
    generateCandidateParams,
    normalizeAutoScanItem,
    passesFilter,
  ]);

  const requestMetrics = useCallback(() => canvasRef.current?.collectMetrics() ?? null, []);

  const handleReplaySeed = useCallback(
    (item: AutoScanItem) => {
      setParams(item.params);
      setIsRunning(true);
      canvasRef.current?.resetState();
      scrollCanvasIntoView();
    },
    [scrollCanvasIntoView],
  );

  const handleAdoptSeed = useCallback(
    (item: AutoScanItem) => {
      setParams(item.params);
      setIsRunning(false);
      canvasRef.current?.resetState();
      setAutoScanState((prev) => ({
        ...prev,
        results: prev.results.filter((entry) => entry.id !== item.id),
      }));

      const entry: CodexEntry = {
        id: `${Date.now()}-${item.id}`,
        name: `Auto Seed ${item.id.slice(-4)}`,
        params: { ...item.params },
        resolution,
        savedAt: new Date().toISOString(),
        metrics: item.metrics,
      };
      codexRef.current?.addEntry(entry);
    },
    [resolution],
  );

  const handleDiscardSeed = useCallback((id: string) => {
    setAutoScanState((prev) => ({
      ...prev,
      results: prev.results.filter((entry) => entry.id !== id),
    }));
  }, []);

  const handleLabelSeed = useCallback((item: AutoScanItem, label: SeedFeedbackLabel) => {
    setSeedFeedback((prev) => {
      const existing = prev[item.id];
      return {
        ...prev,
        [item.id]: {
          id: item.id,
          label,
          notedAt: new Date().toISOString(),
          params: item.params,
          metrics: item.metrics,
          classification: item.classification,
          score: item.score,
          source: 'auto-scan',
          note: existing?.note,
        },
      };
    });
  }, []);

  const handleExportFeedback = useCallback(() => {
    if (Object.keys(seedFeedback).length === 0) {
      return;
    }
    const snapshot = Object.values(seedFeedback);
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seed-feedback-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [seedFeedback]);

  const feedbackSummary = useMemo(() => mapFeedbackSummary(seedFeedback), [seedFeedback]);

  const manualSpecialRecords = useMemo(
    () => Object.values(seedFeedback).filter((entry) => entry.source === 'manual' && entry.label === 'special'),
    [seedFeedback],
  );

  const handleCodexEntriesChange = useCallback((entries: CodexEntry[]) => {
    setCodexEntries(entries);
  }, []);

  const taggedSpecialRecords = useMemo(
    () => Object.values(seedFeedback).filter((entry) => entry.label === 'special'),
    [seedFeedback],
  );

  const manualSpecialHeatmap = useMemo(
    () =>
      buildHeatmap(
        manualSpecialRecords,
        { key: 'feed', label: 'feed', min: GOLDILOCKS_BAND.feed[0], max: GOLDILOCKS_BAND.feed[1], bins: 6 },
        { key: 'kill', label: 'kill', min: GOLDILOCKS_BAND.kill[0], max: GOLDILOCKS_BAND.kill[1], bins: 6 },
      ),
    [manualSpecialRecords],
  );

  const contrastGammaHeatmap = useMemo(
    () =>
      buildHeatmap(
        taggedSpecialRecords,
        { key: 'contrast', label: 'contrast', min: GOLDILOCKS_BAND.contrast[0], max: GOLDILOCKS_BAND.contrast[1], bins: 6 },
        { key: 'gamma', label: 'gamma', min: GOLDILOCKS_BAND.gamma[0], max: GOLDILOCKS_BAND.gamma[1], bins: 6 },
      ),
    [taggedSpecialRecords],
  );

  const manualSpecialCount = manualSpecialRecords.length;
  const taggedSpecialCount = taggedSpecialRecords.length;
  const manualHeatmapNote = manualSpecialHeatmap
    ? `feed ${GOLDILOCKS_BAND.feed[0].toFixed(3)}~${GOLDILOCKS_BAND.feed[1].toFixed(3)} · kill ${GOLDILOCKS_BAND.kill[0].toFixed(3)}~${GOLDILOCKS_BAND.kill[1].toFixed(3)}`
    : undefined;
  const contrastGammaNote = contrastGammaHeatmap
    ? `contrast ${GOLDILOCKS_BAND.contrast[0].toFixed(1)}~${GOLDILOCKS_BAND.contrast[1].toFixed(1)} · gamma ${GOLDILOCKS_BAND.gamma[0].toFixed(1)}~${GOLDILOCKS_BAND.gamma[1].toFixed(1)}`
    : undefined;

  const visibleAutoScanResults = useMemo(() => {
    if (focusUndecidedOnly) {
      return autoScanState.results.filter((item) => {
        const likelihood = item.specialLikelihood ?? estimateSpecialProbability(item.metrics, item.params);
        return likelihood > autoTagState.normalThreshold && likelihood < autoTagState.specialThreshold;
      });
    }
    if (specialFilterState.enabled) {
      return autoScanState.results.filter((item) => passesFilter(item));
    }
    return autoScanState.results;
  }, [
    autoScanState.results,
    autoTagState.normalThreshold,
    autoTagState.specialThreshold,
    focusUndecidedOnly,
    passesFilter,
    specialFilterState.enabled,
  ]);

  useEffect(() => {
    if (!autoTagState.enabled) {
      return;
    }
    autoScanState.results.forEach(autoTagItem);
  }, [autoScanState.results, autoTagItem, autoTagState.enabled, autoTagState.normalThreshold, autoTagState.specialThreshold]);

  const handleToggleSpecialFilter = () => {
    setFocusUndecidedOnly(false);
    setSpecialFilterState((prev) => ({ ...prev, enabled: !prev.enabled }));
  };

  const handleSpecialThresholdChange = (value: number) => {
    setSpecialFilterState((prev) => ({ ...prev, threshold: value }));
  };

  return (
    <div className="flex min-h-screen w-screen flex-col bg-gradient-to-br from-slate-950 via-slate-930 to-slate-900 text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] flex-row flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-indigo-100">
              Personal Universe Engine — MVP
            </h1>
            <p className="text-sm text-slate-400">
              GPU-powered Gray–Scott reaction-diffusion laboratory in your browser.
            </p>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2 overflow-x-auto">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleRun}
                className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300 ${
                  isRunning
                    ? 'bg-rose-500/90 text-white shadow-rose-900/60 hover:bg-rose-400'
                    : 'bg-emerald-500/90 text-white shadow-emerald-900/60 hover:bg-emerald-400'
                }`}
              >
                {isRunning ? 'Pause' : 'Run'}
              </button>
              <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
                <span className="uppercase tracking-wide text-[10px] text-slate-500">Speed</span>
                <select
                  value={simulationSpeed}
                  onChange={(event) => handleSpeedChange(Number(event.target.value))}
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:border-indigo-400 focus:outline-none"
                >
                  {speedOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}×
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={handleSnapshot}
                className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/60 transition hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300"
              >
                Snapshot PNG
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg bg-indigo-500/20 px-4 py-2 text-sm font-semibold text-indigo-100 shadow-lg shadow-indigo-900/50 transition hover:bg-indigo-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300"
              >
                Reset DNA
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-indigo-500/40 bg-slate-900/80 px-3 py-2 text-sm font-medium text-indigo-200 shadow shadow-indigo-900/60">
                Automated Seeds · {autoScanState.results.length}
              </span>
              <button
                type="button"
                onClick={handleAutoScan}
                disabled={autoScanState.running}
                className={`w-full rounded-lg bg-indigo-600/80 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/60 transition hover:bg-indigo-500 sm:w-auto ${
                  autoScanState.running ? 'cursor-wait opacity-70' : ''
                }`}
              >
                {autoScanState.running
                  ? `Scanning… ${Math.round(autoScanState.progress * 100)}%`
                  : 'Scan 6 Seeds'}
              </button>
              {autoScanState.running ? (
                <span className="w-full text-left text-xs font-mono text-indigo-300 sm:w-auto sm:text-right">
                  progress {Math.round(autoScanState.progress * 100)}%
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-[1600px] gap-6 lg:grid-cols-[minmax(0,_3fr)_minmax(320px,_1fr)]">
          <section
            ref={canvasSectionRef}
            className="flex flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/85 p-4 shadow-2xl shadow-slate-950/60"
          >
            <div className="relative flex w-full justify-center">
              <div className="aspect-square w-full max-w-[min(100%,_85vh)]">
                <AutomataCanvas
                  ref={canvasRef}
                  params={params}
                  resolution={resolution}
                  isRunning={isRunning}
                  stepsPerFrame={simulationSpeed}
                />
              </div>
              <div className="pointer-events-none absolute right-4 top-4 rounded-full border border-indigo-500/50 bg-indigo-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-100 shadow-lg shadow-indigo-900/60">
                {isRunning ? 'Simulating' : 'Paused'}
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-6">
            <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/85 p-4 shadow-xl shadow-slate-950/40">
              <div className="mb-4">
                <p className="text-xs uppercase tracking-wide text-indigo-300">Controls</p>
                <h2 className="text-lg font-semibold text-slate-100">Rule Panel</h2>
              </div>
              <div className="max-h-[380px] overflow-y-auto pr-1">
                <RuleControls
                  params={params}
                  onParamsChange={handleParamsChange}
                  resolution={resolution}
                  resolutionOptions={resolutionOptions}
                  onResolutionChange={handleResolutionChange}
                />
              </div>
            </section>

            <section className="flex flex-col overflow-hidden rounded-2xl border border-indigo-800/60 bg-slate-900/85 p-4 shadow-xl shadow-indigo-950/40">
              <div className="mb-4">
                <p className="text-xs uppercase tracking-wide text-indigo-300">Automated Seeds</p>
                <h2 className="text-lg font-semibold text-indigo-100">Queue</h2>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-indigo-200/80">
                    사용자 태깅 데이터를 모아 황금값 탐색을 계속 정교화하세요.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2">
                      <label className="flex items-center gap-2 text-[11px] font-semibold text-sky-100">
                        <input
                          type="checkbox"
                          checked={specialFilterState.enabled}
                          onChange={handleToggleSpecialFilter}
                          className="h-3 w-3 rounded border-sky-500/70 bg-slate-900 text-sky-400 focus:ring-sky-500"
                        />
                        특이도 필터
                      </label>
                      <div className="flex items-center gap-1 text-[10px] text-sky-200">
                        <span>{specialFilterState.threshold.toFixed(2)}</span>
                        <input
                          type="range"
                          min={0}
                          max={0.5}
                          step={0.01}
                          value={specialFilterState.threshold}
                          onChange={(event) => handleSpecialThresholdChange(parseFloat(event.target.value))}
                          disabled={!specialFilterState.enabled}
                          className="h-1 w-20 cursor-pointer accent-sky-400"
                        />
                      </div>
                      </div>
                    <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                      <label className="flex items-center gap-2 text-[11px] font-semibold text-amber-100">
                        <input
                          type="checkbox"
                          checked={focusUndecidedOnly}
                          onChange={() => {
                            setSpecialFilterState((prev) => ({ ...prev, enabled: false }));
                            setFocusUndecidedOnly((prev) => !prev);
                          }}
                          className="h-3 w-3 rounded border-amber-500/70 bg-slate-900 text-amber-400 focus:ring-amber-500"
                        />
                        헷갈리는 구간만 보기
                      </label>
                      <span className="text-[10px] text-amber-200">
                        {autoTagState.normalThreshold.toFixed(2)}{' < likelihood < '}
                        {autoTagState.specialThreshold.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                      <label className="flex items-center gap-2 text-[11px] font-semibold text-emerald-100">
                        <input
                          type="checkbox"
                          checked={autoTagState.enabled}
                          onChange={() => setAutoTagState((prev) => ({ ...prev, enabled: !prev.enabled }))}
                          className="h-3 w-3 rounded border-emerald-500/70 bg-slate-900 text-emerald-400 focus:ring-emerald-500"
                        />
                        자동 태깅
                      </label>
                      <div className="flex flex-col gap-1 text-[10px] text-emerald-200">
                        <label className="flex items-center gap-1">
                          <span>특이 ≥ {autoTagState.specialThreshold.toFixed(2)}</span>
                          <input
                            type="range"
                            min={0.1}
                            max={0.6}
                            step={0.01}
                            value={autoTagState.specialThreshold}
                            onChange={(event) =>
                              setAutoTagState((prev) => ({
                                ...prev,
                                specialThreshold: parseFloat(event.target.value),
                              }))
                            }
                            disabled={!autoTagState.enabled}
                            className="h-1 w-20 cursor-pointer accent-emerald-400"
                          />
                        </label>
                        <label className="flex items-center gap-1">
                          <span>평범 ≤ {autoTagState.normalThreshold.toFixed(2)}</span>
                          <input
                            type="range"
                            min={0}
                            max={0.2}
                            step={0.01}
                            value={autoTagState.normalThreshold}
                            onChange={(event) =>
                              setAutoTagState((prev) => ({
                                ...prev,
                                normalThreshold: parseFloat(event.target.value),
                              }))
                            }
                            disabled={!autoTagState.enabled}
                            className="h-1 w-20 cursor-pointer accent-emerald-400"
                          />
                        </label>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportFeedback}
                      disabled={Object.keys(seedFeedback).length === 0}
                      className={`rounded-lg border px-3 py-1 text-[11px] font-semibold transition ${
                        Object.keys(seedFeedback).length === 0
                          ? 'cursor-not-allowed border-slate-700 text-slate-500'
                          : 'border-sky-500/50 text-sky-100 hover:bg-sky-500/10'
                      }`}
                    >
                      태깅 데이터 내보내기
                    </button>
                  </div>
                </div>
                <div className="max-h-[320px] overflow-y-auto pr-1">
                  <AutoScanResults
                    items={visibleAutoScanResults}
                    onAdopt={handleAdoptSeed}
                    onDiscard={handleDiscardSeed}
                    onReplay={handleReplaySeed}
                    onLabel={handleLabelSeed}
                    feedback={feedbackSummary}
                    isProcessing={autoScanState.running}
                    filterEnabled={specialFilterState.enabled}
                    specialThreshold={specialFilterState.threshold}
                    className="border-none bg-transparent p-0 shadow-none"
                    title=""
                    subtitle=""
                  />
                </div>
              </div>
            </section>

            <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/90 p-4 shadow-inner shadow-slate-950/60">
              <div className="mb-3">
                <p className="text-[11px] uppercase tracking-wide text-indigo-200">Saved DNA</p>
                <h3 className="text-base font-semibold text-slate-100">Codex</h3>
              </div>
              <div className="max-h-[320px] overflow-y-auto pr-1">
                <Codex
                  ref={codexRef}
                  currentParams={params}
                  currentResolution={resolution}
                  onLoad={handleLoadEntry}
                  requestMetrics={requestMetrics}
                  onEntriesChange={handleCodexEntriesChange}
                />
              </div>
            </section>
          </div>
        </div>

        <div className="mx-auto mt-6 w-full max-w-[1600px]">
          <div className="grid gap-4 lg:grid-cols-2">
            <ParameterHeatmap
              title="Manual Special 분포"
              subtitle={`manual special ${manualSpecialCount}건 기준 feed × kill`}
              highlightNote={manualHeatmapNote}
              data={manualSpecialHeatmap}
            />
            <ParameterHeatmap
              title="Special 대비·감마"
              subtitle={`special 태그 ${taggedSpecialCount}건 기준 contrast × gamma`}
              highlightNote={contrastGammaNote}
              data={contrastGammaHeatmap}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;

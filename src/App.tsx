import React, { useCallback, useRef, useState } from 'react';
import AutomataCanvas, {
  AutomataCanvasHandle,
  ReactionDiffusionParams,
} from './components/AutomataCanvas';
import RuleControls from './components/RuleControls';
import Codex, { CodexEntry, CodexHandle } from './components/Codex';
import AutoScanResults, { AutoScanItem } from './components/AutoScanResults';
import { evaluateParameterSets } from './utils/evaluator';
import { assessVitality } from './utils/metrics';

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

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

const createRandomParams = (): ReactionDiffusionParams => ({
  du: randomBetween(0.08, 0.25),
  dv: randomBetween(0.04, 0.18),
  feed: randomBetween(0.02, 0.08),
  kill: randomBetween(0.03, 0.08),
  dt: randomBetween(0.5, 1.5),
  threshold: randomBetween(0.1, 0.4),
  contrast: randomBetween(1.0, 2.5),
  gamma: randomBetween(0.7, 1.5),
  invert: Math.random() < 0.5,
});

const App: React.FC = () => {
  const [params, setParams] = useState<ReactionDiffusionParams>(() => createDefaultParams());
  const [resolution, setResolution] = useState<number>(512);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [autoScanState, setAutoScanState] = useState<{
    running: boolean;
    progress: number;
    results: AutoScanItem[];
  }>(() => ({ running: false, progress: 0, results: [] }));
  const canvasRef = useRef<AutomataCanvasHandle>(null);
  const codexRef = useRef<CodexHandle>(null);
  const canvasSectionRef = useRef<HTMLDivElement>(null);

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

  const handleAutoScan = useCallback(async () => {
    if (autoScanState.running) {
      return;
    }

    const candidates = Array.from({ length: 6 }, () => createRandomParams());
    setAutoScanState((prev) => ({ ...prev, running: true, progress: 0 }));

    const results = await evaluateParameterSets(candidates, {
      resolution: 128,
      iterations: 240,
      sampleInterval: 40,
      onProgress: (index, total) => {
        if (total === 0) {
          return;
        }
        setAutoScanState((prev) => ({ ...prev, progress: index / total }));
      },
    });

    const timestamp = Date.now();
    const newEntries = results.map<AutoScanItem>((entry, idx) => {
      const vitality = assessVitality(entry.average);
      return {
        id: `${timestamp}-${idx}`,
        params: entry.params,
        metrics: entry.average,
        classification: vitality.classification,
        score: vitality.score,
      };
    });

    setAutoScanState((prev) => ({
      running: false,
      progress: 1,
      results: [...prev.results, ...newEntries].sort((a, b) => b.score - a.score),
    }));
  }, [autoScanState.running]);

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Personal Universe Engine — MVP
            </h1>
            <p className="text-sm text-slate-400">
              GPU-powered Gray–Scott reaction-diffusion laboratory in your browser.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSnapshot}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow shadow-indigo-900/60 transition hover:bg-indigo-400"
            >
              Snapshot PNG
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Reset DNA
            </button>
            <button
              type="button"
              onClick={handleAutoScan}
              disabled={autoScanState.running}
              className={`rounded-lg border border-indigo-500 px-4 py-2 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/10 ${
                autoScanState.running ? 'cursor-wait opacity-70' : ''
              }`}
            >
              {autoScanState.running
                ? `Scanning… ${Math.round(autoScanState.progress * 100)}%`
                : 'Scan 6 Seeds'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-6 lg:grid lg:grid-cols-[2fr,1fr]">
        <section
          ref={canvasSectionRef}
          className="mb-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg shadow-slate-950/60 lg:sticky lg:top-24 lg:mb-0"
        >
          <div className="relative aspect-square w-full">
            <AutomataCanvas
              ref={canvasRef}
              params={params}
              resolution={resolution}
              isRunning={isRunning}
            />
            <div className="pointer-events-none absolute right-4 top-4 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs font-medium text-slate-300 shadow-lg shadow-slate-950/50">
              {isRunning ? 'Simulating' : 'Paused'}
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <AutoScanResults
            items={autoScanState.results}
            onAdopt={handleAdoptSeed}
            onDiscard={handleDiscardSeed}
            onReplay={handleReplaySeed}
            isProcessing={autoScanState.running}
            className="lg:max-h-[60vh] lg:overflow-y-auto"
          />
          <RuleControls
            params={params}
            onParamsChange={handleParamsChange}
            resolution={resolution}
            resolutionOptions={resolutionOptions}
            onResolutionChange={handleResolutionChange}
            isRunning={isRunning}
            onToggleRun={handleToggleRun}
          />
          <Codex
            ref={codexRef}
            currentParams={params}
            currentResolution={resolution}
            onLoad={handleLoadEntry}
            requestMetrics={requestMetrics}
          />
        </aside>
      </main>
    </div>
  );
};

export default App;

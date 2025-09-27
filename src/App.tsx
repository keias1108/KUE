import React, { useRef, useState } from 'react';
import AutomataCanvas, {
  AutomataCanvasHandle,
  ReactionDiffusionParams,
} from './components/AutomataCanvas';
import RuleControls from './components/RuleControls';
import Codex, { CodexEntry } from './components/Codex';

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

const App: React.FC = () => {
  const [params, setParams] = useState<ReactionDiffusionParams>(() => createDefaultParams());
  const [resolution, setResolution] = useState<number>(512);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const canvasRef = useRef<AutomataCanvasHandle>(null);

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
  };

  const handleLoadEntry = (entry: CodexEntry) => {
    setParams(entry.params);
    setResolution(entry.resolution);
    setIsRunning(false);
  };

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
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-6 lg:grid lg:grid-cols-[2fr,1fr]">
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg shadow-slate-950/60">
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
          <RuleControls
            params={params}
            onParamsChange={handleParamsChange}
            resolution={resolution}
            resolutionOptions={resolutionOptions}
            onResolutionChange={handleResolutionChange}
            isRunning={isRunning}
            onToggleRun={handleToggleRun}
          />
          <Codex currentParams={params} currentResolution={resolution} onLoad={handleLoadEntry} />
        </aside>
      </main>
    </div>
  );
};

export default App;

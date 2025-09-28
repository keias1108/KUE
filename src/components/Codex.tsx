import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ReactionDiffusionParams } from './AutomataCanvas';
import { ReactionDiffusionMetrics } from '../utils/metrics';

export interface CodexEntry {
  id: string;
  name: string;
  params: ReactionDiffusionParams;
  resolution: number;
  savedAt: string;
  metrics?: ReactionDiffusionMetrics;
  note?: string;
}

interface CodexProps {
  currentParams: ReactionDiffusionParams;
  currentResolution: number;
  onLoad: (entry: CodexEntry) => void;
  requestMetrics?: () => ReactionDiffusionMetrics | null;
  onEntriesChange?: (entries: CodexEntry[]) => void;
}

const STORAGE_KEY = 'personal-universe-codex';

export interface CodexHandle {
  addEntry: (entry: CodexEntry) => void;
}

const Codex = forwardRef<CodexHandle, CodexProps>(
  ({ currentParams, currentResolution, onLoad, requestMetrics, onEntriesChange }, ref) => {
  const [entries, setEntries] = useState<CodexEntry[]>([]);
  const [name, setName] = useState<string>('');
  const [noteDraft, setNoteDraft] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as CodexEntry[];
      if (Array.isArray(parsed)) {
        setEntries(parsed);
        onEntriesChange?.(parsed);
      }
    } catch (error) {
      console.warn('Failed to parse codex entries', error);
    }
  }, [onEntriesChange]);

  const updateEntries = (updater: (prev: CodexEntry[]) => CodexEntry[]) => {
    setEntries((prev) => {
      const next = updater(prev);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      onEntriesChange?.(next);
      return next;
    });
  };

  useImperativeHandle(ref, () => ({
    addEntry: (entry: CodexEntry) => {
      const normalised: CodexEntry = {
        ...entry,
        id:
          entry.id ||
          (typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}`),
        savedAt: entry.savedAt || new Date().toISOString(),
      };
      updateEntries((prev) => [normalised, ...prev]);
    },
  }));

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    const metrics = requestMetrics?.() ?? undefined;
    const entry: CodexEntry = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`,
      name: trimmed,
      params: { ...currentParams },
      resolution: currentResolution,
      savedAt: new Date().toISOString(),
      metrics,
      note: noteDraft.trim() || undefined,
    };
    updateEntries((prev) => [entry, ...prev]);
    setName('');
    setNoteDraft('');
  };

  const handleDelete = (id: string) => {
    updateEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const handleLoad = (entry: CodexEntry) => {
    onLoad(entry);
  };

  const handleNoteChange = (id: string, value: string) => {
    const trimmed = value.trim();
    updateEntries((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              note: trimmed.length > 0 ? value : undefined,
            }
          : entry,
      ),
    );
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/60">
      <h2 className="text-lg font-semibold text-slate-100">Codex</h2>
      <p className="mt-1 text-xs text-slate-400">
        Bookmark compelling parameter DNA and revisit them anytime.
      </p>

      <form onSubmit={handleSave} className="mt-4 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="이 패턴의 이름"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-400 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow shadow-indigo-900/60 transition hover:bg-indigo-400"
          >
            Save DNA
          </button>
        </div>
        <textarea
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
          placeholder="메모를 남겨 두세요 (예: 두 겹 호흡, 육각 균열 등)"
          rows={2}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-400 focus:outline-none"
        />
      </form>

      <div className="mt-4 space-y-3">
        {entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-700/60 px-4 py-6 text-center text-xs text-slate-500">
            No entries yet. Craft a pattern and save it to your Codex.
          </p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-800/70 bg-slate-900/80 p-4 shadow-inner shadow-slate-950/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-100">{entry.name}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(entry.savedAt).toLocaleString()} · {entry.resolution}²
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleLoad(entry)}
                    className="rounded-lg bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-white shadow shadow-emerald-900/50 transition hover:bg-emerald-400"
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:border-rose-500 hover:text-rose-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="text-[11px] font-mono leading-relaxed text-slate-400">
                du {entry.params.du.toFixed(3)} · dv {entry.params.dv.toFixed(3)} · feed {entry.params.feed.toFixed(3)} · kill {entry.params.kill.toFixed(3)} · dt {entry.params.dt.toFixed(2)} · thresh {entry.params.threshold.toFixed(2)} · contrast {entry.params.contrast.toFixed(2)} · gamma {entry.params.gamma.toFixed(2)} · invert {entry.params.invert ? 'yes' : 'no'}
              </div>
              {entry.metrics ? (
                <div className="text-[11px] font-mono leading-relaxed text-indigo-200/80">
                  activity {entry.metrics.activity.toFixed(4)} · entropy {entry.metrics.entropy.toFixed(2)} · σu {entry.metrics.stdU.toFixed(3)} · σv {entry.metrics.stdV.toFixed(3)}
                </div>
              ) : null}
              <div>
                <label className="text-[11px] uppercase tracking-wide text-indigo-300">Memo</label>
                <textarea
                  value={entry.note ?? ''}
                  onChange={(event) => handleNoteChange(entry.id, event.target.value)}
                  rows={2}
                  placeholder="무엇이 특별했는지 기록하세요"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
  },
);

Codex.displayName = 'Codex';

export default Codex;

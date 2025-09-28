import React from 'react';
import { ReactionDiffusionParams } from './AutomataCanvas';
import { ReactionDiffusionMetrics, VitalityCategory } from '../utils/metrics';

export interface AutoScanItem {
  id: string;
  params: ReactionDiffusionParams;
  metrics: ReactionDiffusionMetrics;
  classification: VitalityCategory;
  score: number;
  vitalityScore?: number;
  specialLikelihood?: number;
}

export type SeedFeedbackLabel = 'special' | 'normal';

export interface SeedFeedbackEntry {
  label: SeedFeedbackLabel;
  notedAt: string;
  note?: string;
}

interface AutoScanResultsProps {
  items: AutoScanItem[];
  onAdopt: (item: AutoScanItem) => void;
  onDiscard: (id: string) => void;
  onReplay: (item: AutoScanItem) => void;
  onLabel: (item: AutoScanItem, label: SeedFeedbackLabel) => void;
  feedback?: Record<string, SeedFeedbackEntry>;
  isProcessing: boolean;
  filterEnabled?: boolean;
  specialThreshold?: number;
  className?: string;
  title?: string;
  subtitle?: string;
}

const formatMetric = (value: number, decimals = 3) => value.toFixed(decimals);

const statusStyles: Record<
  VitalityCategory,
  { label: string; badgeClass: string; containerClass: string; description: string }
> = {
  balanced: {
    label: 'Balanced',
    badgeClass: 'border border-emerald-500/60 bg-emerald-500/10 text-emerald-200',
    containerClass: 'border-emerald-500/40 bg-emerald-950/40',
    description: '활동성과 다양성이 안정적으로 유지되고 있습니다.',
  },
  dormant: {
    label: 'Dormant',
    badgeClass: 'border border-slate-500/60 bg-slate-500/10 text-slate-300',
    containerClass: 'border-slate-700/70 bg-slate-950/70',
    description: '변화가 거의 없는 정지 상태로 판단됩니다.',
  },
  chaotic: {
    label: 'Chaotic',
    badgeClass: 'border border-amber-500/60 bg-amber-500/10 text-amber-200',
    containerClass: 'border-amber-500/50 bg-amber-950/40',
    description: '폭주하거나 불안정한 경향이 강합니다.',
  },
  structured: {
    label: 'Structured',
    badgeClass: 'border border-sky-500/60 bg-sky-500/10 text-sky-200',
    containerClass: 'border-sky-500/30 bg-sky-950/40',
    description: '정지 상태이지만 일정한 구조와 질감을 유지합니다.',
  },
};

const AutoScanResults: React.FC<AutoScanResultsProps> = ({
  items,
  onAdopt,
  onDiscard,
  onReplay,
  onLabel,
  feedback,
  isProcessing,
  filterEnabled = false,
  specialThreshold,
  className,
  title = 'Automated Seeds',
  subtitle = '시스템이 탐색한 후보들입니다. 균형감 있는 DNA를 채택하거나 버릴 수 있어요.',
}) => {
  return (
    <div
      className={`rounded-2xl border border-indigo-900/60 bg-slate-950/60 p-5 shadow-lg shadow-indigo-900/40 ${
        className ?? ''
      }`}
      data-testid="auto-scan-results"
    >
      {(title || subtitle) && (
        <div className="flex items-center justify-between gap-3">
          <div>
            {title ? <h2 className="text-lg font-semibold text-indigo-200">{title}</h2> : null}
            {subtitle ? <p className="text-xs text-indigo-300/80">{subtitle}</p> : null}
          </div>
        {isProcessing ? (
          <span className="text-xs font-mono text-indigo-300">scanning…</span>
        ) : null}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-indigo-800/60 px-4 py-6 text-center text-xs text-indigo-200/70">
            No automated seeds yet. Run a scan to populate the queue.
          </p>
        ) : (
          items.map((item) => {
            const status = statusStyles[item.classification];
            const userFeedback = feedback?.[item.id];
            return (
              <div
                key={item.id}
                className={`rounded-xl p-4 shadow-sm shadow-indigo-950/30 ${status.containerClass}`}
                data-testid="auto-scan-result"
              >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-indigo-100">Seed {item.id.slice(-4)}</p>
                    <span className={`rounded-full px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide ${status.badgeClass}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-indigo-200/80">
                    activity {formatMetric(item.metrics.activity, 4)} · entropy {formatMetric(item.metrics.entropy, 2)} · σu {formatMetric(item.metrics.stdU)} · σv {formatMetric(item.metrics.stdV)}
                  </p>
                  <p className="text-[10px] text-indigo-300/80">
                    score {formatMetric(item.score, 2)} · {status.description}
                  </p>
                  {typeof item.specialLikelihood === 'number' ? (
                    <p className="text-[10px] text-sky-200/80">
                      특이도 {formatMetric(item.specialLikelihood, 2)}
                      {filterEnabled && typeof specialThreshold === 'number'
                        ? ` (필터 ${specialThreshold.toFixed(2)} 이상)`
                        : ''}
                    </p>
                  ) : null}
                  {userFeedback ? (
                    <p className="mt-1 inline-flex items-center gap-2 rounded-full border border-indigo-400/50 bg-indigo-500/10 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-indigo-100">
                      user tagged · {userFeedback.label === 'special' ? '특이함' : '평범함'}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onReplay(item)}
                    className="rounded-lg border border-indigo-500/70 px-3 py-1 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/10"
                    data-testid="auto-scan-replay"
                  >
                    Replay
                  </button>
                  <button
                    type="button"
                    onClick={() => onAdopt(item)}
                    className="rounded-lg bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-white shadow shadow-emerald-900/50 transition hover:bg-emerald-400"
                    data-testid="auto-scan-adopt"
                  >
                    Adopt to Codex
                  </button>
                  <button
                    type="button"
                    onClick={() => onDiscard(item.id)}
                    className="rounded-lg border border-rose-500/60 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/10"
                    data-testid="auto-scan-remove"
                  >
                    Remove
                  </button>
                  <span className="hidden w-px bg-indigo-500/30 last:hidden md:block" />
                  <button
                    type="button"
                    onClick={() => onLabel(item, 'special')}
                    className="rounded-lg border border-sky-500/50 px-3 py-1 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/10"
                  >
                    특이함 기록
                  </button>
                  <button
                    type="button"
                    onClick={() => onLabel(item, 'normal')}
                    className="rounded-lg border border-slate-500/60 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/10"
                  >
                    평범함 기록
                  </button>
                </div>
              </div>
              <div className="mt-2 text-[11px] font-mono leading-relaxed text-slate-400">
                du {formatMetric(item.params.du)} · dv {formatMetric(item.params.dv)} · feed {formatMetric(item.params.feed)} · kill {formatMetric(item.params.kill)} · dt {formatMetric(item.params.dt, 2)} · thresh {formatMetric(item.params.threshold, 2)} · contrast {formatMetric(item.params.contrast, 2)} · gamma {formatMetric(item.params.gamma, 2)} · invert {item.params.invert ? 'yes' : 'no'}
              </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AutoScanResults;

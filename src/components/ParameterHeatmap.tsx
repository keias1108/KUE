import React from 'react';
import { HeatmapData } from '../utils/heatmap';

interface ParameterHeatmapProps {
  title: string;
  subtitle?: string;
  data: HeatmapData | null;
  highlightNote?: string;
}

const ParameterHeatmap: React.FC<ParameterHeatmapProps> = ({ title, subtitle, data, highlightNote }) => {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-indigo-800/50 bg-slate-900/80 p-4 shadow-inner shadow-indigo-950/50">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] uppercase tracking-wide text-indigo-300">Parameter Heatmap</p>
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        {subtitle ? <p className="text-[11px] text-indigo-200/80">{subtitle}</p> : null}
        {highlightNote ? <p className="text-[11px] text-sky-200/90">{highlightNote}</p> : null}
      </div>

      {data ? (
        <div className="overflow-x-auto">
          <table className="w-full border-separate" style={{ borderSpacing: '4px' }}>
            <thead>
              <tr>
                <th className="min-w-[60px] text-right text-[10px] font-semibold text-indigo-200">
                  {data.axisY.label}
                  <span className="ml-1 text-[9px] text-indigo-300/80">↓</span>
                </th>
                {data.axisX.ticks.map((tick) => (
                  <th key={tick} className="rounded bg-indigo-500/10 px-2 py-1 text-center text-[10px] font-mono text-indigo-200">
                    {tick}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.grid
                .map((row, rowIndex) => ({ row, rowIndex }))
                .reverse()
                .map(({ row, rowIndex }) => {
                  const tickLabel = data.axisY.ticks[rowIndex] ?? '';
                  return (
                    <tr key={tickLabel || rowIndex}>
                      <th className="whitespace-nowrap rounded bg-indigo-500/10 px-2 py-1 text-right text-[10px] font-mono text-indigo-200">
                        {tickLabel}
                      </th>
                      {row.map((cell, columnIndex) => {
                        const intensity = cell.normalized;
                        const backgroundAlpha = 0.12 + intensity * 0.78;
                        return (
                          <td
                            key={`${rowIndex}-${columnIndex}`}
                            className="min-w-[48px] rounded px-2 py-2 text-center text-[11px] font-semibold text-slate-100 shadow-sm shadow-indigo-950/30"
                            style={{
                              backgroundColor: `rgba(79, 70, 229, ${backgroundAlpha.toFixed(3)})`,
                            }}
                          >
                            {cell.count}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
            </tbody>
            <tfoot>
              <tr>
                <th className="text-right text-[10px] font-semibold text-indigo-200">
                  {data.axisX.label}
                  <span className="ml-1 text-[9px] text-indigo-300/80">→</span>
                </th>
                {data.axisX.ticks.map((tick) => (
                  <th key={`footer-${tick}`} className="rounded bg-indigo-500/10 px-2 py-1 text-center text-[10px] font-mono text-indigo-200">
                    {tick}
                  </th>
                ))}
              </tr>
            </tfoot>
          </table>
          <p className="mt-2 text-[10px] text-indigo-200/70">
            총 {data.total}건 · 최대 격자 {data.max}건
          </p>
        </div>
      ) : (
        <p className="rounded border border-dashed border-indigo-700/60 px-3 py-6 text-center text-[11px] text-indigo-200/70">
          시각화할 데이터가 아직 충분하지 않습니다.
        </p>
      )}
    </div>
  );
};

export default ParameterHeatmap;

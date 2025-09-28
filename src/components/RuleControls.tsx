import React from 'react';
import { ReactionDiffusionParams } from './AutomataCanvas';

type NumericParamKey = Exclude<keyof ReactionDiffusionParams, 'invert'>;

interface RuleControlsProps {
  params: ReactionDiffusionParams;
  onParamsChange: (params: ReactionDiffusionParams) => void;
  resolution: number;
  resolutionOptions: number[];
  onResolutionChange: (resolution: number) => void;
}

const sliderConfigs: Array<{
  key: NumericParamKey;
  label: string;
  min: number;
  max: number;
  step: number;
  description: string;
}> = [
  {
    key: 'du',
    label: 'Diffusion U',
    min: 0.0,
    max: 1.0,
    step: 0.001,
    description: 'Diffusion rate of chemical U (activator).',
  },
  {
    key: 'dv',
    label: 'Diffusion V',
    min: 0.0,
    max: 1.0,
    step: 0.001,
    description: 'Diffusion rate of chemical V (inhibitor).',
  },
  {
    key: 'feed',
    label: 'Feed Rate',
    min: 0.0,
    max: 0.1,
    step: 0.0005,
    description: 'Input feed of chemical U.',
  },
  {
    key: 'kill',
    label: 'Kill Rate',
    min: 0.0,
    max: 0.1,
    step: 0.0005,
    description: 'Removal rate of chemical V.',
  },
  {
    key: 'dt',
    label: 'Delta Time',
    min: 0.1,
    max: 2.0,
    step: 0.05,
    description: 'Integration timestep scale.',
  },
  {
    key: 'threshold',
    label: 'Threshold',
    min: 0.0,
    max: 1.0,
    step: 0.01,
    description: 'Pattern activation threshold for display.',
  },
  {
    key: 'contrast',
    label: 'Contrast',
    min: 0.5,
    max: 5.0,
    step: 0.05,
    description: 'Overall display contrast curve.',
  },
  {
    key: 'gamma',
    label: 'Gamma',
    min: 0.2,
    max: 3.0,
    step: 0.05,
    description: 'Gamma correction for tone mapping.',
  },
];

const RuleControls: React.FC<RuleControlsProps> = ({
  params,
  onParamsChange,
  resolution,
  resolutionOptions,
  onResolutionChange,
}) => {
  const handleSliderChange =
    (key: NumericParamKey) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(event.target.value);
      onParamsChange({ ...params, [key]: value });
    };

  const handleInvertToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    onParamsChange({ ...params, invert: event.target.checked });
  };

  const handleResolutionSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onResolutionChange(Number(event.target.value));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {sliderConfigs.map((config) => {
          const value = params[config.key];
          return (
            <label key={config.key} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-slate-100">{config.label}</span>
                  <p className="text-xs text-slate-500">{config.description}</p>
                </div>
                <span className="font-mono text-xs text-indigo-200">
                  {value.toFixed(config.step < 0.01 ? 3 : 2)}
                </span>
              </div>
              <input
                type="range"
                min={config.min}
                max={config.max}
                step={config.step}
                value={value}
                onChange={handleSliderChange(config.key)}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-indigo-500"
              />
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/70 bg-slate-900/70 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-100">Invert palette</p>
          <p className="text-xs text-slate-500">Flip light and dark regions after tonemapping.</p>
        </div>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={params.invert}
            onChange={handleInvertToggle}
            className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
          />
          <span className="text-xs text-slate-300">Invert</span>
        </label>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/70 bg-slate-900/70 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-100">Resolution</p>
          <p className="text-xs text-slate-500">
            Higher sizes add fidelity but require more GPU headroom.
          </p>
        </div>
        <select
          value={resolution}
          onChange={handleResolutionSelect}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none"
        >
          {resolutionOptions.map((value) => (
            <option key={value} value={value}>
              {value} × {value}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default RuleControls;

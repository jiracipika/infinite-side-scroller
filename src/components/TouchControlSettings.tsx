'use client';

import type { FC } from 'react';
import { getSfxEngine } from '@/game/audio';
import type {
  TouchControlLayout,
  TouchControlSize,
} from '@/game/state/game-state';
import { useGameStore } from './GameStore';

interface SegmentedOption<T extends string> {
  id: T;
  label: string;
}

const layoutOptions: Array<SegmentedOption<TouchControlLayout>> = [
  { id: 'standard', label: 'Move Left' },
  { id: 'mirrored', label: 'Move Right' },
];

const sizeOptions: Array<SegmentedOption<TouchControlSize>> = [
  { id: 'compact', label: 'Small' },
  { id: 'standard', label: 'Default' },
  { id: 'large', label: 'Large' },
];

const TouchControlSettings: FC = () => {
  const { settings, setSettings } = useGameStore();

  return (
    <>
      <SegmentedRow
        label="Touch Layout"
        description="Choose which thumb handles movement."
        value={settings.touchControlLayout}
        options={layoutOptions}
        onChange={(touchControlLayout) => setSettings({ touchControlLayout })}
      />
      <SegmentedRow
        label="Button Size"
        description="Large targets are easier to hit; small targets reveal more of the world."
        value={settings.touchControlSize}
        options={sizeOptions}
        onChange={(touchControlSize) => setSettings({ touchControlSize })}
      />
      <div
        className="ios-row"
        style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, paddingTop: 13, paddingBottom: 13 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label className="ios-row-label" htmlFor="touch-control-opacity">
            Control Visibility
          </label>
          <span className="ios-footnote" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(settings.touchControlOpacity * 100)}%
          </span>
        </div>
        <input
          id="touch-control-opacity"
          type="range"
          min="0.55"
          max="1"
          step="0.05"
          value={settings.touchControlOpacity}
          aria-valuetext={`${Math.round(settings.touchControlOpacity * 100)} percent`}
          onChange={(event) => {
            setSettings({ touchControlOpacity: Number(event.target.value) });
          }}
          onPointerUp={() => getSfxEngine().play('click')}
        />
        <span className="ios-footnote" style={{ color: 'var(--ios-label3)' }}>
          Controls stay readable at the minimum setting.
        </span>
      </div>
    </>
  );
};

export default TouchControlSettings;

function SegmentedRow<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description: string;
  value: T;
  options: Array<SegmentedOption<T>>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="ios-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <span className="ios-row-label">{label}</span>
      <div
        role="group"
        aria-label={label}
        style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, gap: 6 }}
      >
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={value === option.id ? 'ios-btn-primary' : 'ios-btn-secondary'}
            aria-pressed={value === option.id}
            onClick={() => {
              onChange(option.id);
              getSfxEngine().play('click');
            }}
            style={{ height: 36, paddingInline: 7, fontSize: 12 }}
          >
            {option.label}
          </button>
        ))}
      </div>
      <span className="ios-footnote" style={{ color: 'var(--ios-label3)' }}>
        {description}
      </span>
    </div>
  );
}

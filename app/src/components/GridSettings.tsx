import { BACKGROUND_PRESETS, MAX_SPACING, MIN_SPACING } from '../types/movie'

type Props = {
  background: string
  spacing: number
  onBackgroundChange: (value: string) => void
  onSpacingChange: (value: number) => void
}

export function GridSettings({
  background,
  spacing,
  onBackgroundChange,
  onSpacingChange,
}: Props) {
  return (
    <section className="panel" aria-labelledby="settings-heading">
      <h2 id="settings-heading" className="panel-title">
        Grid settings
      </h2>

      <fieldset className="field">
        <legend className="field-label">Background</legend>
        <div className="swatch-row">
          {BACKGROUND_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={`swatch ${preset.value === background ? 'is-selected' : ''}`}
              style={{ background: preset.value }}
              aria-label={preset.label}
              aria-pressed={preset.value === background}
              onClick={() => onBackgroundChange(preset.value)}
            />
          ))}
        </div>
        <label className="field field--inline">
          <span className="field-label">Custom colour</span>
          <input
            className="color-input"
            type="color"
            value={background}
            aria-label="Custom background colour"
            onChange={(event) => onBackgroundChange(event.target.value)}
          />
        </label>
      </fieldset>

      <label className="field">
        <span className="field-label">Spacing: {spacing}px</span>
        <input
          className="range"
          type="range"
          min={MIN_SPACING}
          max={MAX_SPACING}
          value={spacing}
          onChange={(event) => onSpacingChange(Number(event.target.value))}
        />
      </label>
    </section>
  )
}

import { useState } from 'react'
import { lenInputValue, parseLen, type Unit } from '../units'

/** Slider + editable numeric field (cm or ft/in aware) for a length in cm. */
export function SizeRow({
  label,
  cm,
  unit,
  min,
  max,
  step = 5,
  inchesOnly = false,
  onSlide,
  onCommit,
}: {
  label: string
  cm: number
  unit: Unit
  min: number
  max: number
  step?: number
  inchesOnly?: boolean
  onSlide: (v: number) => void
  onCommit: (v: number) => void
}) {
  const [text, setText] = useState<string | null>(null)
  const display = text ?? lenInputValue(cm, unit, inchesOnly)
  const commit = (raw: string) => {
    const parsed = parseLen(raw, unit)
    // keep sub-cm precision so imperial entries round-trip exactly (36" = 91.44 cm)
    if (parsed !== null) onCommit(Math.max(min, Math.min(max, Math.round(parsed * 100) / 100)))
  }
  return (
    <div className="slider-row">
      <div className="size-label">
        <span>{label}</span>
        <span className="size-input-wrap">
          <input
            className={`size-input ${unit === 'cm' ? '' : 'size-input-wide'}`}
            value={display}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setText(lenInputValue(cm, unit, inchesOnly))}
            onBlur={() => {
              if (text !== null) commit(text)
              setText(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            spellCheck={false}
            title={unit === 'cm' ? 'centimetres' : "type feet & inches, e.g. 5'11 or 11'"}
          />
          {unit === 'cm' && <span className="size-unit">cm</span>}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={cm}
        onChange={(e) => onSlide(Number(e.target.value))}
        onPointerUp={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && onCommit(cm)}
      />
    </div>
  )
}

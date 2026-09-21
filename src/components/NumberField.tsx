import { ReactNode } from 'react'

interface NumberFieldProps {
  label: ReactNode
  value: number | string
  onChange: (raw: string) => void
  unit?: string
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  hint?: ReactNode
}

/** 带单位后缀的数值输入行。 */
export default function NumberField({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step,
  disabled,
  hint,
}: NumberFieldProps) {
  return (
    <div className="mb-3">
      <label className="flex items-center gap-1 text-xs font-medium text-text-secondary mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          className="input-field"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        {unit && (
          <span className="text-xs text-text-muted w-12 shrink-0 text-right font-mono">
            {unit}
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] text-text-muted mt-1 leading-snug">{hint}</p>}
    </div>
  )
}

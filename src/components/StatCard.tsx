import { ReactNode } from 'react'

interface StatCardProps {
  label: ReactNode
  value: ReactNode
  unit?: string
  tone?: 'default' | 'primary' | 'accent' | 'success'
}

const toneClass: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-text-primary',
  primary: 'text-primary-light',
  accent: 'text-accent',
  success: 'text-success',
}

/** 结果数值卡：左竖条 + 标签 + 大号数值。 */
export default function StatCard({ label, value, unit, tone = 'default' }: StatCardProps) {
  return (
    <div className="bg-surface-elevated/60 border border-border border-l-2 border-l-primary-light/70 rounded-md px-3 py-2.5">
      <div className="text-[11px] text-text-muted mb-1 leading-tight">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-lg font-bold tabular ${toneClass[tone]}`}>{value}</span>
        {unit && <span className="text-[11px] text-text-muted">{unit}</span>}
      </div>
    </div>
  )
}

import { ReactNode } from 'react'

interface SectionCardProps {
  title?: ReactNode
  /** 标题行右侧的补充说明 */
  extra?: ReactNode
  children: ReactNode
  className?: string
}

/** 带标题的标准内容卡片。 */
export default function SectionCard({ title, extra, children, className = '' }: SectionCardProps) {
  return (
    <section className={`card-surface p-5 sm:p-6 ${className}`}>
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="section-title">{title}</h2>
          {extra && <div className="text-xs text-text-muted">{extra}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

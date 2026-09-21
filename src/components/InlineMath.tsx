import { useEffect, useRef } from 'react'
import katex from 'katex'

interface InlineMathProps {
  latex: string
  className?: string
}

/** 内联公式渲染（不占独立行、无卡片容器），用于标签与表格单元。 */
export default function InlineMath({ latex, className = '' }: InlineMathProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(latex, ref.current, {
          throwOnError: false,
          displayMode: false,
        })
      } catch {
        ref.current.textContent = latex
      }
    }
  }, [latex])

  return <span ref={ref} className={`inline-math ${className}`} />
}

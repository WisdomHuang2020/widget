import { useEffect, useRef, ReactNode } from 'react'
import katex from 'katex'

interface MathBlockProps {
  latex?: string
  children?: ReactNode
  /** 左上角步号标签，如 "①" 或 "STEP 1" */
  step?: string
  /** 步号旁的说明文字 */
  label?: string
  className?: string
}

/** 独占一行的公式块，带可选步号标签。 */
export default function MathBlock({
  latex,
  children,
  step,
  label,
  className = '',
}: MathBlockProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current && latex !== undefined) {
      try {
        katex.render(latex, ref.current, {
          throwOnError: false,
          displayMode: true,
        })
      } catch {
        ref.current.textContent = latex
      }
    }
  }, [latex])

  const hasLabel = Boolean(step || label)

  return (
    <div className={`math-block ${hasLabel ? 'has-label' : ''} ${className}`}>
      {hasLabel && (
        <div className="math-block-label">
          {step && <span className="step-number">{step}</span>}
          {label && <span className="label-text">{label}</span>}
        </div>
      )}
      {latex !== undefined ? <div ref={ref} /> : children}
    </div>
  )
}

/**
 * Power Widget 品牌标记 —— 与本站 public/favicon.svg 完全同源。
 *
 * 造型：计算器（本站首页主图标 Calculator 的加粗填实版）。
 * 语义：功率/照明计算工具，与主入口站 sites.json 的 icon=calculator 一致。
 *
 * ⚠️ 与 public/favicon.svg 使用同一套 path 数据：改一处必须同步另一处。
 * 主形用站群统一 teal #14b8a6；屏幕与按键用深底色挖空；
 * amber 条（结果行）与深底为站群固定标记。
 */
export default function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#0a0a0a" />
      <rect x="6" y="3.4" width="20" height="25.2" rx="3.4" fill="#14b8a6" />
      <rect x="9.4" y="7" width="13.2" height="4" rx="1.4" fill="#0a0a0a" />
      <circle cx="10.9" cy="15.4" r="1.35" fill="#0a0a0a" />
      <circle cx="16" cy="15.4" r="1.35" fill="#0a0a0a" />
      <circle cx="21.1" cy="15.4" r="1.35" fill="#0a0a0a" />
      <circle cx="10.9" cy="20.1" r="1.35" fill="#0a0a0a" />
      <circle cx="16" cy="20.1" r="1.35" fill="#0a0a0a" />
      <circle cx="21.1" cy="20.1" r="1.35" fill="#0a0a0a" />
      <rect x="10.9" y="23.6" width="10.2" height="2.4" rx="1.2" fill="#f59e0b" />
    </svg>
  )
}

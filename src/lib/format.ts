/** 数值格式化工具 —— 小数位约定与原版 HTML 保持一致。 */

export function fx(x: number, digits: number): string {
  if (!isFinite(x)) return '—'
  return x.toFixed(digits)
}

/** 解析输入框文本为数字，非法值回落到 fallback。 */
export function parseNum(raw: string, fallback = 0): number {
  const v = parseFloat(raw)
  return isFinite(v) ? v : fallback
}

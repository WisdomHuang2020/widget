/**
 * 切相（相位控制）调压计算 —— 计算内核
 *
 * 迁移自 reference/phase-control-calculator.html 的内联脚本，公式与边界处理
 * 逐行等价，未做任何数值改动。
 *
 * 物理模型：交流正弦波经晶闸管/双向可控硅切相后，负载上得到的是「斩波」波形。
 * 设未切相电压有效值为 U0、触发角为 α（弧度制），则导通段为 [α, π]，
 * 有效值按均方根积分（每半周计一次，整周期归一）得：
 *
 *     U_rms(α) = U0 · √( 1 − α/π + sin(2α)/(2π) )
 *
 * α = 0 时 U_rms = U0（全导通）；α = π 时 U_rms = 0（全关断）。
 */

const DEG = Math.PI / 180

/**
 * U_rms / U0 的比值（无量纲），触发角以「度」传入。
 * 用 max(x, 0) 兜底：α = 180° 时 sin(2π) 的浮点误差会使 x 略小于 0，
 * 直接 sqrt 会得到 NaN。
 */
export function urmsRatio(alphaDeg: number): number {
  const a = alphaDeg * DEG
  const x = 1 - a / Math.PI + Math.sin(2 * a) / (2 * Math.PI)
  return Math.sqrt(Math.max(x, 0))
}

/** 触发角限幅到 [0, 180] 度；非有限值按 0 处理。 */
export function clampAlpha(v: number): number {
  if (!isFinite(v)) return 0
  return Math.min(180, Math.max(0, v))
}

/** 未切相有效值 U0 的合法化：非有限值或负值按 0 处理。 */
export function normalizeU0(v: number): number {
  if (!isFinite(v) || v < 0) return 0
  return v
}

export interface PhaseControlResult {
  /** 输入有效值 U0 / V */
  u0: number
  /** 触发角 α / ° */
  alphaDeg: number
  /** 峰值 Um = U0·√2 / V */
  peak: number
  /** 导通角 φ = 180 − α / ° */
  conductionAngle: number
  /** U_rms / U0 */
  ratio: number
  /** 切相后有效值 U_rms / V */
  urms: number
}

export function computePhaseControl(u0: number, alphaDeg: number): PhaseControlResult {
  const ratio = urmsRatio(alphaDeg)
  return {
    u0,
    alphaDeg,
    peak: u0 * Math.SQRT2,
    conductionAngle: 180 - alphaDeg,
    ratio,
    urms: u0 * ratio,
  }
}

export interface PhaseControlRow {
  /** 触发角 α / ° */
  alpha: number
  /** 导通角 φ / ° */
  phi: number
  /** U_rms / U0 */
  ratio: number
  /** 切相后有效值 U_rms / V */
  urms: number
}

/** 枚举表：触发角 0° → 180°，步进 10°（与原版一致，共 19 行）。 */
export function buildPhaseTable(u0: number, step = 10): PhaseControlRow[] {
  const rows: PhaseControlRow[] = []
  for (let a = 0; a <= 180; a += step) {
    const r = urmsRatio(a)
    rows.push({ alpha: a, phi: 180 - a, ratio: r, urms: u0 * r })
  }
  return rows
}

/** 曲线采样点：0° → 180°，步进 0.5°（与原版画线采样一致）。 */
export function buildPhaseCurve(u0: number, step = 0.5) {
  const pts: { alpha: number; urms: number }[] = []
  for (let a = 0; a <= 180; a += step) {
    pts.push({ alpha: Number(a.toFixed(2)), urms: u0 * urmsRatio(a) })
  }
  return pts
}

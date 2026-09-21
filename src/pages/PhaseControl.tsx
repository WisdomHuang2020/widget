import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  ReferenceLine,
} from 'recharts'
import { RotateCcw } from 'lucide-react'
import SectionCard from '../components/SectionCard'
import StatCard from '../components/StatCard'
import NumberField from '../components/NumberField'
import InlineMath from '../components/InlineMath'
import MathBlock from '../components/MathBlock'
import {
  clampAlpha,
  normalizeU0,
  computePhaseControl,
  buildPhaseTable,
  buildPhaseCurve,
} from '../lib/phaseControl'
import { fx, parseNum } from '../lib/format'

const DEFAULT_U0 = 120
const DEFAULT_ALPHA = 90

export default function PhaseControl() {
  const [u0Text, setU0Text] = useState(String(DEFAULT_U0))
  const [alpha, setAlpha] = useState(DEFAULT_ALPHA)

  const u0 = normalizeU0(parseNum(u0Text, 0))
  const result = useMemo(() => computePhaseControl(u0, alpha), [u0, alpha])
  const table = useMemo(() => buildPhaseTable(u0), [u0])
  const curve = useMemo(() => buildPhaseCurve(u0), [u0])

  // 当前行高亮：与原版一致 —— α 落入某 10° 档位的 ±5° 邻域内即高亮该行
  const nearest = Math.round(alpha / 10) * 10
  const highlightAlpha = Math.abs(alpha - nearest) < 5 ? nearest : null

  const reset = () => {
    setU0Text(String(DEFAULT_U0))
    setAlpha(DEFAULT_ALPHA)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-6">
      {/* 标题与公式 */}
      <SectionCard
        title="切相（相位控制）调压计算器"
        extra="晶闸管 / 双向可控硅斩波调光"
      >
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          输入任意<strong className="text-text-primary">未切相正弦波电压有效值</strong>{' '}
          <InlineMath latex="U_0" /> ，即可得到任意触发角{' '}
          <InlineMath latex="\alpha" /> 下的切相电压有效值。
        </p>
        <MathBlock
          step="RMS"
          label="切相后有效值（均方根积分）"
          latex="U_m = U_0\sqrt{2} \qquad\qquad U_{\mathrm{rms}}(\alpha) = U_0\sqrt{1 - \frac{\alpha}{\pi} + \frac{\sin 2\alpha}{2\pi}}"
        />
        <p className="text-xs text-text-muted mt-3 leading-relaxed">
          其中 <InlineMath latex="\alpha" /> 为触发角，公式中须用<strong>弧度</strong>；
          界面输入与表格中均以<strong>度</strong>显示。导通段为{' '}
          <InlineMath latex="[\alpha,\ \pi]" />，故导通角{' '}
          <InlineMath latex="\phi = 180^\circ - \alpha" />。
        </p>
      </SectionCard>

      {/* 输入 */}
      <SectionCard title="① 输入参数">
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5 items-start">
          <NumberField
            label={<><InlineMath latex="U_0" /> 未切相有效值</>}
            value={u0Text}
            onChange={setU0Text}
            unit="V"
            min={0}
            step={1}
          />

          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-text-secondary mb-1.5">
              <InlineMath latex="\alpha" /> 触发角（可用滑块微调）
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={180}
                step={1}
                value={alpha}
                onChange={(e) => setAlpha(clampAlpha(parseFloat(e.target.value)))}
                className="flex-1 h-1.5 accent-[#06b6d4] cursor-pointer"
                aria-label="触发角滑块"
              />
              <input
                type="number"
                className="input-field w-[92px] shrink-0"
                min={0}
                max={180}
                step={1}
                value={alpha}
                onChange={(e) => setAlpha(clampAlpha(parseFloat(e.target.value)))}
                aria-label="触发角数值"
              />
              <span className="text-sm font-bold text-primary-light font-mono w-14 text-center shrink-0">
                {alpha.toFixed(0)}°
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-text-muted mt-1.5 px-[2px]">
              <span>0°（全导通）</span>
              <span>90°（半压）</span>
              <span>180°（全关断）</span>
            </div>
          </div>
        </div>

        <button
          onClick={reset}
          className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium bg-surface-elevated border border-border text-text-secondary hover:text-primary-light hover:border-primary-light transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> 重置为 {DEFAULT_U0} V / {DEFAULT_ALPHA}°
        </button>
      </SectionCard>

      {/* 结果 */}
      <SectionCard title="② 计算结果">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label={<>峰值 <InlineMath latex="U_m" /></>}
            value={fx(result.peak, 2)}
            unit="V"
          />
          <StatCard
            label={<>导通角 <InlineMath latex="\phi" /></>}
            value={fx(result.conductionAngle, 1)}
            unit="°"
          />
          <StatCard
            label={<><InlineMath latex="U_{\mathrm{rms}} / U_0" /></>}
            value={fx(result.ratio, 4)}
            tone="primary"
          />
          <StatCard
            label={<>切相后有效值 <InlineMath latex="U_{\mathrm{rms}}" /></>}
            value={fx(result.urms, 2)}
            unit="V"
            tone="accent"
          />
        </div>
      </SectionCard>

      {/* 曲线 */}
      <SectionCard
        title={<>③ <InlineMath latex="U_{\mathrm{rms}}" /> 随触发角变化曲线</>}
        extra={<>当前 <InlineMath latex="U_0" /> = {fx(u0, 2)} V</>}
      >
        {u0 <= 0 ? (
          <div className="h-[320px] flex items-center justify-center text-text-muted text-sm">
            请输入大于 0 的 <InlineMath latex="U_0" /> 以绘制曲线
          </div>
        ) : (
          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curve} margin={{ top: 20, right: 24, bottom: 28, left: 4 }}>
                <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
                <XAxis
                  dataKey="alpha"
                  type="number"
                  domain={[0, 180]}
                  ticks={[0, 30, 60, 90, 120, 150, 180]}
                  tickFormatter={(v: number) => `${v}°`}
                  stroke="#525252"
                  tick={{ fill: '#a3a3a3', fontSize: 12 }}
                  label={{
                    value: '触发角 α (°)',
                    position: 'insideBottom',
                    offset: -18,
                    fill: '#a3a3a3',
                    fontSize: 12,
                  }}
                />
                <YAxis
                  domain={[0, u0]}
                  stroke="#525252"
                  tick={{ fill: '#a3a3a3', fontSize: 12 }}
                  tickFormatter={(v: number) => v.toFixed(1)}
                  width={52}
                  label={{
                    value: 'U_rms (V)',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#a3a3a3',
                    fontSize: 12,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: '#171717',
                    border: '1px solid #404040',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#f5f5f5' }}
                  formatter={(v: number) => [`${v.toFixed(2)} V`, 'U_rms']}
                  labelFormatter={(v: number) => `α = ${v}°`}
                />
                <ReferenceLine
                  x={alpha}
                  stroke="#f59e0b"
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                />
                <ReferenceLine
                  y={result.urms}
                  stroke="#f59e0b"
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                />
                <Line
                  type="linear"
                  dataKey="urms"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <ReferenceDot
                  x={alpha}
                  y={result.urms}
                  r={6}
                  fill="#f59e0b"
                  stroke="#0a0a0a"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      {/* 枚举表 */}
      <SectionCard
        title="④ 完整枚举表（步进 10°）"
        extra={<>当前 <InlineMath latex="U_0" /> = {fx(u0, 2)} V</>}
      >
        <div className="max-h-[440px] overflow-y-auto scrollbar-thin rounded-md border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface-elevated">
                <th className="px-3 py-2.5 text-xs font-semibold text-primary-light border-b border-border text-center">
                  触发角 α / °
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold text-primary-light border-b border-border text-center">
                  导通角 φ / °
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold text-primary-light border-b border-border text-center">
                  U_rms / U_0
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold text-primary-light border-b border-border text-center">
                  切相后有效值 U_rms / V
                </th>
              </tr>
            </thead>
            <tbody>
              {table.map((row) => {
                const isActive = highlightAlpha === row.alpha
                return (
                  <tr
                    key={row.alpha}
                    className={
                      isActive
                        ? 'bg-accent/20 text-accent font-semibold'
                        : 'odd:bg-surface even:bg-surface-elevated/40 hover:bg-primary-dark/25 transition-colors'
                    }
                  >
                    <td className="px-3 py-2 text-center tabular font-mono">{row.alpha}</td>
                    <td className="px-3 py-2 text-center tabular font-mono">{row.phi}</td>
                    <td className="px-3 py-2 text-center tabular font-mono">
                      {fx(row.ratio, 4)}
                    </td>
                    <td className="px-3 py-2 text-center tabular font-mono">
                      {fx(row.urms, 2)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-muted mt-3 leading-relaxed">
          表中 <InlineMath latex="\alpha = 0^\circ" /> 一行即位<a className="text-primary-light">全导通</a>状态，
          <InlineMath latex="U_{\mathrm{rms}} = U_0" />；<InlineMath latex="\alpha = 180^\circ" />{' '}
          为全关断，输出为 0。比值列对任意 <InlineMath latex="U_0" /> 均成立，可直接复用于其它电压等级。
        </p>
      </SectionCard>

      {/* 注意事项 */}
      <div className="card-surface border-l-2 border-l-accent p-5">
        <h3 className="font-semibold text-accent text-sm mb-2">说明与边界</h3>
        <ul className="text-xs text-text-secondary space-y-1.5 leading-relaxed list-disc pl-5">
          <li>
            本计算器按输入的 <InlineMath latex="U_0" /> 为<strong>电压有效值</strong>处理。
            若您手里的是 <strong>VA（视在功率）</strong>，不能直接代入电压公式，
            需先结合负载电流或阻抗换算为电压。
          </li>
          <li>
            公式假设负载为纯阻性、晶闸管导通段完整落在{' '}
            <InlineMath latex="[\alpha,\ \pi]" /> 内且每半周对称触发。
            感性负载（如带镇流器的灯）存在电流滞后与关断角偏移，实际输出会高于此值。
          </li>
          <li>
            实际白炽灯/卤素灯为非线性阻性负载（冷态电阻远低于热态），
            低触发角时实测有效值可能偏离计算值，工程上建议留 5%~10% 余量。
          </li>
        </ul>
      </div>
    </div>
  )
}

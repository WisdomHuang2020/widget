import { Link } from 'react-router-dom'
import { Waves, BatteryCharging, ArrowRight, ShieldCheck, FunctionSquare, Gauge, Cpu } from 'lucide-react'

const tools = [
  {
    path: '/phase',
    icon: Waves,
    title: '切相调压计算器',
    subtitle: 'Phase-Controlled Voltage',
    desc: '由未切相有效值 U₀ 与触发角 α，求晶闸管/双向可控硅斩波后的电压有效值。含全程曲线与 10° 步进枚举表。',
    tags: ['调光', '晶闸管', 'RMS 积分'],
  },
  {
    path: '/battery',
    icon: BatteryCharging,
    title: '锂电池续航与充电时间',
    subtitle: 'Battery Life & Charge Time',
    desc: '按电池、功耗、使用模式与充电参数四组输入，估算低功耗产品的综合续航与实际充电时间，并逐步展开中间量。',
    tags: ['电池选型', '待机功耗', 'CC/CV'],
  },
]

const principles = [
  {
    icon: Cpu,
    title: '纯本地计算',
    desc: '全部运算在浏览器内完成，输入数据不上传、不留存，可离线使用。',
  },
  {
    icon: FunctionSquare,
    title: '公式可溯',
    desc: '每个工具都给出所用公式与推导依据，结果可手工复核，不做黑箱估算。',
  },
  {
    icon: Gauge,
    title: '工程口径',
    desc: '边界条件、假设与失效场景逐条列明，并给出余量建议，而非只给一个数字。',
  },
  {
    icon: ShieldCheck,
    title: '结果可复现',
    desc: '计算过程逐步展开，同一输入在任何设备上得到同一结果。',
  },
]

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* Hero */}
      <section className="py-16 sm:py-20 border-b border-border">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-dark/40 border border-primary-light/30 text-primary-light text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-light animate-pulse" />
            电源与照明工程计算器
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-5">
            把常用的<span className="text-gradient">工程估算</span>
            <br />
            收进一个干净的计算器
          </h1>
          <p className="text-text-secondary text-base leading-relaxed mb-8 max-w-2xl">
            面向 LED 驱动与锂电池应用的在线工具集。每一项都给出公式、假设与边界条件，
            结果可手工复核 —— 用于方案阶段快速定量，而不是替代实测。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/phase"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary hover:bg-primary-light text-white font-medium text-sm transition-colors"
            >
              切相调压计算器 <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/battery"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-surface-elevated border border-border text-text-primary hover:border-primary-light font-medium text-sm transition-colors"
            >
              锂电池续航估算 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 工具列表 */}
      <section className="py-14">
        <div className="flex items-baseline justify-between mb-7">
          <h2 className="section-title !text-lg">计算工具</h2>
          <span className="text-xs text-text-muted">共 {tools.length} 项 · 持续补充</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tools.map((t) => {
            const Icon = t.icon
            return (
              <Link
                key={t.path}
                to={t.path}
                className="card-surface card-surface-hover group p-6 flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-11 h-11 rounded-lg bg-primary-dark/50 border border-primary-light/25 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary-light" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-text-muted group-hover:text-primary-light group-hover:translate-x-0.5 transition-all" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-1">{t.title}</h3>
                <p className="text-[11px] text-text-muted font-mono uppercase tracking-wider mb-3">
                  {t.subtitle}
                </p>
                <p className="text-sm text-text-secondary leading-relaxed flex-1">{t.desc}</p>
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {t.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded text-[11px] bg-surface-elevated border border-border text-text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* 设计原则 */}
      <section className="py-10 border-t border-border">
        <h2 className="section-title !text-lg mb-7">本站原则</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {principles.map((p) => {
            const Icon = p.icon
            return (
              <div key={p.title} className="card-surface p-5">
                <Icon className="w-5 h-5 text-primary-light mb-3" />
                <h3 className="font-semibold text-text-primary text-sm mb-1.5">{p.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">{p.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* 说明条 */}
      <section className="py-10">
        <div className="card-surface border-l-2 border-l-accent p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <p className="text-xs text-text-secondary leading-relaxed">
            <strong className="text-accent">使用提示：</strong>
            工程估算用于缩小方案范围。最终选型请以电芯规格书、器件数据手册与实测波形为准。
            本站不承担因直接采用估算值而产生的设计风险。
          </p>
          <Link
            to="/about"
            className="shrink-0 inline-flex items-center gap-1.5 text-xs text-primary-light hover:underline"
          >
            查看公式出处与假设 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>
    </div>
  )
}

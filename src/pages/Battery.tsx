import { useMemo, useState, type ReactNode } from 'react'
import { RotateCcw, Battery, Clock, Zap } from 'lucide-react'
import SectionCard from '../components/SectionCard'
import StatCard from '../components/StatCard'
import NumberField from '../components/NumberField'
import InlineMath from '../components/InlineMath'
import { computeBattery, defaultBatteryInput, type ChargeMode, type BatteryInput } from '../lib/battery'
import { fx, parseNum } from '../lib/format'

/** 输入框在 UI 上全部以字符串保存，便于保留用户的中间输入态。 */
type FormState = {
  capacity: string
  voltage: string
  dod: string
  standbyCurrent: string
  workPower: string
  timesPerDay: string
  durationPerTime: string
  chargeCurrent: string
  chargeRate: string
  chargeEfficiency: string
}

const initialForm: FormState = {
  capacity: '2500',
  voltage: '3.7',
  dod: '80',
  standbyCurrent: '0.75',
  workPower: '0.2',
  timesPerDay: '3',
  durationPerTime: '1',
  chargeCurrent: '500',
  chargeRate: '0.2',
  chargeEfficiency: '85',
}

export default function BatteryPage() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [chargeMode, setChargeMode] = useState<ChargeMode>(defaultBatteryInput.chargeMode)

  const set = (key: keyof FormState) => (raw: string) =>
    setForm((prev) => ({ ...prev, [key]: raw }))

  // 解析为数值并套用原版的除零保护语义
  const num = (key: keyof FormState) => parseNum(form[key], 0)

  const input: BatteryInput = {
    capacity: num('capacity'),
    voltage: num('voltage'),
    dod: num('dod'),
    standbyCurrent: num('standbyCurrent'),
    workPower: num('workPower'),
    timesPerDay: num('timesPerDay'),
    durationPerTime: num('durationPerTime'),
    chargeMode,
    chargeCurrent: num('chargeCurrent'),
    chargeRate: num('chargeRate'),
    chargeEfficiency: num('chargeEfficiency'),
  }

  const r = useMemo(() => computeBattery(input), [
    input.capacity,
    input.voltage,
    input.dod,
    input.standbyCurrent,
    input.workPower,
    input.timesPerDay,
    input.durationPerTime,
    input.chargeMode,
    input.chargeCurrent,
    input.chargeRate,
    input.chargeEfficiency,
  ])

  const reset = () => {
    setForm(initialForm)
    setChargeMode(defaultBatteryInput.chargeMode)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-6">
      <SectionCard
        title="锂电池续航与充电时间计算器"
        extra="LED 灯条 / 人体感应灯等低功耗产品电池选型估算"
      >
        <p className="text-text-secondary text-sm leading-relaxed">
          按「电池参数 → 功耗参数 → 使用模式 → 充电参数」四组输入，估算产品的
          <strong className="text-text-primary">综合续航</strong>与
          <strong className="text-text-primary">实际充电时间</strong>，
          并逐步展开每一项中间量，便于复核与写进设计说明。
        </p>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── 左：输入 ── */}
        <SectionCard
          title="① 输入参数"
          extra={
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary-light transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> 重置
            </button>
          }
        >
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-primary-light uppercase tracking-wider mb-2">
            <Battery className="w-3.5 h-3.5" /> 电池参数
          </h3>
          <NumberField label="标称容量" value={form.capacity} onChange={set('capacity')} unit="mAh" min={1} step={1} />
          <NumberField label="标称电压" value={form.voltage} onChange={set('voltage')} unit="V" min={0.1} step={0.1} />
          <NumberField label="放电深度 (DOD)" value={form.dod} onChange={set('dod')} unit="%" min={1} max={100} step={1} />

          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-primary-light uppercase tracking-wider mb-2 mt-5">
            <Zap className="w-3.5 h-3.5" /> 功耗参数
          </h3>
          <NumberField
            label="待机电流（静态功耗）"
            value={form.standbyCurrent}
            onChange={set('standbyCurrent')}
            unit="mA"
            min={0}
            step={0.01}
            hint="含 PIR 感应 + MCU + 电源管理 IC 静态功耗"
          />
          <NumberField label="工作功耗（亮灯功率）" value={form.workPower} onChange={set('workPower')} unit="W" min={0} step={0.01} />

          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-primary-light uppercase tracking-wider mb-2 mt-5">
            <Clock className="w-3.5 h-3.5" /> 使用模式
          </h3>
          <NumberField label="每日触发次数" value={form.timesPerDay} onChange={set('timesPerDay')} unit="次" min={0} step={1} />
          <NumberField label="每次亮灯时长" value={form.durationPerTime} onChange={set('durationPerTime')} unit="分钟" min={0} step={0.1} />

          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-primary-light uppercase tracking-wider mb-2 mt-5">
            充电参数
          </h3>
          <div className="flex gap-1.5 mb-3">
            <button
              className="seg-btn"
              data-active={chargeMode === 'current'}
              onClick={() => setChargeMode('current')}
            >
              按充电电流
            </button>
            <button
              className="seg-btn"
              data-active={chargeMode === 'rate'}
              onClick={() => setChargeMode('rate')}
            >
              按充电倍率
            </button>
          </div>
          <NumberField
            label="充电电流"
            value={form.chargeCurrent}
            onChange={set('chargeCurrent')}
            unit="mA"
            min={1}
            step={10}
            disabled={chargeMode !== 'current'}
          />
          <NumberField
            label="充电倍率"
            value={form.chargeRate}
            onChange={set('chargeRate')}
            unit="C"
            min={0.05}
            step={0.05}
            disabled={chargeMode !== 'rate'}
          />
          <NumberField
            label="充电转换效率（含 IC 损耗）"
            value={form.chargeEfficiency}
            onChange={set('chargeEfficiency')}
            unit="%"
            min={1}
            max={100}
            step={1}
          />
        </SectionCard>

        {/* ── 中：结果 ── */}
        <SectionCard title="② 计算结果">
          <h3 className="text-xs font-semibold text-primary-light uppercase tracking-wider mb-2">核心结果</h3>
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <StatCard label="有效可用容量" value={fx(r.effectiveCapacity, 0)} unit="mAh" />
            <StatCard label="工作电流" value={fx(r.workCurrent, 1)} unit="mA" />
            <StatCard label="每日工作耗电" value={fx(r.dailyWorkConsumption, 2)} unit="mAh" />
            <StatCard label="每日待机耗电" value={fx(r.dailyStandbyConsumption, 2)} unit="mAh" />
            <StatCard label="每日总耗电" value={fx(r.dailyTotalConsumption, 2)} unit="mAh" tone="primary" />
            <StatCard label="电池总能量" value={fx(r.batteryEnergy, 2)} unit="Wh" />
          </div>

          <h3 className="text-xs font-semibold text-primary-light uppercase tracking-wider mb-2">续航指标</h3>
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <StatCard label="纯待机续航（理论极限）" value={fx(r.standbyDays, 1)} unit="天" />
            <StatCard label="综合续航（实际使用）" value={fx(r.totalDays, 1)} unit="天" tone="accent" />
            <StatCard label="综合续航（小时）" value={fx(r.totalHours, 0)} unit="h" />
            <StatCard label="综合续航（月）" value={fx(r.totalMonths, 1)} unit="月" tone="success" />
          </div>

          <h3 className="text-xs font-semibold text-primary-light uppercase tracking-wider mb-2">充电指标</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard label="充电电流" value={fx(r.chargeCurrent, 0)} unit="mA" />
            <StatCard label="充电倍率" value={fx(r.chargeRate, 3)} unit="C" />
            <StatCard label="理论充电时间（恒流）" value={fx(r.chargeTimeTheory, 1)} unit="h" />
            <StatCard label="实际充电时间（含损耗）" value={fx(r.chargeTimeActual, 1)} unit="h" tone="accent" />
          </div>
        </SectionCard>

        {/* ── 右：计算过程 ── */}
        <SectionCard title="③ 计算过程" extra="逐步展开，可复核">
          <ol className="space-y-3 text-xs leading-relaxed text-text-secondary font-mono">
            <Step n={1} title="有效可用容量">
              <div>
                C有效 = C标称 × DOD = {fx(num('capacity'), 0)} × {fx(num('dod'), 0)}% ={' '}
                <b className="text-primary-light">{fx(r.effectiveCapacity, 0)} mAh</b>
              </div>
            </Step>

            <Step n={2} title="工作电流计算">
              <div>I工作 = P工作 / V电池 × 1000</div>
              <div>
                = {form.workPower || 0}W / {fx(num('voltage'), 1)}V × 1000 ={' '}
                <b className="text-primary-light">{fx(r.workCurrent, 1)} mA</b>
              </div>
            </Step>

            <Step n={3} title="每日工作耗电">
              <div>
                t工作日 = {form.timesPerDay || 0}次 × {form.durationPerTime || 0}分 / 60 ={' '}
                {fx(r.dailyWorkHours, 2)} h
              </div>
              <div>
                C工作日 = {fx(r.workCurrent, 1)}mA × {fx(r.dailyWorkHours, 2)}h ={' '}
                <b className="text-primary-light">{fx(r.dailyWorkConsumption, 2)} mAh</b>
              </div>
            </Step>

            <Step n={4} title="每日待机耗电">
              <div>
                C待机日 = {form.standbyCurrent || 0}mA × 24h ={' '}
                <b className="text-primary-light">{fx(r.dailyStandbyConsumption, 2)} mAh</b>
              </div>
            </Step>

            <Step n={5} title="每日总耗电">
              <div>
                C总日 = {fx(r.dailyWorkConsumption, 2)} + {fx(r.dailyStandbyConsumption, 2)} ={' '}
                <b className="text-primary-light">{fx(r.dailyTotalConsumption, 2)} mAh</b>
              </div>
            </Step>

            <Step n={6} title="续航计算">
              <div>
                纯待机 = {fx(r.effectiveCapacity, 0)} / {form.standbyCurrent || 0} / 24 ={' '}
                <b className="text-primary-light">{fx(r.standbyDays, 1)} 天</b>
              </div>
              <div>
                综合 = {fx(r.effectiveCapacity, 0)} / {fx(r.dailyTotalConsumption, 2)} ={' '}
                <b className="text-primary-light">{fx(r.totalDays, 1)} 天</b>
              </div>
            </Step>

            <Step n={7} title="充电参数互算">
              {chargeMode === 'current' ? (
                <>
                  <div>I充 = {fx(r.chargeCurrent, 0)} mA（输入）</div>
                  <div>
                    倍率 = {fx(r.chargeCurrent, 0)} / {fx(num('capacity'), 0)} ={' '}
                    <b className="text-primary-light">{fx(r.chargeRate, 3)} C</b>
                  </div>
                </>
              ) : (
                <>
                  <div>倍率 = {fx(num('chargeRate'), 2)} C（输入）</div>
                  <div>
                    I充 = {fx(num('capacity'), 0)} × {fx(num('chargeRate'), 2)} ={' '}
                    <b className="text-primary-light">{fx(r.chargeCurrent, 0)} mA</b>
                  </div>
                </>
              )}
            </Step>

            <Step n={8} title="充电时间">
              <div>
                理论 = {fx(num('capacity'), 0)} / {fx(r.chargeCurrent, 0)} ={' '}
                <b className="text-primary-light">{fx(r.chargeTimeTheory, 1)} h</b>
              </div>
              <div>
                实际 = {fx(r.chargeTimeTheory, 1)} / {fx(num('chargeEfficiency'), 0)}% ={' '}
                <b className="text-primary-light">{fx(r.chargeTimeActual, 1)} h</b>
              </div>
            </Step>
          </ol>
        </SectionCard>
      </div>

      {/* 工程说明 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-surface border-l-2 border-l-accent p-5">
          <h3 className="font-semibold text-accent text-sm mb-2.5">工程说明</h3>
          <ul className="text-xs text-text-secondary space-y-2 leading-relaxed list-disc pl-5">
            <li>
              锂电池充电为 <strong className="text-text-primary">CC/CV 模式</strong>：恒流阶段约充入 80% 容量，
              恒压阶段占 20% 时间，实际总时间约为理论值的 <strong>1.2~1.5 倍</strong>。
              本站「实际充电时间」仅计入转换效率，未含 CV 段延时。
            </li>
            <li>
              本计算<strong>未考虑电池自放电</strong>（每月约 3~5%），长期放置需额外预留。
            </li>
            <li>
              待机电流已按含 PIR 感应 + MCU + 电源管理 IC 静态功耗的口径填写；
              若产品有 LDO 静态电流或分压采样网络，需一并计入。
            </li>
            <li>
              温度影响未建模：低温（&lt;0 °C）下锂电可用容量可衰减 20%~40%，
              户外产品需按最冷月复核。
            </li>
          </ul>
        </div>

        <div className="card-surface border-l-2 border-l-success p-5">
          <h3 className="font-semibold text-success text-sm mb-2.5">选型建议</h3>
          <ul className="text-xs text-text-secondary space-y-2 leading-relaxed list-disc pl-5">
            <li>
              <strong className="text-text-primary">循环寿命优先</strong>：DOD 取 50%，用容量翻倍换寿命
              （循环次数可从约 500 次提升到 1500 次以上）。
            </li>
            <li>
              <strong className="text-text-primary">空间优先</strong>：DOD 取 80%，
              但需注意低温放电容量衰减。
            </li>
            <li>
              充电倍率 <strong>≤ 0.5C</strong> 为常规做法；<strong>0.1~0.2C</strong> 为慢充长寿命方案。
            </li>
            <li>
              上表「综合续航（月）」用于快速判断换电池周期；消费类产品一般期望 ≥ 6 个月，
              低于此值建议加大容量或降低待机电流。
            </li>
          </ul>
        </div>
      </div>

      <p className="text-xs text-text-muted leading-relaxed px-1">
        注：本站所有计算在浏览器本地完成，不上传任何输入数据。
        估算结果为工程近似值，最终选型请以实测放电曲线与电芯规格书为准。
        续航涉及 <InlineMath latex="C_{\text{有效}} = C_{\text{标称}} \times \mathrm{DOD}" /> 的线性假设，
        未计入放电平台末期电压跌落导致的升压损耗。
      </p>
    </div>
  )
}

/** 计算过程中的单个步骤条目。 */
function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="border-l-2 border-l-primary-light/50 pl-3 py-0.5">
      <div className="font-semibold text-text-primary mb-1 font-sans">
        {n}. {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </li>
  )
}

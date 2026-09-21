/**
 * 锂电池续航与充电时间估算 —— 计算内核
 *
 * 迁移自 reference/battery-life-calculator.html 的内联脚本，公式与除零保护
 * 逐行等价，未做任何数值改动。
 *
 * 用途：LED 灯条、人体感应灯等「低功耗 + 间歇工作」产品的电池选型与充电时间估算。
 */

export type ChargeMode = 'current' | 'rate'

export interface BatteryInput {
  /** 标称容量 / mAh */
  capacity: number
  /** 标称电压 / V */
  voltage: number
  /** 放电深度 DOD / % */
  dod: number
  /** 待机电流（静态功耗）/ mA */
  standbyCurrent: number
  /** 工作功耗（亮灯功率）/ W */
  workPower: number
  /** 每日触发次数 */
  timesPerDay: number
  /** 每次亮灯时长 / 分钟 */
  durationPerTime: number
  /** 充电模式 */
  chargeMode: ChargeMode
  /** 充电电流 / mA（chargeMode === 'current' 时生效） */
  chargeCurrent: number
  /** 充电倍率 / C（chargeMode === 'rate' 时生效） */
  chargeRate: number
  /** 充电转换效率 / % */
  chargeEfficiency: number
}

export interface BatteryResult {
  /** 有效可用容量 / mAh */
  effectiveCapacity: number
  /** 工作电流 / mA */
  workCurrent: number
  /** 每日工作小时数 / h */
  dailyWorkHours: number
  /** 每日工作耗电 / mAh */
  dailyWorkConsumption: number
  /** 每日待机耗电 / mAh */
  dailyStandbyConsumption: number
  /** 每日总耗电 / mAh */
  dailyTotalConsumption: number
  /** 电池总能量 / Wh */
  batteryEnergy: number
  /** 纯待机续航 / 天 */
  standbyDays: number
  /** 综合续航 / 天 */
  totalDays: number
  /** 综合续航 / h */
  totalHours: number
  /** 综合续航 / 月 */
  totalMonths: number
  /** 实际采用的充电电流 / mA */
  chargeCurrent: number
  /** 实际采用的充电倍率 / C */
  chargeRate: number
  /** 理论充电时间（恒流）/ h */
  chargeTimeTheory: number
  /** 实际充电时间（含损耗）/ h */
  chargeTimeActual: number
}

export function computeBattery(i: BatteryInput): BatteryResult {
  // 1. 有效可用容量
  const effectiveCapacity = i.capacity * (i.dod / 100)

  // 2. 工作电流（由功率与电池电压反算）
  const workCurrent = i.voltage > 0 ? (i.workPower / i.voltage) * 1000 : 0

  // 3. 每日工作耗电
  const dailyWorkHours = (i.timesPerDay * i.durationPerTime) / 60
  const dailyWorkConsumption = workCurrent * dailyWorkHours

  // 4. 每日待机耗电（24 h 常耗）
  const dailyStandbyConsumption = i.standbyCurrent * 24

  // 5. 每日总耗电
  const dailyTotalConsumption = dailyWorkConsumption + dailyStandbyConsumption

  // 6. 电池总能量
  const batteryEnergy = (i.capacity * i.voltage) / 1000

  // 7. 续航
  const standbyDays = i.standbyCurrent > 0 ? effectiveCapacity / i.standbyCurrent / 24 : 0
  const totalDays = dailyTotalConsumption > 0 ? effectiveCapacity / dailyTotalConsumption : 0
  const totalHours = totalDays * 24
  const totalMonths = totalDays / 30

  // 8. 充电参数互算：给定电流求倍率，或给定倍率求电流
  let chargeCurrent: number
  let chargeRate: number
  if (i.chargeMode === 'current') {
    chargeCurrent = i.chargeCurrent
    chargeRate = i.capacity > 0 ? chargeCurrent / i.capacity : 0
  } else {
    chargeRate = i.chargeRate
    chargeCurrent = i.capacity * chargeRate
  }

  // 9. 充电时间：理论值 = 容量 / 充电电流；实际值再除以转换效率
  const chargeTimeTheory = chargeCurrent > 0 ? i.capacity / chargeCurrent : 0
  const chargeTimeActual =
    i.chargeEfficiency > 0 ? chargeTimeTheory / (i.chargeEfficiency / 100) : 0

  return {
    effectiveCapacity,
    workCurrent,
    dailyWorkHours,
    dailyWorkConsumption,
    dailyStandbyConsumption,
    dailyTotalConsumption,
    batteryEnergy,
    standbyDays,
    totalDays,
    totalHours,
    totalMonths,
    chargeCurrent,
    chargeRate,
    chargeTimeTheory,
    chargeTimeActual,
  }
}

/** 默认输入：与原版 HTML 的初始值完全一致，保证首屏结果可对照。 */
export const defaultBatteryInput: BatteryInput = {
  capacity: 2500,
  voltage: 3.7,
  dod: 80,
  standbyCurrent: 0.75,
  workPower: 0.2,
  timesPerDay: 3,
  durationPerTime: 1,
  chargeMode: 'current',
  chargeCurrent: 500,
  chargeRate: 0.2,
  chargeEfficiency: 85,
}

/**
 * 数值口径一致性验证 —— 重构等价性证明
 *
 * 目的：证明 src/lib/ 下的计算内核与 reference/ 下重构前的原始单文件 HTML
 *       算法**逐项等价**，而不是"看起来一样"。
 *
 * 做法（关键：原版代码是真原文，不是我重写的）：
 *   1. 切相计算器：从原 HTML 中正则提取 urmsRatio 源码 → eval 成可调用函数 → 逐点比对。
 *   2. 电池计算器：为原 HTML 的 <script> 构造最小 DOM 桩，用 node:vm 把整段脚本
 *      真实跑起来，读取 14 个结果元素；再用同一输入调用新内核，按**相同的 toFixed
 *      格式**比对字符串 —— 数值与显示口径一并验证。
 *
 * 用法：node scripts/verify-numeric-parity.mjs
 * 退出码：0 = 全部一致；1 = 存在差异（并打印差异明细）
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// ─────────────────────────────────────────────────────────────
// 0. 用 esbuild 把 TS 内核转成 Node 可直接 import 的 ESM
// ─────────────────────────────────────────────────────────────
const genDir = path.join(root, 'scripts', '.gen')
fs.mkdirSync(genDir, { recursive: true })

for (const name of ['phaseControl', 'battery']) {
  const source = fs.readFileSync(path.join(root, 'src', 'lib', `${name}.ts`), 'utf8')
  const { code } = await esbuild.transform(source, { loader: 'ts', format: 'esm' })
  fs.writeFileSync(path.join(genDir, `${name}.mjs`), code)
}
const phaseLib = await import(new URL('./.gen/phaseControl.mjs', import.meta.url).href)
const batteryLib = await import(new URL('./.gen/battery.mjs', import.meta.url).href)

let failures = 0
const report = (ok, label, detail) => {
  if (!ok) {
    failures++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

// ─────────────────────────────────────────────────────────────
// 1. 切相调压：比对 urmsRatio 与枚举表
// ─────────────────────────────────────────────────────────────
console.log('\n[1/2] 切相调压计算器')

const phaseSrc = fs.readFileSync(
  path.join(root, 'reference', 'phase-control-calculator.html'),
  'utf8',
)

const phaseSnippet = phaseSrc.match(
  /const DEG = Math\.PI \/ 180;[\s\S]*?function urmsRatio\(alphaDeg\)[\s\S]*?\n {2}\}/,
)
if (!phaseSnippet) {
  console.log('  ✗ 未能从原始 HTML 提取 urmsRatio 源码，验证中止')
  process.exit(1)
}
// eslint-disable-next-line no-eval
const origUrmsRatio = eval(`${phaseSnippet[0]}; urmsRatio`)
console.log('  · 已从原 HTML 提取 urmsRatio 源码并执行')

// 1a. 逐点比对比值函数：0° → 180°，步进 0.5°（含边界与浮点敏感点）
let ratioDiff = 0
for (let a = 0; a <= 180.0001; a += 0.5) {
  const alpha = Number(a.toFixed(2))
  const o = origUrmsRatio(alpha)
  const n = phaseLib.urmsRatio(alpha)
  if (!Object.is(o, n)) {
    ratioDiff++
    if (ratioDiff <= 3) {
      console.log(`    α=${alpha}° 原版=${o} 新版=${n}`)
    }
  }
}
report(ratioDiff === 0, `urmsRatio 逐点比对（361 点）`, `${ratioDiff} 处不一致`)

// 1b. 边界点专测
for (const a of [0, 90, 179.5, 180]) {
  const o = origUrmsRatio(a)
  const n = phaseLib.urmsRatio(a)
  report(Object.is(o, n), `边界点 α=${a}°`, `原版=${o} 新版=${n}`)
}
console.log(
  `  · α=0°→${phaseLib.urmsRatio(0).toFixed(6)}  α=90°→${phaseLib.urmsRatio(90).toFixed(6)}  α=180°→${phaseLib.urmsRatio(180)}`,
)

// 1c. 枚举表：与原 HTML 的 buildTable 输出格式（toFixed(4) / toFixed(2)）比对
const TABLE_U0 = 220
const origTableRows = []
for (let a = 0; a <= 180; a += 10) {
  const r = origUrmsRatio(a)
  origTableRows.push([a, 180 - a, r.toFixed(4), (TABLE_U0 * r).toFixed(2)])
}
const newTableRows = phaseLib.buildPhaseTable(TABLE_U0).map((row) => [
  row.alpha,
  row.phi,
  row.ratio.toFixed(4),
  row.urms.toFixed(2),
])
report(
  origTableRows.length === 19 && newTableRows.length === 19,
  '枚举表行数（应为 19 行）',
  `原版=${origTableRows.length} 新版=${newTableRows.length}`,
)
const tableMismatch = origTableRows.filter(
  (r, i) => JSON.stringify(r) !== JSON.stringify(newTableRows[i]),
)
report(tableMismatch.length === 0, '枚举表逐行比对', `${tableMismatch.length} 行不一致`)
if (tableMismatch.length) console.log('    首行差异：', tableMismatch[0])

// ─────────────────────────────────────────────────────────────
// 2. 锂电池：用最小 DOM 桩真实执行原 HTML 脚本
// ─────────────────────────────────────────────────────────────
console.log('\n[2/2] 锂电池续航与充电时间计算器')

const batterySrc = fs.readFileSync(
  path.join(root, 'reference', 'battery-life-calculator.html'),
  'utf8',
)
const scriptMatch = batterySrc.match(/<script>([\s\S]*?)<\/script>/)
if (!scriptMatch) {
  console.log('  ✗ 未能从原始 HTML 提取 <script>，验证中止')
  process.exit(1)
}

const INPUT_IDS = [
  'capacity',
  'voltage',
  'dod',
  'standbyCurrent',
  'workPower',
  'timesPerDay',
  'durationPerTime',
  'chargeCurrent',
  'chargeRate',
  'chargeEfficiency',
]
const OUTPUT_IDS = [
  'effectiveCapacity',
  'workCurrent',
  'dailyWork',
  'dailyStandby',
  'dailyTotal',
  'batteryEnergy',
  'standbyDays',
  'totalDays',
  'totalHours',
  'totalMonths',
  'chargeCurrentResult',
  'chargeRateResult',
  'chargeTimeTheory',
  'chargeTimeActual',
]

/** 建立一次 DOM 桩 + 执行原版脚本，返回可反复调用的 { calculate, setMode, els }。 */
function loadOriginalBattery() {
  const els = new Map()
  const getEl = (id) => {
    if (!els.has(id)) {
      els.set(id, { id, value: '', textContent: '', innerHTML: '', disabled: false })
    }
    return els.get(id)
  }
  // 原 HTML 中各输入框的 value 属性默认值
  Object.assign(getEl('capacity'), { value: '2500' })
  Object.assign(getEl('voltage'), { value: '3.7' })
  Object.assign(getEl('dod'), { value: '80' })
  Object.assign(getEl('standbyCurrent'), { value: '0.75' })
  Object.assign(getEl('workPower'), { value: '0.2' })
  Object.assign(getEl('timesPerDay'), { value: '3' })
  Object.assign(getEl('durationPerTime'), { value: '1' })
  Object.assign(getEl('chargeCurrent'), { value: '500' })
  Object.assign(getEl('chargeRate'), { value: '0.2', disabled: true })
  Object.assign(getEl('chargeEfficiency'), { value: '85' })

  const modeRef = { value: 'current' }

  const sandbox = {
    console,
    Math,
    parseFloat,
    parseInt,
    isFinite,
    Number,
    document: {
      getElementById: getEl,
      querySelector: (sel) => {
        if (sel.includes('chargeMode')) return modeRef
        return null
      },
    },
    window: {},
  }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  vm.runInContext(scriptMatch[1], sandbox)

  return {
    els,
    /** 直接调用原版 calculate()；原脚本末尾有 `window.onload = calculate`。 */
    calculate: () => sandbox.window.onload(),
    /** 通过原版 switchChargeMode() 切换模式（它会读 DOM 并重算）。 */
    setMode: (mode) => {
      modeRef.value = mode
      sandbox.switchChargeMode()
    },
  }
}

const CASES = [
  {
    label: '默认值 + 按电流（与原版首屏一致）',
    mode: 'current',
    inputs: { chargeCurrent: '500', chargeRate: '0.2' },
  },
  {
    label: '改动全部输入 + 按电流',
    mode: 'current',
    inputs: {
      capacity: '1000',
      voltage: '3.6',
      dod: '50',
      standbyCurrent: '0.05',
      workPower: '1.5',
      timesPerDay: '10',
      durationPerTime: '0.5',
      chargeCurrent: '200',
      chargeEfficiency: '75',
    },
  },
  {
    label: '按倍率模式（0.5C 快充）',
    mode: 'rate',
    inputs: {
      capacity: '3200',
      voltage: '3.7',
      dod: '80',
      standbyCurrent: '1.2',
      workPower: '0.5',
      timesPerDay: '5',
      durationPerTime: '2',
      chargeRate: '0.5',
      chargeEfficiency: '90',
    },
  },
  {
    label: '除零边界：电压=0 / 充电电流=0 / 效率=0',
    mode: 'current',
    inputs: {
      capacity: '2000',
      voltage: '0',
      dod: '100',
      standbyCurrent: '0',
      workPower: '0.3',
      timesPerDay: '2',
      durationPerTime: '1',
      chargeCurrent: '0',
      chargeEfficiency: '0',
    },
  },
]

/** 新版内核按与原版**完全相同的显示口径**格式化，便于逐字符串比对。 */
function formatNew(r) {
  return {
    effectiveCapacity: r.effectiveCapacity.toFixed(0) + ' mAh',
    workCurrent: r.workCurrent.toFixed(1) + ' mA',
    dailyWork: r.dailyWorkConsumption.toFixed(2) + ' mAh',
    dailyStandby: r.dailyStandbyConsumption.toFixed(2) + ' mAh',
    dailyTotal: r.dailyTotalConsumption.toFixed(2) + ' mAh',
    batteryEnergy: r.batteryEnergy.toFixed(2) + ' Wh',
    standbyDays: r.standbyDays.toFixed(1) + ' 天',
    totalDays: r.totalDays.toFixed(1) + ' 天',
    totalHours: r.totalHours.toFixed(0) + ' h',
    totalMonths: r.totalMonths.toFixed(1) + ' 月',
    chargeCurrentResult: r.chargeCurrent.toFixed(0) + ' mA',
    chargeRateResult: r.chargeRate.toFixed(3) + ' C',
    chargeTimeTheory: r.chargeTimeTheory.toFixed(1) + ' h',
    chargeTimeActual: r.chargeTimeActual.toFixed(1) + ' h',
  }
}

for (const c of CASES) {
  const orig = loadOriginalBattery()
  for (const id of INPUT_IDS) {
    if (id in c.inputs) orig.els.get(id).value = c.inputs[id]
  }
  if (c.mode === 'current') {
    orig.calculate()
  } else {
    orig.setMode(c.mode)
  }

  const numOf = (id) => parseFloat(orig.els.get(id).value) || 0
  const newResult = batteryLib.computeBattery({
    capacity: numOf('capacity'),
    voltage: numOf('voltage'),
    dod: numOf('dod'),
    standbyCurrent: numOf('standbyCurrent'),
    workPower: numOf('workPower'),
    timesPerDay: numOf('timesPerDay'),
    durationPerTime: numOf('durationPerTime'),
    chargeMode: c.mode,
    chargeCurrent: numOf('chargeCurrent'),
    chargeRate: numOf('chargeRate'),
    chargeEfficiency: numOf('chargeEfficiency'),
  })
  const formatted = formatNew(newResult)

  let caseFail = 0
  for (const id of OUTPUT_IDS) {
    const o = orig.els.get(id).textContent
    const n = formatted[id]
    if (o !== n) {
      caseFail++
      if (caseFail <= 3) console.log(`     ${id}: 原版="${o}" 新版="${n}"`)
    }
  }
  report(caseFail === 0, `[${c.label}] 14 项输出比对`, `${caseFail} 项不一致`)
  if (caseFail === 0) {
    console.log(`  ✓ ${c.label}`)
    console.log(
      `      综合续航=${formatted.totalDays}  实际充电=${formatted.chargeTimeActual}  充电倍率=${formatted.chargeRateResult}`,
    )
  }
}

// ─────────────────────────────────────────────────────────────
// 汇总
// ─────────────────────────────────────────────────────────────
console.log('')
if (failures === 0) {
  console.log('✅ 全部一致：新内核与原始 HTML 的算法在数值与显示口径上逐项等价。')
  process.exit(0)
} else {
  console.log(`❌ 存在 ${failures} 处不一致，请勿发布。`)
  process.exit(1)
}

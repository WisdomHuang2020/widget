import { ExternalLink, AlertTriangle, BookOpen, Wrench } from 'lucide-react'
import SectionCard from '../components/SectionCard'
import MathBlock from '../components/MathBlock'
import InlineMath from '../components/InlineMath'

const siblingSites = [
  { name: '交错并联 Boost PFC 设计工具', url: 'https://interleavedpfc.power-knowledge.tech/' },
  { name: 'LLC 谐振变换器设计工具', url: 'https://llc.power-knowledge.tech/' },
  { name: 'AHB 不对称半桥反激设计工具', url: 'https://ahb.power-knowledge.tech/' },
  { name: '光学计算器', url: 'https://optical.power-knowledge.tech/' },
]

export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <SectionCard title="关于本站">
        <p className="text-sm text-text-secondary leading-relaxed">
          <strong className="text-text-primary">Power Widget</strong> 是一组面向 LED 驱动与锂电池应用的
          在线工程计算器。定位是「方案阶段的快速定量工具」：给出结果的同时，把
          <strong className="text-text-primary">公式、假设、边界条件与失效场景</strong>一并写清，
          使结果可以被手工复核，而不是一个不可追溯的数字。
        </p>
        <p className="text-xs text-text-muted leading-relaxed mt-3">
          全部计算在浏览器本地完成，不依赖后端服务，不上传任何输入数据。
          本站与姊妹站（下表）共用同一套前端技术栈与部署链路。
        </p>
      </SectionCard>

      <SectionCard title="切相调压：公式与依据">
        <p className="text-sm text-text-secondary leading-relaxed mb-3">
          交流正弦波经晶闸管（或双向可控硅）按触发角 <InlineMath latex="\alpha" /> 斩波后，
          每个半周只保留 <InlineMath latex="[\alpha,\ \pi]" /> 区间。按有效值的定义
          （均方根，一整周期内取均方），有：
        </p>
        <MathBlock
          step="推导"
          label="由均方根定义直接积分"
          latex="U_{\mathrm{rms}} = \sqrt{\frac{1}{\pi}\int_{\alpha}^{\pi} \left(U_m \sin\theta\right)^2 \mathrm{d}\theta} = U_0\sqrt{1 - \frac{\alpha}{\pi} + \frac{\sin 2\alpha}{2\pi}}"
        />
        <ul className="text-xs text-text-secondary space-y-1.5 leading-relaxed list-disc pl-5 mt-4">
          <li>
            积分区间取半周 <InlineMath latex="\pi" /> 而非整周期 <InlineMath latex="2\pi" />，
            是因为正负半周对称、且两半周各贡献相同的均方值，比值一致。
          </li>
          <li>
            两处边界自检：<InlineMath latex="\alpha = 0" /> 时积分化简为{' '}
            <InlineMath latex="\pi/2 \cdot U_m^2" />，得 <InlineMath latex="U_{\mathrm{rms}} = U_0" />；
            <InlineMath latex="\alpha = \pi" /> 时被积区间长度为 0，得 0。
            这与物理直觉（全导通 / 全关断）一致，可用来验证实现无误。
          </li>
          <li>
            <InlineMath latex="\alpha = 90^\circ" /> 时 <InlineMath latex="U_{\mathrm{rms}}/U_0 = 0.7071" />，
            与半周导通（半压平方关系）的直觉相符。
          </li>
        </ul>
      </SectionCard>

      <SectionCard title="锂电池估算：口径与假设">
        <p className="text-sm text-text-secondary leading-relaxed mb-3">
          电池部分采用「容量守恒 + 恒流近似」的工程口径，逐步展开如下：
        </p>
        <ol className="text-xs text-text-secondary space-y-2 leading-relaxed list-decimal pl-5">
          <li>
            有效可用容量按 <InlineMath latex="C_{\text{有效}} = C_{\text{标称}} \times \mathrm{DOD}" />{' '}
            线性折算，不考虑放电平台末期的电压跌落与升压损耗。
          </li>
          <li>
            工作电流由功率反算：<InlineMath latex="I = P / V" />。
            该式默认电池在标称电压附近放电；实际伴随电压下降，同等功率下电流略增，
            故对续航的估计<strong className="text-accent">偏乐观</strong>。
          </li>
          <li>待机电流按 24 h 连续消耗计，工作耗电按「每日次数 × 单次时长」折算成小时数后叠加。</li>
          <li>
            充电时间按恒流近似：<InlineMath latex="t = C / I" />，再除以转换效率得实际时间。
            <strong className="text-accent">未计入</strong> CV 段的额外延时，故对锂电池而言
            实际值通常还要再乘 1.2~1.5。
          </li>
          <li>未计入电池自放电（约每月 3~5%）与温度对可用容量的影响。</li>
        </ol>
        <div className="mt-4 p-3 rounded-md bg-accent/10 border border-accent/25 flex gap-2.5">
          <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary leading-relaxed">
            <strong className="text-accent">已知偏差方向：</strong>
            本工具给出的续航天数通常为<strong>乐观估计</strong>。
            若用于产品规格对外承诺，请在计算结果上打 0.7~0.8 的折扣，
            并以实测放电曲线为准。
          </p>
        </div>
      </SectionCard>

      <SectionCard title="数值口径">
        <ul className="text-xs text-text-secondary space-y-1.5 leading-relaxed list-disc pl-5">
          <li>展示位数固定，不做四舍五入后的二次运算 —— 所有中间量按原始双精度浮点参与计算，仅在显示时截位。</li>
          <li>因此表格中「U_rms」列与「U_rms / U_0」列×U₀ 可能出现末位 ±1 的显示差异，属预期现象。</li>
          <li>触发角输入范围限幅在 0°~180°；超出范围会自动收敛到边界值。</li>
          <li>未切相有效值 <InlineMath latex="U_0" /> 为负或非数值时按 0 处理，此时曲线提示输入无效。</li>
        </ul>
      </SectionCard>

      <SectionCard title="姊妹站">
        <p className="text-xs text-text-muted mb-3">同一套技术栈与部署链路，各自独立域名与服务。</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {siblingSites.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-md bg-surface-elevated/60 border border-border text-sm text-text-secondary hover:text-primary-light hover:border-primary-light transition-colors"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Wrench className="w-4 h-4 shrink-0" />
                <span className="truncate">{s.name}</span>
              </span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="版本与源码">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-text-secondary">
          <span className="font-mono">
            当前版本：<span className="text-primary-light">v{__APP_VERSION__}</span>
          </span>
          <a
            href="https://github.com/WisdomHuang2020/widget"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 hover:text-primary-light transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" /> 源码仓库（含计算器原始版本存档）
          </a>
        </div>
        <p className="text-xs text-text-muted leading-relaxed mt-3">
          仓库内 <code className="font-mono text-text-secondary">reference/</code> 目录保留了本站两个计算器
          重构前的原始单文件 HTML，用于公式与数值口径的溯源比对。
        </p>
      </SectionCard>

      <div className="card-surface p-5">
        <h3 className="font-semibold text-text-primary text-sm mb-2">免责声明</h3>
        <p className="text-xs leading-relaxed text-text-secondary">
          本站所有计算结果均为工程近似值，仅供学习、研究与方案评估参考，
          <strong className="text-text-primary">不构成设计保证</strong>。
          实际产品设计须结合器件数据手册、电芯规格书、实测波形与安规要求综合判定。
          作者不对因直接采用本站估算结果而产生的任何设计风险或损失承担责任。
        </p>
      </div>
    </div>
  )
}

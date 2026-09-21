# Power Widget — 电源与照明工程计算器

面向 LED 驱动与锂电池应用的在线工程计算器集合。
每个工具在给出结果的同时，明确公式、假设、边界条件与偏差方向，使结论可手工复核。

**线上地址**：https://widget.power-knowledge.tech/
**兜底通道**：https://wisdomhuang2020.github.io/widget/

## 计算工具

| 工具 | 路由 | 说明 |
|---|---|---|
| 切相调压计算器 | `#/phase` | 由未切相有效值 U₀ 与触发角 α，求晶闸管/双向可控硅斩波后的电压有效值。含全程曲线与 10° 步进枚举表 |
| 锂电池续航与充电时间 | `#/battery` | 按电池/功耗/使用模式/充电参数四组输入，估算低功耗产品的综合续航与实际充电时间，并逐步展开中间量 |
| 关于 | `#/about` | 公式出处、假设口径、已知偏差方向、免责声明 |

## 技术栈

与姊妹站（interleaved-pfc / llc-design-tool / ahb-flyback / optical-calculator）保持一致：

- **构建**：Vite 6 + TypeScript 5.7（`tsc -b && vite build`）
- **框架**：React 19 + react-router-dom 7（HashRouter）
- **样式**：Tailwind CSS 4（`@tailwindcss/vite`，主题变量定义在 `src/index.css` 的 `@theme`）
- **图表**：recharts 2
- **公式**：KaTeX（经 `InlineMath` / `MathBlock` 组件渲染）
- **图标**：lucide-react

主色为 cyan（`#06b6d4`），与姊妹站区分：interleavedpfc = 蓝、llc/ahb = teal。
底色与语义色沿用统一深色设计系统。

## 本地开发

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 类型检查 + 生产构建，产物在 dist/
npm run preview  # 预览生产构建
```

## 部署

双通道并行独立发布，同一份 `dist/` 喂两个目标：

| 通道 | 工作流 | 目标 |
|---|---|---|
| 自有域名（正式） | `.github/workflows/deploy-lighthouse.yml` | 腾讯轻量云 `150.158.164.41` → `/var/www/widget` |
| GitHub Pages（兜底） | `.github/workflows/deploy.yml` | `https://wisdomhuang2020.github.io/widget/` |

`vite.config.ts` 中 `base: './'` + HashRouter，使同一份产物在根路径与 `/widget/` 子路径下
都能正确解析，且 nginx 无需任何 `try_files` 重写规则。

仓库 ↔ 域名 ↔ 实例 ↔ web 根 的对应关系见 `deploy/sites.yml`（单一真源）。

### 所需的 repository secrets

`LH_HOST` / `LH_USER` / `LH_ROOT` / `LH_SSH_KEY`（可选 `LH_PORT`）。
未配置时 `deploy-lighthouse.yml` 会优雅跳过并打印 notice —— 此时 **job 级仍显示成功**，
属「假绿」，判断是否真的部署了必须下钻到步骤级，确认 `Deploy to server over SSH` 是 `success` 而非 `skipped`。

## 目录结构

```
├── .github/workflows/     # 双通道 CI/CD
├── deploy/sites.yml       # 部署对照表（单一真源）
├── public/favicon.svg
├── reference/             # 重构前的原始单文件 HTML（数值口径溯源用）
└── src/
    ├── components/        # Layout / Header / Footer / 公式与输入控件
    ├── lib/               # 计算内核（纯函数，与页面解耦）
    │   ├── phaseControl.ts
    │   ├── battery.ts
    │   └── format.ts
    ├── pages/             # Home / PhaseControl / Battery / About
    ├── App.tsx
    ├── index.css          # Tailwind 主题与组件层
    └── main.tsx
```

**关于 `reference/`**：目录内为本站两个计算器重构前的原始单文件 HTML，
保留它是为了让公式与数值口径有据可查。页面逻辑以 `src/lib/` 下的纯函数为准。

## 数值一致性验证

重构不得改动任何计算结果。为证明这一点，`scripts/verify-numeric-parity.mjs`
**不比对"我重写的代码"，而是真实执行原始 HTML 里的代码**：

- **切相计算器**：从原始 HTML 中正则提取 `urmsRatio` 源码 → `eval` 成可调用函数 →
  与 `src/lib/phaseControl.ts` 逐点比对（0°→180°，步进 0.5°，共 361 点，含边界与浮点敏感点）。
- **电池计算器**：为原始 HTML 的 `<script>` 构造最小 DOM 桩，用 `node:vm` 把整段脚本
  **真实跑起来**，读取 14 个结果元素；再用同一输入调用新内核，按**完全相同的 `toFixed`
  格式**比对字符串 —— 数值与显示口径一并验证。覆盖 4 组用例（默认值、全量改动、
  按倍率模式、除零边界）。

```bash
npm run verify:parity
```

退出码 0 = 逐项等价；非 0 = 存在差异并打印明细，**不得发布**。

## 免责声明

所有计算结果均为工程近似值，仅供学习、研究与方案评估参考，不构成设计保证。
实际设计须结合器件数据手册、电芯规格书与实测波形综合判定。

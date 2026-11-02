# Power Widget — 电源与照明工程计算器

面向 LED 驱动与锂电池应用的在线工程计算器集合。
每个工具在给出结果的同时，明确公式、假设、边界条件与偏差方向，使结论可手工复核。

**线上地址**：https://widget.power-knowledge.tech/
**兜底通道**：https://wisdomhuang2020.github.io/widget/

## 计算工具

| 工具 | 路由 | 说明 |
|---|---|---|
| 切相调压计算器 | `/phase` | 由未切相有效值 U₀ 与触发角 α，求晶闸管/双向可控硅斩波后的电压有效值。含全程曲线与 10° 步进枚举表 |
| 锂电池续航与充电时间 | `/battery` | 按电池/功耗/使用模式/充电参数四组输入，估算低功耗产品的综合续航与实际充电时间，并逐步展开中间量 |
| 读者留言 | `/feedback` | 读者指出计算错误或文档疏漏。留言不公开，仅作者在后台可见 |
| 后台 | `/admin` | 留言查看 / 标记 / 归档 / 删除、修改密码。不在导航中露出，直达访问 |
| 关于 | `/about` | 公式出处、假设口径、已知偏差方向、免责声明 |

## 技术栈

与姊妹站（interleaved-pfc / llc-design-tool / ahb-flyback / optical-calculator）保持一致：

- **构建**：Vite 6 + TypeScript 5.7（`tsc -b && vite build`）
- **框架**：React 19 + react-router-dom 7（**BrowserRouter**）
- **样式**：Tailwind CSS 4（`@tailwindcss/vite`，主题变量定义在 `src/index.css` 的 `@theme`）
- **图表**：recharts 2
- **公式**：KaTeX（经 `InlineMath` / `MathBlock` 组件渲染）
- **图标**：lucide-react

主色为 teal（`--color-primary #0f766e` / `--color-primary-light #14b8a6` / `--color-primary-dark #134e4a`），
与站群其余站点（llc / ahb / interleavedpfc / 主入口）完全一致；amber（`#f59e0b`）只用于标记关键点。
各站之间不再以主色区分，辨识改由站点图标（favicon / 页头 logo）承担。
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
| 自有域名（正式） | `.github/workflows/deploy-lighthouse.yml` | 腾讯轻量云 `43.142.148.37` → `/var/www/widget` |
| GitHub Pages（兜底） | `.github/workflows/deploy.yml` | `https://wisdomhuang2020.github.io/widget/` |

`vite.config.ts` 中 `base: './'` + BrowserRouter，使同一份产物在根路径与 `/widget/` 子路径下
都能正确解析。BrowserRouter 要求服务端把未知路径回落到 `index.html`：

- nginx：`try_files $uri $uri/ /index.html`
- GitHub Pages 无回落能力，构建时由 `scripts/copy-404.mjs` 复制 `index.html` → `404.html`

> 历史：2026-09-28 之前用的是 HashRouter（路由在 `#` 后，服务端不感知），
> 因此旧版 README 里「无需 try_files」的说法已不成立，此处已更正。

仓库 ↔ 域名 ↔ 实例 ↔ web 根 的对应关系见 `deploy/sites.yml`（单一真源）。

### 所需的 repository secrets

`LH_HOST` / `LH_USER` / `LH_ROOT` / `LH_SSH_KEY`（可选 `LH_PORT`）。
未配置时 `deploy-lighthouse.yml` 会优雅跳过并打印 notice —— 此时 **job 级仍显示成功**，
属「假绿」，判断是否真的部署了必须下钻到步骤级，确认 `Deploy to server over SSH` 是 `success` 而非 `skipped`。

## 读者留言（后端）

`/feedback` 与 `/admin` 依赖一个自建小后端，源码在 `server/`：

| 项 | 值 |
|---|---|
| 运行时 | Node 22（内置 `node:sqlite`，**零 npm 依赖**，服务器上无需 `npm install`） |
| 进程 | systemd `widget-api.service`，以 `www-data` 运行 |
| 监听 | `127.0.0.1:8791`（仅回环，不开放公网端口），由 nginx `location /api/` 反代 |
| 数据 | `/var/lib/widget-api/data.db`（SQLite，WAL 模式） |
| 代码 | `/opt/widget-api/` |

安全口径：

- 管理员密码用 **scrypt** 加盐哈希存储（参数内嵌于哈希串，便于日后升级），库内无法还原明文。
- 会话令牌为 32 字节随机串，数据库只存其 SHA-256；Cookie 为 `HttpOnly + SameSite=Strict + Secure`。
- 留言接口按 IP 限流（10 分钟 5 条 / 24 小时 20 条），另有蜜罐字段拦机器人。
- 不存读者明文 IP，只存加盐哈希用于反滥用计数，无法反查。
- 管理接口只接受同源请求（校验 `Origin`），挡 CSRF。

> ⚠️ **CI 不部署后端。** `deploy-lighthouse.yml` 只发布 `dist/`，
> `/opt/widget-api` 与数据库不在覆盖范围内，发布前端不会影响已有留言。
> 后端代码变更须手工同步，步骤见 [`server/README.md`](server/README.md)。

## 目录结构

```
├── .github/workflows/     # 双通道 CI/CD
├── deploy/sites.yml       # 部署对照表（单一真源）
├── server/                # 留言板后端（Node + SQLite + systemd）
│   ├── index.mjs          # HTTP 服务（零依赖）
│   ├── init-admin.mjs     # 管理员初始化 / 密码重置
│   ├── widget-api.service # systemd 单元
│   └── README.md          # 部署与运维手册
├── public/favicon.svg
├── reference/             # 重构前的原始单文件 HTML（数值口径溯源用）
└── src/
    ├── components/        # Layout / Header / Footer / 公式与输入控件
    ├── lib/               # 计算内核（纯函数，与页面解耦）
    │   ├── phaseControl.ts
    │   ├── battery.ts
    │   ├── format.ts
    │   └── api.ts         # 留言板 API 客户端
    ├── pages/             # Home / PhaseControl / Battery / Feedback / Admin / About
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

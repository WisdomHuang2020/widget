import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import PhaseControl from './pages/PhaseControl'
import Battery from './pages/Battery'
import About from './pages/About'
import Feedback from './pages/Feedback'
import Admin from './pages/Admin'

/**
 * 站点路由。
 *
 * 2026-09-28 由 HashRouter 改为 BrowserRouter：URL 不再带 `#/`，
 * 首页即 https://widget.power-knowledge.tech/ ，子页为 /phase、/battery 等。
 *
 * 由此带来四项配套约束（缺一不可）：
 *   1. nginx 必须回落 index.html（`try_files $uri $uri/ /index.html`），
 *      否则用户刷新子页面会 404。已同步改 /etc/nginx/sites-available/widget。
 *   2. GitHub Pages 无 fallback 能力，构建时须把 index.html 复制一份为
 *      404.html 作兜底，见 scripts/copy-404.mjs。
 *   3. vite 的 base 必须保持相对路径 './' —— 同一份 dist 仍要同时服务
 *      GitHub Pages 的 /widget/ 子路径与自有域名的根路径。
 *   4. **basename 必须按部署路径设置**（2026-11-02 补）：
 *      GitHub Pages 把站点挂在 /widget/ 下，若 BrowserRouter 不带 basename，
 *      location.pathname 是 `/widget/`，与所有路由（`/`、`/phase`…）都不匹配，
 *      结果是**页头页脚渲染、正文全空**。此前一直没被发现，因为只验了自有域名。
 */

/** 从当前 URL 推断路由前缀：GitHub Pages 取第一段（/widget），自有域名取根。 */
function resolveBasename(): string {
  if (typeof window === 'undefined') return '/'
  // 仅 *.github.io 需要前缀；自有域名与本地开发都在根路径
  if (!window.location.hostname.endsWith('.github.io')) return '/'
  const first = window.location.pathname.split('/').filter(Boolean)[0]
  return first ? `/${first}` : '/'
}

function App() {
  return (
    <BrowserRouter basename={resolveBasename()}>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/phase" element={<PhaseControl />} />
          <Route path="/battery" element={<Battery />} />
          <Route path="/about" element={<About />} />
          <Route path="/feedback" element={<Feedback />} />
          {/* 后台不在导航中露出，仅通过直达 URL 访问。
              真正的权限边界在服务端（/api/admin/* 校验会话），
              前端隐藏路径不构成任何安全保护，只是不打扰普通读者。 */}
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App

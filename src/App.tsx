import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import PhaseControl from './pages/PhaseControl'
import Battery from './pages/Battery'
import About from './pages/About'

/**
 * 站点路由。
 *
 * 2026-09-28 由 HashRouter 改为 BrowserRouter：URL 不再带 `#/`，
 * 首页即 https://widget.power-knowledge.tech/ ，子页为 /phase、/battery 等。
 *
 * 由此带来三项配套约束（缺一不可）：
 *   1. nginx 必须回落 index.html（`try_files $uri $uri/ /index.html`），
 *      否则用户刷新子页面会 404。已同步改 /etc/nginx/sites-available/widget
 *      与 wx-seastar —— 后者与本目录共用同一份产物，漏改其一即 404。
 *   2. GitHub Pages 无 fallback 能力，构建时须把 index.html 复制一份为
 *      404.html 作兜底，见 scripts/copy-404.mjs。
 *   3. vite 的 base 必须保持相对路径 './' —— 同一份 dist 仍要同时服务
 *      GitHub Pages 的 /widget/ 子路径与自有域名的根路径。
 */
function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/phase" element={<PhaseControl />} />
          <Route path="/battery" element={<Battery />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App

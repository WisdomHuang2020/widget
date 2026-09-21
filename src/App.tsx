import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import PhaseControl from './pages/PhaseControl'
import Battery from './pages/Battery'
import About from './pages/About'

/**
 * 站点路由。
 *
 * 用 HashRouter 而非 BrowserRouter：同一份 dist 要同时服务于
 * GitHub Pages 的 /widget/ 子路径与自有域名的根路径，且 Hash 路由下
 * nginx 无需任何 try_files 重写规则（沿用姊妹站约定）。
 */
function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/phase" element={<PhaseControl />} />
          <Route path="/battery" element={<Battery />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </Layout>
    </HashRouter>
  )
}

export default App

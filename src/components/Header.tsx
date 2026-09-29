import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, LayoutGrid, Waves, BatteryCharging, Info } from 'lucide-react'
import BrandMark from './BrandMark'

const navLinks = [
  { path: '/', label: '首页', icon: LayoutGrid },
  { path: '/phase', label: '切相调压', icon: Waves },
  { path: '/battery', label: '电池估算', icon: BatteryCharging },
  { path: '/about', label: '关于', icon: Info },
]

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-surface border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 text-text-primary hover:text-primary-light transition-colors"
        >
          <BrandMark className="w-6 h-6" />
          <span className="font-bold text-lg tracking-tight">Power Widget</span>
          {/* 版本号在页头与页脚各显示一处，两处共用同一个 __APP_VERSION__ 常量
              （由 vite define 从 package.json 注入），故不存在硬编码各自漂移的风险。
              app-version 为 class 钩子，供线上核验用 querySelectorAll 断言。 */}
          <span className="app-version px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold text-primary-light bg-primary-dark/50 border border-primary-light/30 leading-none">
            v{__APP_VERSION__}
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path
            const Icon = link.icon
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  isActive
                    ? 'text-primary-light bg-primary-dark/30'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden lg:inline">{link.label}</span>
              </Link>
            )
          })}
        </nav>

        <button
          className="md:hidden p-2 text-text-secondary hover:text-text-primary"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="切换导航菜单"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-surface border-b border-border">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path
              const Icon = link.icon
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                    isActive
                      ? 'text-primary-light bg-primary-dark/30'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </header>
  )
}

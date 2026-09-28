import { Link } from 'react-router-dom'
import { CircuitBoard, Github, Waves, BatteryCharging, Info } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-surface border-t border-border mt-20">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CircuitBoard className="w-5 h-5 text-primary-light" />
              <span className="font-bold text-text-primary">Power Widget</span>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed">
              面向 LED 驱动与锂电池应用的在线工程计算器，涵盖切相调压估算与低功耗产品电池选型。
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-text-primary mb-4 text-sm uppercase tracking-wider">
              计算工具
            </h4>
            <div className="space-y-2">
              <Link
                to="/phase"
                className="flex items-center gap-2 text-text-secondary hover:text-primary-light text-sm transition-colors"
              >
                <Waves className="w-4 h-4" /> 切相调压计算器
              </Link>
              <Link
                to="/battery"
                className="flex items-center gap-2 text-text-secondary hover:text-primary-light text-sm transition-colors"
              >
                <BatteryCharging className="w-4 h-4" /> 锂电池续航与充电时间
              </Link>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-text-primary mb-4 text-sm uppercase tracking-wider">
              说明
            </h4>
            <div className="space-y-2">
              <Link
                to="/about"
                className="flex items-center gap-2 text-text-secondary hover:text-primary-light text-sm transition-colors"
              >
                <Info className="w-4 h-4" /> 公式出处与假设
              </Link>
            </div>
          </div>
        </div>
        <div className="border-t border-border mt-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center md:items-start gap-1">
            {/* 版本串同时作为线上部署核验的指纹锚点，请勿移除或改写格式。
                与页头徽标共用同一个 __APP_VERSION__，保证两处永远一致。 */}
            <p className="text-text-muted text-sm">
              Power Widget <span className="app-version">v{__APP_VERSION__}</span> · © 2026 仅供工程估算与学习参考
            </p>
            {/* ICP 备案号：工信部要求网站底部展示并链接至 beian.miit.gov.cn */}
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text-secondary text-sm transition-colors"
            >
              苏ICP备2026073104号
            </a>
          </div>
          <a
            href="https://github.com/WisdomHuang2020/widget"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-text-muted hover:text-text-secondary text-sm transition-colors"
          >
            <Github className="w-4 h-4" /> GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}

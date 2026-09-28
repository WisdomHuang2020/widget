/**
 * 构建后把 dist/index.html 复制一份为 dist/404.html。
 *
 * 为什么需要它：
 *   本站 2026-09-28 起由 HashRouter 改为 BrowserRouter，URL 形如
 *   https://widget.power-knowledge.tech/phase（不再带 #/）。
 *   自有域名侧由 nginx 的 `try_files $uri $uri/ /index.html` 回落，没这个问题；
 *   但 **GitHub Pages 不支持 SPA fallback** —— 访问 /widget/phase 会返回
 *   GitHub 自己的 404 页，React 拿不到控制权，路由失效。
 *
 *   按 GitHub Pages 的既有约定，站点根部的 404.html 会被用作自定义 404 页面，
 *   因此把它做成与 index.html 完全一致，任何未命中的深层路径都会加载 SPA，
 *   由前端路由接管。这是无服务端配置能力下最标准的做法。
 *
 * 由 package.json 的 build 脚本在 vite build 之后调用。
 */
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'dist', 'index.html')
const dst = resolve(root, 'dist', '404.html')

if (!existsSync(src)) {
  // 用 throw 而非 process.exit(1)：同样的非零退出语义，但不依赖 Node 全局变量，
  // 以免 eslint 的 no-undef 规则在未声明 node 环境的 scripts/ 目录下报错。
  throw new Error(`[copy-404] 找不到 ${src} —— 是否漏跑 vite build？`)
}

copyFileSync(src, dst)
console.log('[copy-404] dist/index.html -> dist/404.html（供 GitHub Pages SPA fallback）')

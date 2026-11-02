import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  // 相对路径：同一份 dist 在「自有域名根路径」与「GitHub Pages 子路径 /widget/」下都能正确解析。
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // 开发期把 /api 转发到本机运行的后端（node server/index.mjs）。
  // 生产环境由 nginx 反代，路径一致，前端无需区分。
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8791',
        changeOrigin: false,
      },
    },
  },
})

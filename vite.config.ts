import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  /* 生产构建用相对路径寻址：同一份 dist 既能挂在域名根目录，也能挂在
     /repo/ 这类子目录（GitHub Pages 项目站、OSS 带目录的静态托管）。
     开发服务器保持 "/"，免得本地热更新路径跟着变形。 */
  base: command === 'build' ? './' : '/',
  build: {
    rollupOptions: {
      output: {
        /* 公式排版单独成块：应用代码更新时，KaTeX 这一块还能留在浏览器缓存里。 */
        manualChunks: (id) => {
          if (id.includes('node_modules/katex')) return 'katex'
          if (id.includes('/ink/textures-paper.generated')) return 'looseleaf-paper'
          if (id.includes('/vendor/looseleaf/ink/')) return 'looseleaf-ink'
          if (id.includes('/node_modules/')) return 'vendor'
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/release/**', '**/build/icon.png', '**/src-tauri/**'],
    },
  },
}))

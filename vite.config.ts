import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  /* 生产构建用相对路径寻址：同一份 dist 既能挂在域名根目录，也能挂在
     /repo/ 这类子目录（GitHub Pages 项目站、OSS 带目录的静态托管）。
     开发服务器保持 "/"，免得本地热更新路径跟着变形。 */
  base: command === 'build' ? './' : '/',
  server: {
    port: 5173,
    strictPort: false,
    /* 别去监听 electron-builder 的产物目录：打包时它正往里写 exe，
       Windows 上文件被占着，监听器一碰就 EBUSY，把开发服务器带崩。 */
    watch: {
      ignored: ['**/release/**', '**/build/icon.png'],
    },
  },
}))

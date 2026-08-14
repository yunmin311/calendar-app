import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 相对路径打包，Electron 里用 file:// 加载 dist 才不会白屏
export default defineConfig({
  base: './',
  plugins: [react()],
})

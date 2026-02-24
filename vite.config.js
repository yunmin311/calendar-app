import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      manifest: {
        name: '2026线性日历',
        short_name: '年度日历',
        description: '全年线性规划日历工具',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'https://cdn-icons-png.flaticon.com/512/552/552848.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})
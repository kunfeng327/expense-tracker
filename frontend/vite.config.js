import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // 允许局域网内手机访问
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:5000',
    },
  },
})

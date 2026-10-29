import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    base: '/',
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: env.API_PROXY || 'https://tescgsm-admin.onrender.com',
          changeOrigin: true,
        },
      },
    },
  }
})

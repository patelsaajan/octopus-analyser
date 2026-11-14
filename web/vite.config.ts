import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { octopusProxy } from './server/octopus-proxy'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'OCTOPUS_')
  return {
    plugins: [react(), tailwindcss(), octopusProxy(env.OCTOPUS_API_KEY, env.OCTOPUS_ACCOUNT_NUMBER)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})

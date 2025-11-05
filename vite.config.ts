import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Ensure worker bundles use ES modules output which supports code-splitting.
  // Put the worker option at top-level so Vite handles it correctly.
  worker: {
    format: 'es'
  },
})

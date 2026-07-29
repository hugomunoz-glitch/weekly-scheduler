import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      external: [
        '@capacitor/core',
        '@capacitor/geolocation',
        '@capacitor/local-notifications',
        '@capacitor-community/background-geolocation',
      ],
    },
  },
})

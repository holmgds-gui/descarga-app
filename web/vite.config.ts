import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' deixa o app funcionar em qualquer endereço (Vercel, subpasta, app de PC/celular)
export default defineConfig({
  base: './',
  plugins: [react()],
})

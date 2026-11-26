import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Política de segurança de conteúdo: só roda código do próprio app, só fala com o nosso servidor
// e bloqueia plugins/objetos embutidos. Vale só no build (o servidor de desenvolvimento precisa de scripts inline).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co ipc: http://ipc.localhost https://ipc.localhost tauri: http://tauri.localhost",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const csp = (): Plugin => ({
  name: 'descarga-csp',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    { tag: 'meta', attrs: { name: 'referrer', content: 'strict-origin-when-cross-origin' }, injectTo: 'head-prepend' },
  ],
})

// base './' deixa o app funcionar em qualquer endereço (Vercel, subpasta, app de PC/celular)
export default defineConfig({
  base: './',
  plugins: [react(), csp()],
})

import { createDemoBackend } from './demoBackend'
import { createSupabaseBackend } from './supabaseBackend'
import type { Backend } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Com as chaves do Supabase no .env, usa o servidor de verdade; sem elas, o modo demonstração. */
export const backend: Backend = url && key ? createSupabaseBackend(url, key) : createDemoBackend()

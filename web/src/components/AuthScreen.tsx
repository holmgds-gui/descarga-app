import { useState, type FormEvent } from 'react'
import { backend } from '../lib/backend'

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (mode === 'signup' && !/^[a-zA-Z0-9_.]{2,32}$/.test(username)) {
      setError('O nome de usuário pode ter letras, números, ponto e _ (2 a 32 caracteres).')
      return
    }
    setBusy(true)
    try {
      if (mode === 'login') await backend.signIn(email, password)
      else {
        const r = await backend.signUp(email, password, username)
        if (r.needsConfirmation) setInfo('Conta criada! Confirme pelo link que enviamos para o seu e-mail.')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setError(null)
    try {
      await backend.signInWithGoogle()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="auth-logo" />
        <h1>{mode === 'login' ? 'Que bom te ver de novo!' : 'Criar uma conta'}</h1>
        <p className="muted">
          {mode === 'login' ? 'Entre para continuar no Descarga.' : 'Leva menos de um minuto. Tudo grátis.'}
        </p>

        <button type="button" className="btn btn-google" onClick={google}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
          </svg>
          Continuar com Google
        </button>

        <div className="divider"><span>ou com e-mail</span></div>

        <form onSubmit={submit} className="form">
          <label>
            E-mail
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="voce@email.com" />
          </label>
          {mode === 'signup' && (
            <label>
              Nome de usuário
              <input required value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="gui.descarga" autoComplete="username" />
            </label>
          )}
          <label>
            Senha
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Mínimo 6 caracteres" />
          </label>
          {error && <p className="form-error">{error}</p>}
          {info && <p className="form-info">{info}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? 'Ainda não tem conta? ' : 'Já tem conta? '}
          <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}>
            {mode === 'login' ? 'Cadastre-se' : 'Entrar'}
          </button>
        </p>

        {backend.mode === 'demo' && (
          <p className="demo-badge">Modo demonstração — os dados ficam só neste navegador.</p>
        )}
      </div>
    </div>
  )
}

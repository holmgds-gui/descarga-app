import { useEffect, useState } from 'react'
import { AuthScreen } from './components/AuthScreen'
import { Shell } from './components/Shell'
import { backend } from './lib/backend'
import { AppProvider } from './state'
import { local, session } from './lib/storage'

const INVITE_KEY = 'descarga-convite-pendente'

export default function App() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined)

  // guarda o código de convite do link (?convite=...) até a pessoa entrar
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const code = params.get('convite')
    if (code) {
      session.set(INVITE_KEY, code)
      params.delete('convite')
      const q = params.toString()
      history.replaceState(null, '', location.pathname + (q ? `?${q}` : '') + location.hash)
    }
  }, [])

  useEffect(() => {
    void backend.currentUserId().then(setUserId)
    return backend.onAuthChange(setUserId)
  }, [])

  useEffect(() => {
    if (!userId) return
    const code = session.get(INVITE_KEY)
    if (!code) return
    session.remove(INVITE_KEY)
    void backend
      .joinServer(code)
      .then((s) => local.set('descarga-ultimo-servidor', s.id))
      .catch(() => console.warn('Convite inválido ou expirado'))
  }, [userId])

  if (userId === undefined)
    return (
      <div className="splash">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" />
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    )

  if (!userId) return <AuthScreen />

  return (
    <AppProvider key={userId} userId={userId}>
      <Shell />
    </AppProvider>
  )
}

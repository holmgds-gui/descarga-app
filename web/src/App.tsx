import { useEffect, useState } from 'react'
import { AuthScreen, NewPasswordScreen } from './components/AuthScreen'
import { Shell } from './components/Shell'
import { backend } from './lib/backend'
import { AppProvider } from './state'
import { local, session } from './lib/storage'
import { refreshPushSubscription } from './lib/push'
import { isRecoveryLink } from './lib/authUrl'
import { useLang } from './lib/i18n'
import { DM_KEY, HOME, SERVER_KEY } from './state'

const INVITE_KEY = 'descarga-convite-pendente'

export default function App() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [recovering, setRecovering] = useState(isRecoveryLink)
  const lang = useLang() // redesenha tudo quando o idioma muda
  useEffect(() => {
    // as notificações deste aparelho passam a chegar no idioma escolhido
    if (userId) void refreshPushSubscription()
  }, [lang, userId])
  useEffect(() => backend.onPasswordRecovery(() => setRecovering(true)), [])

  // guarda o código de convite do link (?convite=...) até a pessoa entrar
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const code = params.get('convite')
    if (code) session.set(INVITE_KEY, code)
    // links das notificações: ?servidor=...&canal=... ou ?dm=...
    const srv = params.get('servidor')
    const ch = params.get('canal')
    const dm = params.get('dm')
    if (srv) {
      local.set(SERVER_KEY, srv)
      if (ch) local.set(`descarga-ultimo-canal-${srv}`, ch)
    }
    if (dm) {
      local.set(SERVER_KEY, HOME)
      local.set(DM_KEY, dm)
    }
    if (code || srv || dm) {
      ;['convite', 'servidor', 'canal', 'dm'].forEach((k) => params.delete(k))
      const q = params.toString()
      history.replaceState(null, '', location.pathname + (q ? `?${q}` : '') + location.hash)
    }
  }, [])

  useEffect(() => {
    void backend.currentUserId().then(setUserId)
    return backend.onAuthChange(setUserId)
  }, [])

  useEffect(() => {
    if (userId) void refreshPushSubscription()
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const code = session.get(INVITE_KEY)
    if (!code) return
    session.remove(INVITE_KEY)
    void backend
      .joinServer(code)
      .then((s) => local.set(SERVER_KEY, s.id))
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
  if (recovering) return <NewPasswordScreen onDone={() => setRecovering(false)} />

  return (
    <AppProvider key={userId} userId={userId}>
      <Shell />
    </AppProvider>
  )
}

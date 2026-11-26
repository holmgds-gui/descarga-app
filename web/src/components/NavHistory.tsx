import { useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useApp, lastChannelKey } from '../state'
import { local } from '../lib/storage'
import { registerBack, setCanBack } from '../lib/nav'

/**
 * Histórico de telas do app: o botão "Voltar" do topo, o botão voltar do Android e do navegador
 * (e o botão de voltar do mouse) levam para a tela anterior em vez de sair do app.
 */
type View =
  | { k: 'home'; section: 'inicio' | 'amigos' }
  | { k: 'dm'; id: string }
  | { k: 'ch'; sid: string; cid: string }
const keyOf = (v: View) => (v.k === 'home' ? 'h:' + v.section : v.k === 'dm' ? 'd:' + v.id : 'c:' + v.cid)

export function NavHistory() {
  const app = useApp()
  const live = useRef(app)
  live.current = app
  const stack = useRef<View[]>([])
  const born = useRef(Date.now())
  const skip = useRef<string | null>(null) // tela para onde "voltar" acabou de ir (não conta como nova)

  const { activeServerId, activeChannelId, channels, activeDmId, homeSection } = app
  const ch = channels.find((c) => c.id === activeChannelId && c.server_id === activeServerId)
  const view: View | null = !activeServerId
    ? activeDmId ? { k: 'dm', id: activeDmId } : { k: 'home', section: homeSection }
    : ch ? { k: 'ch', sid: activeServerId, cid: ch.id } : null
  const vk = view ? keyOf(view) : ''

  useEffect(() => {
    if (!view) return
    const k = keyOf(view)
    if (skip.current === k) { skip.current = null; return }
    skip.current = null
    const st = stack.current
    if (st.length && keyOf(st[st.length - 1]) === k) return
    // a escolha automática do primeiro servidor logo ao abrir substitui a tela inicial (não vira um "voltar")
    if (st.length === 1 && st[0].k === 'home' && Date.now() - born.current < 2500) {
      st[0] = view
      return
    }
    st.push(view)
    if (st.length > 60) st.shift()
    if (st.length > 1) history.pushState({ dn: st.length - 1 }, '') // a primeira tela já tem a sua entrada (criada ao montar)
    setCanBack(st.length > 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vk])

  useEffect(() => {
    history.replaceState({ dn: -1 }, '')
    history.pushState({ dn: 0 }, '')

    const valid = (v: View) => {
      const a = live.current
      return v.k === 'home' || (v.k === 'dm' ? a.dms.some((d) => d.id === v.id) : a.servers.some((s) => s.id === v.sid))
    }
    const go = (v: View) => {
      const a = live.current
      skip.current = keyOf(v)
      flushSync(() => {
        if (v.k === 'home') { a.setHomeSection(v.section); a.setActiveDmId(null) }
        else if (v.k === 'dm') a.setActiveDmId(v.id)
        else {
          local.set(lastChannelKey(v.sid), v.cid)
          if (v.sid === a.activeServerId) a.setActiveChannelId(v.cid)
          else a.setActiveServerId(v.sid)
        }
      })
    }
    const back = () => {
      const a = live.current
      if (a.mobilePane !== 'chat') { a.setMobilePane('chat'); return true } // primeiro fecha a gaveta aberta
      const st = stack.current
      if (st.length <= 1) return false
      st.pop()
      while (st.length > 1 && !valid(st[st.length - 1])) st.pop()
      setCanBack(st.length > 1)
      go(st[st.length - 1])
      return true
    }
    registerBack(() => {
      if (live.current.mobilePane !== 'chat' || stack.current.length > 1) history.back()
    })
    const onPop = (e: PopStateEvent) => {
      const st = stack.current
      if (live.current.settingsOpen) {
        // voltar com as configurações abertas só fecha as configurações
        history.pushState({ dn: st.length - 1 }, '')
        live.current.setSettingsOpen(false)
        return
      }
      if (live.current.mobilePane !== 'chat') {
        // voltar com a gaveta aberta só fecha a gaveta; recoloca a entrada do histórico
        history.pushState({ dn: st.length - 1 }, '')
        live.current.setMobilePane('chat')
        return
      }
      if (st.length > 1) { back(); return }
      if ((e.state as { dn?: number } | null)?.dn === -1) history.back() // já estava na primeira tela: sai do app
      else history.pushState({ dn: 0 }, '')
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      registerBack(() => undefined)
      setCanBack(false)
    }
  }, [])

  return null
}

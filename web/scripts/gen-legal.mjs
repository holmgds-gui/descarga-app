import { readFileSync } from 'node:fs'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const src = readFileSync('src/lib/terms.ts','utf8').split("import { local }")[0]
const tmp = path.join(process.argv[2], 'terms.tmp.ts')
writeFileSync(tmp, src)
const { termsFor } = await import(pathToFileURL(tmp).href)
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const render = (t, lang, other) => `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.title)}</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px 16px;color:#1b1b1f;background:#fff}h1{color:#7B3FE4}h2{margin-top:1.6em;font-size:1.1em}a{color:#7B3FE4}.upd{color:#666}@media(prefers-color-scheme:dark){body{background:#1E1F22;color:#e6e6ea}.upd{color:#9a9aa3}}</style></head>
<body><p><a href="./">← Descarga</a> · <a href="${other}">${lang==='pt-BR'?'English':'Português'}</a></p>
<h1>${esc(t.title)}</h1><p class="upd">${esc(t.updated)}</p><p>${esc(t.intro)}</p>
${t.sections.map(s=>`<h2>${esc(s.h)}</h2>${s.p.map(p=>`<p>${esc(p)}</p>`).join('')}`).join('\n')}
</body></html>`
writeFileSync('public/termos.html', render(termsFor('pt'), 'pt-BR', 'terms-en.html'))
writeFileSync('public/terms-en.html', render(termsFor('en'), 'en', 'termos.html'))
// A política de privacidade é a seção 5 dos termos
const priv = (t, lang, other, title) => { const s = t.sections.find(x=>x.h.startsWith('5.')); return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px 16px;color:#1b1b1f;background:#fff}h1{color:#7B3FE4}a{color:#7B3FE4}@media(prefers-color-scheme:dark){body{background:#1E1F22;color:#e6e6ea}}</style></head>
<body><p><a href="./">← Descarga</a> · <a href="${other}">${lang==='pt-BR'?'English':'Português'}</a></p>
<h1>${title}</h1>${s.p.map(p=>`<p>${esc(p)}</p>`).join('')}
<p>${lang==='pt-BR'?'Login com Google: usamos apenas seu e-mail, nome e foto do perfil Google para criar sua conta.':'Sign in with Google: we only use your Google email, name and profile picture to create your account.'}</p>
<p><a href="${lang==='pt-BR'?'termos.html':'terms-en.html'}">${t.title}</a></p></body></html>` }
writeFileSync('public/privacidade.html', priv(termsFor('pt'),'pt-BR','privacy-en.html','Política de Privacidade do Descarga'))
writeFileSync('public/privacy-en.html', priv(termsFor('en'),'en','privacidade.html','Descarga Privacy Policy'))

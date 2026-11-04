// Gera as listas de emojis leves usadas pelo seletor (public/emoji-pt.json e public/emoji-en.json).
// Rode com: node scripts/emojis.mjs
import { readFileSync, writeFileSync } from 'node:fs'
for (const lang of ['pt', 'en']) {
  const data = JSON.parse(readFileSync(new URL(`../node_modules/emojibase-data/${lang}/compact.json`, import.meta.url)))
  const list = data
    .filter((e) => e.group !== undefined && e.group !== 2)
    .sort((a, b) => a.order - b.order)
    .map((e) => [e.unicode, [e.label, ...(e.tags ?? [])].join(' ').toLowerCase(), e.group])
  writeFileSync(new URL(`../public/emoji-${lang}.json`, import.meta.url), JSON.stringify(list))
  console.log(lang, list.length)
}

import * as compat from '../dist/index.mjs'
import * as icons from '../dist/icons.mjs'
import * as UI from '@sanity/ui'
import * as ICONS from '@sanity/icons'

const name = c => (c && (c.displayName || c.name)) || String(c)
const isFallback = c => name(c).startsWith('SanityUiFallback')

console.log('@sanity/ui version surface: Stack is', typeof UI.Stack, '| STACK_USES_GAP =', compat.STACK_USES_GAP)
console.log('icons symbol map keys:', Object.keys(ICONS.icons || {}).length)

const PRIMS = ['Box','Card','Flex','Text','Heading','Label','Spinner','Button','TextInput',
  'Select','Switch','Dialog','Checkbox','Radio','TextArea','Container']
const fellBack = PRIMS.filter(k => isFallback(compat[k]))
console.log('\nprimitives falling back to DOM on v4:', fellBack.length ? fellBack.join(', ') : 'none')

const WRAPPED = ['Stack','Inline','Grid','Badge','Tooltip','Code','Menu','MenuButton','MenuItem',
  'ActionMenu','Progress','Autocomplete','useToast','ToastViewport']
console.log('wrapper exports present:', WRAPPED.filter(k => compat[k]).length + '/' + WRAPPED.length)
const missingW = WRAPPED.filter(k => !compat[k])
if (missingW.length) console.log('  MISSING:', missingW.join(', '))

const iconNames = Object.keys(icons).filter(k => k.endsWith('Icon'))
const missing = iconNames.filter(k => name(icons[k]) === 'MissingIcon')
console.log('\nicons exported:', iconNames.length)
console.log('icons resolving to MissingIcon (BAD SYMBOL):', missing.length ? missing.join(', ') : 'none')

// Cross-check every symbol in the table against v5's real map.
const map = ICONS.icons || {}
if (Object.keys(map).length) {
  const src = await import('node:fs').then(fs => fs.readFileSync('src/icons.tsx','utf8'))
  const rows = [...src.matchAll(/resolveIcon\('(\w+)',\s*'([a-z0-9-]+)'\)/g)]
  const bad = rows.filter(([,,sym]) => !(sym in map))
  console.log('symbol table rows:', rows.length, '| symbols absent from v5 map:', bad.length ? bad.map(r=>r[1]).join(', ') : 'none')
}

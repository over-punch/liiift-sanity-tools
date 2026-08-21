// Server-renders the compat's fallback paths and asserts what actually reaches the DOM
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as C from '../dist/index.mjs'
import * as Icons from '../dist/icons.mjs'
import * as UI from '@sanity/ui'

/*
 * Resolution tests prove a name binds to something. They do NOT prove the thing
 * renders, or that a translated prop reaches the DOM. Every regression found in the
 * adoption pass — the narrowed Tooltip dropping `content`/`placement`, Grid missing
 * `gap` — was invisible to both tsc and the resolution probe, and would have been
 * caught here.
 *
 * This runs against whatever @sanity/ui is installed. On v4 the relocated exports
 * are absent, so these exercise the hand-written fallbacks, which is the point.
 */

let failures = 0
const check = (name, cond, detail) => {
	if (cond) { console.log(`  ok    ${name}`) }
	else { console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); failures++ }
}

/*
 * Components that resolve to the REAL @sanity/ui need theme context — its styled
 * components read `theme.sanity.v2` and throw outright without a ThemeProvider.
 * Discovered by this script failing on Grid, which is exactly the class of problem
 * a resolution-only probe cannot see.
 *
 * The theme is built from whichever entry the installed major exposes: `studioTheme`
 * on the barrel (v2/v3/v4) or `buildTheme()` from the ./theme subpath (v4).
 */
let theme = UI.studioTheme
if (!theme) {
	try { theme = (await import('@sanity/ui/theme')).buildTheme() } catch { /* leave undefined */ }
}
const withTheme = el => (UI.ThemeProvider && theme ? h(UI.ThemeProvider, { theme }, el) : el)
const render = el => renderToStaticMarkup(withTheme(el))

console.log(`@sanity/ui ${UI.version ?? '(unknown)'} | Tooltip on barrel: ${typeof UI.Tooltip} | STACK_USES_GAP=${C.STACK_USES_GAP}`)

console.log('\nTooltip — the regression that blocked studio-version-badge')
{
	// Not hovered, so the bubble is absent; what matters is that children survive
	// and nothing throws when the previously-dropped props are supplied.
	const html = render(h(C.Tooltip, {
		content: h('b', null, 'rich'), placement: 'left', portal: true, disabled: false,
	}, h('button', null, 'trigger')))
	check('renders children with content/placement/portal supplied', html.includes('trigger'), html.slice(0, 120))

	const disabled = render(h(C.Tooltip, { text: 'hi', disabled: true }, h('button', null, 'bare')))
	check('disabled renders children with no tooltip wrapper',
		disabled.includes('<button>bare</button>') && !disabled.includes('inline-flex'),
		`got ${disabled.slice(0, 160)}`)

	// Guards the exact defect: text-only must still work now that `text` is optional.
	const textOnly = render(h(C.Tooltip, { text: 'hint' }, h('button', null, 't')))
	check('text-only form still renders', textOnly.includes('t'), textOnly.slice(0, 120))
}

console.log('\nGrid / Stack / Inline — two-way gap translation')
{
	const g1 = render(h(C.Grid, { gap: 3 }, 'x'))
	const g2 = render(h(C.Grid, { space: 3 }, 'x'))
	check('Grid accepts gap', g1.includes('x'))
	check('Grid accepts space', g2.includes('x'))
	check('Grid gap and space produce identical output', g1 === g2, `${g1.slice(0,80)} vs ${g2.slice(0,80)}`)
	check('Grid columns renders', render(h(C.Grid, { columns: 2, gap: 1 }, 'c')).includes('c'))
	check('Stack accepts gap', render(h(C.Stack, { gap: 2 }, 's')).includes('s'))
	check('Inline accepts gap', render(h(C.Inline, { gap: 2 }, 'i')).includes('i'))

	// The silent-failure case: neither spelling may leak to the DOM as a stray attribute.
	const leaked = render(h(C.Grid, { gap: 3 }, 'x'))
	check('no raw space=/gap= attribute leaks to DOM',
		!/\s(space|gap)="/.test(leaked), leaked.slice(0, 160))
}

console.log('\nCode — size is forwarded, not hardcoded')
{
	const s0 = render(h(C.Code, { size: 0 }, 'a'))
	const s3 = render(h(C.Code, { size: 3 }, 'a'))
	check('size changes rendered output', s0 !== s3, `size0=${s0.slice(0,90)}`)
	check('default size still renders', render(h(C.Code, null, 'a')).includes('a'))
}

console.log('\nProgress — owned outright, never existed upstream')
{
	const html = render(h(C.Progress, { value: 42 }))
	check('has role=progressbar', html.includes('role="progressbar"'))
	check('reports aria-valuenow', html.includes('aria-valuenow="42"'))
	const clamped = render(h(C.Progress, { value: 999 }))
	check('clamps overflow to 100%', clamped.includes('width:100%'), clamped.slice(0, 200))
}

console.log('\nMenu trio — fallback structure')
{
	const html = render(h(C.MenuButton, {
		id: 'mb',
		button: h('button', null, 'open'),
		menu: h(C.Menu, null, h(C.MenuItem, { text: 'one' }), h(C.MenuItem, { text: 'two' })),
	}))
	check('trigger renders', html.includes('open'), html.slice(0, 140))
	check('closed menu is not in the DOM', !html.includes('one'), html.slice(0, 140))
}

console.log('\nIcons')
{
	const html = render(h(Icons.TrashIcon, null))
	check('icon renders an svg', html.startsWith('<svg'), html.slice(0, 120))
	check('DuplicateIcon (mapped to copy) renders', render(h(Icons.DuplicateIcon, null)).startsWith('<svg'))
}

console.log('\nusePrefersDark')
{
	// No window in node: the fallback must return false rather than throw.
	function Probe() { return h('i', null, String(C.usePrefersDark())) }
	const html = render(h(Probe))
	check('resolves without a DOM',
		html.includes('<i>false</i>') || html.includes('<i>true</i>'), html.slice(0, 160))
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall render checks passed')
process.exit(failures ? 1 : 0)

// Monospace block — Studio's Code where available, a styled <code> block otherwise
import type { CSSProperties, ComponentType, ReactNode } from 'react'
import { UI, resolveComponent } from './resolve'

/** The real Code when the installed @sanity/ui still exports it, otherwise undefined. */
const InstalledCode = resolveComponent<{
	size?: number
	style?: CSSProperties
	children: ReactNode
}>(UI, 'Code')

/**
 * Styling for the fallback Code element, approximating @sanity/ui's `size={1}`.
 * `display: block` is included deliberately — `<code>` is inline by default while
 * upstream's Code renders a block, so omitting it would concatenate every line.
 */
const FALLBACK_CODE_STYLE: CSSProperties = {
	display: 'block',
	fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
	fontSize: '0.8125rem',
	lineHeight: 1.4,
	margin: 0,
}

/** Monospace block. Uses Studio's Code where available, a plain `<code>` on @sanity/ui v4+. */
export function Code({ style, children }: { style?: CSSProperties; children: ReactNode }): React.JSX.Element {
	if (InstalledCode) return <InstalledCode size={1} style={style}>{children}</InstalledCode>
	return <code style={{ ...FALLBACK_CODE_STYLE, ...style }}>{children}</code>
}

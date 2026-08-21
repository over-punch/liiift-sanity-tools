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

/** Font sizes on Sanity's type scale, for the fallback path. Index matches upstream's `size`. */
const FALLBACK_SIZES: Record<number, string> = {
	0: '0.75rem', 1: '0.8125rem', 2: '0.9375rem', 3: '1.0625rem', 4: '1.1875rem', 5: '1.5rem',
}

/** Props for the compat Code. */
export type CodeProps = {
	/** Size step on Sanity's type scale. Defaults to 1, matching upstream's own default. */
	size?: number
	style?: CSSProperties
	children: ReactNode
}

/**
 * Monospace block. Uses Studio's Code where available, a plain `<code>` on
 * @sanity/ui v4+.
 *
 * `size` is forwarded rather than hardcoded. An earlier version pinned `size={1}`
 * and did not accept the prop, which forced consumers to delete their own `size`
 * at the call site — fine when they happened to pass 1, silently wrong otherwise.
 */
export function Code({ size = 1, style, children }: CodeProps): React.JSX.Element {
	if (InstalledCode) return <InstalledCode size={size} style={style}>{children}</InstalledCode>
	const fontSize = FALLBACK_SIZES[size] ?? FALLBACK_SIZES[1]
	return <code style={{ ...FALLBACK_CODE_STYLE, fontSize, ...style }}>{children}</code>
}

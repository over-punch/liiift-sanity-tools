// Layout and control primitives resolved from the installed @sanity/ui, with plain-DOM fallbacks
import { createElement, forwardRef } from 'react'
import type { ComponentType, ReactNode } from 'react'
import type * as SanityUi from '@sanity/ui'
import { UI, resolveComponent, STACK_USES_GAP } from './resolve'

/** Loose props for a resolved @sanity/ui primitive — upstream types vary by major. */
type AnyProps = Record<string, unknown>

/**
 * Build a last-resort component that renders a plain DOM element, used when the
 * installed @sanity/ui no longer exports a name this plugin needs. It drops the
 * design-system props it cannot honour so React does not warn about unknown
 * attributes, and keeps children so the tool stays usable rather than blank.
 *
 * @param tag DOM element to render in place of the missing component.
 */
function domFallback(tag: string): ComponentType<AnyProps> {
	const Fallback = forwardRef<HTMLElement, AnyProps>(function SanityUiFallback(props, ref) {
		const { children, style, id, className, onClick, href, title, as, ...rest } = props
		// `as` is honoured so `Button as="a" href` degrades to a link rather than a
		// dead <button href>, and `Label as="label" htmlFor` keeps its association.
		const element = typeof as === 'string' ? as : tag
		const passthrough: AnyProps = { style, id, className, onClick, href, title, ref }
		for (const key of [
			'role', 'type', 'value', 'checked', 'placeholder', 'disabled', 'tabIndex',
			'onChange', 'onKeyDown', 'onFocus', 'onBlur', 'onMouseEnter', 'onMouseLeave',
			'htmlFor', 'target', 'rel', 'name', 'autoComplete', 'required', 'readOnly',
			// Control-specific attributes, needed once Checkbox/Radio/TextArea degrade here.
			'indeterminate', 'rows', 'cols', 'defaultValue', 'min', 'max', 'step',
		]) {
			if (key in rest) passthrough[key] = rest[key]
		}
		for (const key of Object.keys(rest)) {
			if (key.startsWith('aria-') || key.startsWith('data-')) passthrough[key] = rest[key]
		}
		return createElement(element, passthrough, children as ReactNode)
	})
	Fallback.displayName = `SanityUiFallback(${tag})`
	return Fallback as unknown as ComponentType<AnyProps>
}

/**
 * Resolve one @sanity/ui export, falling back to a DOM element when the installed
 * major no longer provides it. Keeps a relocated export from turning into a
 * module-evaluation failure that stops the whole Studio from booting.
 *
 * @param name Export name on the @sanity/ui barrel.
 * @param tag  DOM element to degrade to.
 */
function primitive(name: string, tag: string): ComponentType<AnyProps> {
	return resolveComponent<AnyProps>(UI, name) ?? domFallback(tag)
}

/*
 * The value comes through the seam so a relocated export degrades instead of
 * failing to link; the *type* is taken from the installed @sanity/ui so call
 * sites keep full prop checking. If a future major tombstones one of these as
 * `never` — as v4 did to Tooltip and Menu — the assertion makes every call site
 * a build error rather than a silent runtime blank.
 */
export const Box = primitive('Box', 'div') as typeof SanityUi.Box
export const Card = primitive('Card', 'div') as typeof SanityUi.Card
export const Flex = primitive('Flex', 'div') as typeof SanityUi.Flex
export const Text = primitive('Text', 'span') as typeof SanityUi.Text
export const Heading = primitive('Heading', 'h2') as typeof SanityUi.Heading
export const Label = primitive('Label', 'label') as typeof SanityUi.Label
export const Spinner = primitive('Spinner', 'span') as typeof SanityUi.Spinner
export const Button = primitive('Button', 'button') as typeof SanityUi.Button
export const TextInput = primitive('TextInput', 'input') as typeof SanityUi.TextInput
export const Select = primitive('Select', 'select') as typeof SanityUi.Select
export const Switch = primitive('Switch', 'input') as typeof SanityUi.Switch
export const Dialog = primitive('Dialog', 'div') as unknown as typeof SanityUi.Dialog
export const Checkbox = primitive('Checkbox', 'input') as typeof SanityUi.Checkbox
export const Radio = primitive('Radio', 'input') as typeof SanityUi.Radio
export const TextArea = primitive('TextArea', 'textarea') as typeof SanityUi.TextArea
export const Container = primitive('Container', 'div') as typeof SanityUi.Container

const SanityStack = primitive('Stack', 'div')
const SanityGrid = primitive('Grid', 'div')
const SanityInline = primitive('Inline', 'div')
const SanityBadge = primitive('Badge', 'span')

/*
 * v4 renamed or removed 20 props across the layout primitives and tombstoned the
 * old names as `never`. They are IGNORED at runtime rather than warned about, so
 * every wrapper below exists to stop a layout collapsing silently. Measured call
 * sites across tools/sanity-tools when this was written: Stack space 298,
 * Grid columns 48, Badge mode 12, Inline space 5.
 */

/** Props for the compat Stack. Mirrors the upstream surface these plugins use. */
export type StackProps = {
	/** Spacing step on Sanity's scale, forwarded as `gap` or `space` per installed major. */
	space?: number
	padding?: number
	paddingX?: number
	paddingY?: number
	flex?: number
	style?: React.CSSProperties
	className?: string
	role?: string
	children?: ReactNode
}

/**
 * Vertical stack. Forwards `space` on @sanity/ui v2 and v3 and `gap` on v4+, so
 * one call site spells spacing correctly on either major. See STACK_USES_GAP for
 * how the two are told apart.
 */
export function Stack({ space, children, ...rest }: StackProps): React.JSX.Element {
	const spacing = space === undefined ? {} : STACK_USES_GAP ? { gap: space } : { space }
	return <SanityStack {...rest} {...spacing}>{children}</SanityStack>
}

/** Props for the compat Inline. */
export type InlineProps = Omit<StackProps, 'role'> & { role?: string }

/** Horizontal inline layout. Same `space` → `gap` rename as Stack on v4. */
export function Inline({ space, children, ...rest }: InlineProps): React.JSX.Element {
	const spacing = space === undefined ? {} : STACK_USES_GAP ? { gap: space } : { space }
	return <SanityInline {...rest} {...spacing}>{children}</SanityInline>
}

/** Props for the compat Grid, covering the three props v4 renamed. */
export type GridProps = {
	/** Gap step. `space` on v2/v3, `gap` on v4+. */
	space?: number
	/** Column template. Renamed to `gridTemplateColumns` on v4. */
	columns?: number | number[]
	/** Row template. Renamed to `gridTemplateRows` on v4. */
	rows?: number | number[]
	padding?: number
	style?: React.CSSProperties
	className?: string
	children?: ReactNode
}

/**
 * CSS grid. v4 renamed `space`, `columns` and `rows`; all three are ignored under
 * their old names, so a grid silently becomes a single column. The rename is keyed
 * off STACK_USES_GAP because the whole family moved in the same release.
 */
export function Grid({ space, columns, rows, children, ...rest }: GridProps): React.JSX.Element {
	const translated: Record<string, unknown> = {}
	if (space !== undefined) translated[STACK_USES_GAP ? 'gap' : 'space'] = space
	if (columns !== undefined) translated[STACK_USES_GAP ? 'gridTemplateColumns' : 'columns'] = columns
	if (rows !== undefined) translated[STACK_USES_GAP ? 'gridTemplateRows' : 'rows'] = rows
	return <SanityGrid {...rest} {...translated}>{children}</SanityGrid>
}

/** Props for the compat Badge. `mode` is accepted for source compatibility and dropped on v4. */
export type BadgeProps = {
	tone?: string
	/** v2/v3 only — REMOVED in v4, not renamed. Dropped rather than leaked to the DOM. */
	mode?: string
	fontSize?: number
	padding?: number
	radius?: number
	style?: React.CSSProperties
	className?: string
	children?: ReactNode
}

/**
 * Status badge. `mode` was removed outright in v4 rather than renamed, so there is
 * nothing to translate it to — it is dropped, which stops it reaching the DOM as a
 * stray `mode="..."` attribute and triggering a React unknown-prop warning.
 */
export function Badge({ mode, children, ...rest }: BadgeProps): React.JSX.Element {
	const legacy = !STACK_USES_GAP && mode !== undefined ? { mode } : {}
	return <SanityBadge {...rest} {...legacy}>{children}</SanityBadge>
}

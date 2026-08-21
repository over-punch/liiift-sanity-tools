// Hover/focus hint — Studio's Tooltip where available, an accessible local tooltip otherwise
import { cloneElement, isValidElement, useId, useState } from 'react'
import type { ComponentType, ReactElement, ReactNode } from 'react'
import { UI, resolveComponent } from './resolve'
import { Box, Card, Text } from './primitives'

/** Which side of the trigger the tooltip sits on. Mirrors @sanity/ui's placement values. */
export type TooltipPlacement =
	| 'top' | 'bottom' | 'left' | 'right'
	| 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'
	| 'left-start' | 'left-end' | 'right-start' | 'right-end'

/**
 * Props for the compat Tooltip.
 *
 * Both `text` and `content` are accepted. `text` is the convenience form and is
 * also used as the accessible description; `content` matches @sanity/ui's own
 * ReactNode prop and wins when both are given.
 *
 * An earlier version of this type accepted ONLY `text` and spread nothing else.
 * That silently dropped `content`, `placement`, `disabled` and `portal` from real
 * call sites and rendered an empty tooltip card — worse than not migrating. Do not
 * narrow this again without checking consumers.
 */
export type TooltipProps = {
	/** Hint text. Becomes the accessible description of the wrapped control while shown. */
	text?: string
	/** Rich hint content. Takes precedence over {@link text}. */
	content?: ReactNode
	/** Side of the trigger to render on. Honoured by the fallback as well as by @sanity/ui. */
	placement?: TooltipPlacement
	/** When true the tooltip is suppressed entirely and children render bare. */
	disabled?: boolean
	/** Render in a portal. Only meaningful when the installed @sanity/ui provides Tooltip. */
	portal?: boolean
	children: ReactNode
}

/** The real Tooltip when the installed @sanity/ui still exports it, otherwise undefined. */
const InstalledTooltip = resolveComponent<{
	content: ReactNode
	portal?: boolean
	placement?: string
	disabled?: boolean
	children: ReactNode
}>(UI, 'Tooltip')

/**
 * Absolute-position styles putting the bubble on the requested side.
 *
 * The padding on the trigger-facing edge is deliberate: it leaves no gap between
 * trigger and bubble, so the pointer can travel onto the tooltip without leaving
 * the hover target (WCAG 1.4.13 Hoverable).
 *
 * `-start` / `-end` variants fall back to their base side rather than being
 * ignored — cross-axis alignment is not worth a layout engine here, but landing
 * on the correct SIDE is, since that is what stops a tooltip covering the control.
 */
function placementStyle(placement: TooltipPlacement): React.CSSProperties {
	const side = placement.split('-')[0]
	switch (side) {
		case 'bottom':
			return { top: '100%', left: '50%', transform: 'translateX(-50%)', paddingTop: 4 }
		case 'left':
			return { right: '100%', top: '50%', transform: 'translateY(-50%)', paddingRight: 4 }
		case 'right':
			return { left: '100%', top: '50%', transform: 'translateY(-50%)', paddingLeft: 4 }
		default:
			return { bottom: '100%', left: '50%', transform: 'translateX(-50%)', paddingBottom: 4 }
	}
}

/**
 * Hint shown on hover and on keyboard focus.
 *
 * The fallback avoids the native `title` attribute: it never appears on keyboard
 * focus or touch, cannot be dismissed, and browsers will not re-read it while the
 * pointer is stationary — which is what silently broke the copy button's
 * "Copied!" confirmation.
 *
 * `aria-describedby` is cloned onto the *child*, not the wrapper. A description is
 * exposed from the focused element, so pointing it at a non-focusable ancestor
 * would name nothing. It is also only attached while the tooltip is shown,
 * because accname resolves directly-referenced hidden nodes — leaving it attached
 * would expose the description permanently and make shown and hidden states
 * indistinguishable.
 */
export function Tooltip({
	text, content, placement = 'top', disabled = false, portal = true, children,
}: TooltipProps): React.JSX.Element {
	const id = useId()
	const [visible, setVisible] = useState(false)

	// A disabled tooltip must not wrap children in the hover span either — otherwise
	// it still changes layout (inline-flex) while showing nothing.
	if (disabled) return <>{children}</>

	const body = content ?? <Box padding={2}><Text size={1}>{text}</Text></Box>

	if (InstalledTooltip) {
		return (
			<InstalledTooltip content={body} portal={portal} placement={placement}>
				{children}
			</InstalledTooltip>
		)
	}

	const described = visible && isValidElement(children)
		? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, { 'aria-describedby': id })
		: children

	return (
		<span
			style={{ position: 'relative', display: 'inline-flex' }}
			onMouseEnter={() => setVisible(true)}
			onMouseLeave={() => setVisible(false)}
			onFocusCapture={() => setVisible(true)}
			onBlurCapture={() => setVisible(false)}
			// Scoped so dismissing a tooltip inside a Dialog does not also close the Dialog.
			onKeyDown={e => { if (e.key === 'Escape' && visible) { e.stopPropagation(); setVisible(false) } }}
		>
			{described}
			{visible && (
				<span
					id={id}
					role="tooltip"
					style={{
						position: 'absolute',
						...placementStyle(placement),
						// Only the plain-text form is safe to keep on one line. Rich `content`
						// can be arbitrarily wide, and nowrap would push it off-screen.
						whiteSpace: content ? 'normal' : 'nowrap',
						zIndex: 1000,
					}}
				>
					{content
						? <Card radius={2} shadow={2}>{content}</Card>
						: <Card radius={2} shadow={2} padding={2}><Text size={1}>{text}</Text></Card>}
				</span>
			)}
		</span>
	)
}

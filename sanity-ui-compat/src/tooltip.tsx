// Hover/focus hint — Studio's Tooltip where available, an accessible local tooltip otherwise
import { cloneElement, isValidElement, useId, useState } from 'react'
import type { ComponentType, ReactElement, ReactNode } from 'react'
import { UI, resolveComponent } from './resolve'
import { Box, Card, Text } from './primitives'

/** Props for the compat Tooltip — plain text rather than @sanity/ui's ReactNode `content`. */
export type TooltipProps = {
	/** Hint text. Also becomes the accessible description of the wrapped control while shown. */
	text: string
	children: ReactNode
}

/** The real Tooltip when the installed @sanity/ui still exports it, otherwise undefined. */
const InstalledTooltip = resolveComponent<{
	content: ReactNode
	portal?: boolean
	children: ReactNode
}>(UI, 'Tooltip')

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
export function Tooltip({ text, children }: TooltipProps): React.JSX.Element {
	const id = useId()
	const [visible, setVisible] = useState(false)

	if (InstalledTooltip) {
		return (
			<InstalledTooltip content={<Box padding={2}><Text size={1}>{text}</Text></Box>} portal>
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
						bottom: '100%',
						left: '50%',
						transform: 'translateX(-50%)',
						// No gap between trigger and tooltip, so the pointer can travel onto it
						// without leaving the hover target (WCAG 1.4.13 Hoverable).
						paddingBottom: 4,
						whiteSpace: 'nowrap',
						zIndex: 1000,
					}}
				>
					<Card radius={2} shadow={2} padding={2}>
						<Text size={1}>{text}</Text>
					</Card>
				</span>
			)}
		</span>
	)
}

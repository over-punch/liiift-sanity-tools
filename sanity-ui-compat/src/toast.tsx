// Toast delivery — Studio's own toast system where available, a local live-region viewport otherwise
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { UI, resolveFunction } from './resolve'
import { Box, Button, Card, Flex, Stack, Text } from './primitives'
import { CloseIcon } from './icons'

/** A toast request — the subset of @sanity/ui's ToastParams this plugin uses. */
export type ToastParams = {
	status?: 'success' | 'error' | 'warning' | 'info'
	title?: ReactNode
	description?: ReactNode
}

/** The object returned by useToast. Only `push` is used here. */
export type Toaster = { push: (params: ToastParams) => void }

/** A queued fallback toast. `id` is a monotonic counter, unique for the session. */
type LocalToast = ToastParams & { id: number }

/** How long a non-error fallback toast stays on screen, in milliseconds. */
const LOCAL_TOAST_MS = 6000

/** Most toasts kept on screen at once; older ones are dropped so the column cannot grow past the viewport. */
const MAX_VISIBLE_TOASTS = 4

/** Stacking index for the fallback viewport. High enough to clear Studio chrome, since it is not in Sanity's Layer stack. */
const TOAST_Z_INDEX = 1000000

/** Card tone per toast status, used only by the fallback viewport. */
type ToastStatus = NonNullable<ToastParams['status']>
const LOCAL_TOAST_TONE: Record<ToastStatus, 'positive' | 'critical' | 'caution' | 'primary'> = {
	success: 'positive',
	error: 'critical',
	warning: 'caution',
	info: 'primary',
}

/** Statuses that stay until dismissed — they carry text the user is expected to act on. */
const PERSISTENT_STATUSES: ReadonlySet<ToastStatus> = new Set<ToastStatus>(['error', 'warning'])

let nextToastId = 0
let localToasts: LocalToast[] = []
const toastListeners = new Set<(toasts: LocalToast[]) => void>()
const dismissTimers = new Map<number, ReturnType<typeof setTimeout>>()

/** Publish the current fallback queue to every mounted viewport. */
function emitToasts(): void {
	for (const listener of toastListeners) listener(localToasts)
}

/** Remove one fallback toast and cancel its pending auto-dismiss. */
function removeLocalToast(id: number): void {
	const timer = dismissTimers.get(id)
	if (timer) {
		clearTimeout(timer)
		dismissTimers.delete(id)
	}
	localToasts = localToasts.filter(t => t.id !== id)
	emitToasts()
}

/** Start (or restart) the auto-dismiss countdown for one toast. Persistent statuses are left alone. */
function scheduleDismiss(id: number, status: ToastParams['status']): void {
	if (PERSISTENT_STATUSES.has(status ?? 'info')) return
	const existing = dismissTimers.get(id)
	if (existing) clearTimeout(existing)
	dismissTimers.set(id, setTimeout(() => removeLocalToast(id), LOCAL_TOAST_MS))
}

/** Queue a fallback toast, trimming the oldest if the column is already full. */
function pushLocalToast(params: ToastParams): void {
	const toast: LocalToast = { ...params, id: nextToastId++ }
	const next = [...localToasts, toast]
	// Cancel timers for anything trimmed off the front, or they fire for an id that
	// is no longer queued and publish a pointless re-render to every viewport.
	for (const dropped of next.slice(0, Math.max(0, next.length - MAX_VISIBLE_TOASTS))) {
		const timer = dismissTimers.get(dropped.id)
		if (timer) {
			clearTimeout(timer)
			dismissTimers.delete(dropped.id)
		}
	}
	localToasts = next.slice(-MAX_VISIBLE_TOASTS)
	emitToasts()
	scheduleDismiss(toast.id, toast.status)
}

/** The real hook when the installed @sanity/ui still exports it, otherwise undefined. */
const installedUseToast = resolveFunction<() => Toaster>(UI, 'useToast')

/** Stable fallback toaster — identity never changes, so it is safe in dependency arrays. */
const localToaster: Toaster = { push: pushLocalToast }

/**
 * Push toasts through Studio's toast system where available, or through
 * {@link ToastViewport} on @sanity/ui v4+.
 *
 * The branch is decided once at module load, so the hook-call order of any
 * component using this is constant across renders.
 */
export function useToast(): Toaster {
	const real = installedUseToast
	if (real) return real()
	return localToaster
}

/**
 * Live region for fallback toasts.
 *
 * The wrapper stays mounted and empty when there is nothing to show: assistive
 * tech has to observe a live region *before* content lands in it, so a region
 * created and populated in the same commit is routinely missed. Renders nothing
 * at all when the installed @sanity/ui provides its own toast system.
 */
export function ToastViewport(): React.JSX.Element | null {
	const [toasts, setToasts] = useState<LocalToast[]>(localToasts)

	useEffect(() => {
		if (installedUseToast) return
		toastListeners.add(setToasts)
		// Re-read after subscribing: a toast pushed between render and commit would otherwise be missed.
		setToasts(localToasts)
		return () => { toastListeners.delete(setToasts) }
	}, [])

	/** Re-arm auto-dismiss, unless the toast still holds focus. */
	const resume = useCallback((toast: LocalToast, el: HTMLElement | null) => {
		if (el && el.contains(document.activeElement)) return
		scheduleDismiss(toast.id, toast.status)
	}, [])

	const hold = useCallback((id: number) => {
		const timer = dismissTimers.get(id)
		if (timer) {
			clearTimeout(timer)
			dismissTimers.delete(id)
		}
	}, [])

	if (installedUseToast) return null

	return (
		<Box
			// role="log" carries aria-live="polite" with atomic=false and
			// relevant="additions", which is what an append-only stack wants —
			// role="status" implies atomic=true and re-announces the whole column.
			role="log"
			aria-label="Deployment notifications"
			// pointer-events is released so the fixed column cannot swallow clicks on the tool beneath it.
			style={{
				position: 'fixed',
				bottom: 16,
				right: 16,
				zIndex: TOAST_Z_INDEX,
				width: 'min(360px, calc(100vw - 32px))',
				pointerEvents: 'none',
			}}
		>
			<Stack space={2}>
				{toasts.map(toast => (
					<Card
						key={toast.id}
						padding={3}
						radius={2}
						shadow={3}
						tone={LOCAL_TOAST_TONE[toast.status ?? 'info']}
						style={{ pointerEvents: 'auto' }}
						onMouseEnter={() => hold(toast.id)}
						onFocusCapture={() => hold(toast.id)}
						onMouseLeave={e => resume(toast, e.currentTarget)}
						onBlurCapture={e => resume(toast, e.currentTarget)}
					>
						<Flex align="flex-start" gap={3}>
							<Stack space={2} flex={1}>
								{toast.title && <Text size={1} weight="semibold">{toast.title}</Text>}
								{toast.description && <Text size={1} muted>{toast.description}</Text>}
							</Stack>
							<Button
								mode="bleed"
								padding={2}
								icon={CloseIcon}
								text=""
								aria-label="Dismiss notification"
								onClick={() => removeLocalToast(toast.id)}
							/>
						</Flex>
					</Card>
				))}
			</Stack>
		</Box>
	)
}

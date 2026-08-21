// Hooks resolved from the installed @sanity/ui, with standalone fallbacks
import { useEffect, useState } from 'react'
import { UI, resolveFunction } from './resolve'

/**
 * The installed hook, when present.
 *
 * Verified a live function export on @sanity/ui 2.8.9, 3.1.14 and 4.0.5 — unlike
 * Tooltip and the menu trio it was NOT relocated in v4. It is resolved through the
 * seam anyway: a future major could move it, and the whole point of this package
 * is that such a move degrades instead of throwing at module-evaluation time.
 */
const installedUsePrefersDark = resolveFunction<() => boolean>(UI, 'usePrefersDark')

/** The media query @sanity/ui itself keys colour scheme off. */
const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * Whether the user prefers a dark colour scheme.
 *
 * Falls back to reading the media query directly. Note this is NOT identical to
 * upstream's hook: @sanity/ui reports the *Studio theme's* scheme, which a user
 * can set to light or dark independently of the OS. The fallback can only see the
 * OS preference, so on a future major that relocates the hook, a Studio forced to
 * light on a dark-mode OS would read `true` here.
 *
 * That difference is why this is worth stating rather than hiding: consumers use
 * it to pick syntax-highlighting colours, and being wrong makes text unreadable
 * rather than merely off-brand.
 */
function useFallbackPrefersDark(): boolean {
	// Guarded for SSR and for jsdom without matchMedia, both of which appear in
	// plugin test suites.
	const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
	const [prefers, setPrefers] = useState<boolean>(() => (supported ? window.matchMedia(DARK_QUERY).matches : false))

	useEffect(() => {
		if (!supported) return
		const mql = window.matchMedia(DARK_QUERY)
		const onChange = (e: MediaQueryListEvent) => setPrefers(e.matches)
		mql.addEventListener('change', onChange)
		// Re-read on mount: the preference can change between the initial state
		// computation and the listener being attached.
		setPrefers(mql.matches)
		return () => mql.removeEventListener('change', onChange)
	}, [supported])

	return prefers
}

/*
 * Selected at module scope, not inside the hook.
 *
 * Branching inside would mean calling one hook or another conditionally. It would
 * work — the condition is a module constant, so the order is stable across renders
 * — but react-hooks/rules-of-hooks flags it statically and it stops being true the
 * moment anything about the resolution becomes dynamic. Picking here keeps every
 * call site's hook sequence unconditional.
 */
export const usePrefersDark: () => boolean = installedUsePrefersDark ?? useFallbackPrefersDark

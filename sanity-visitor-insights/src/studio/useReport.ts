/**
 * Data hook for the Studio panels.
 *
 * Forwards the Studio's own Sanity session token to the site's API route, which verifies it against
 * Sanity. There is no shared secret: the Studio bundle is public, so anything compiled into it is
 * extractable.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useClient } from 'sanity'
import type { RangeKey, ReportEnvelope, ReportName } from '../types'

/** Sanity API version this tool pins. Fixed rather than "latest" so behaviour cannot drift. */
const API_VERSION = '2024-03-01'

/** Loading state for a report. */
export type ReportState<T> =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'ready'; envelope: ReportEnvelope<T> }
	| { status: 'error'; message: string }

/** Options for useReport. */
export interface UseReportOptions {
	/** Base URL of the site serving the reports, e.g. `https://dardenstudio.com`. */
	apiBaseUrl: string
	report: ReportName
	range: RangeKey
}

/**
 * Fetch a report, re-fetching when the range changes.
 *
 * @returns the current state plus a `reload` for manual refresh
 */
export function useReport<T>({ apiBaseUrl, report, range }: UseReportOptions): {
	state: ReportState<T>
	reload: () => void
} {
	const client = useClient({ apiVersion: API_VERSION })
	const [state, setState] = useState<ReportState<T>>({ status: 'idle' })
	const [nonce, setNonce] = useState(0)

	// Lets an in-flight response from a previous range be discarded rather than overwriting a newer one.
	const requestIdRef = useRef(0)

	const reload = useCallback(() => setNonce((n) => n + 1), [])

	useEffect(() => {
		const requestId = requestIdRef.current + 1
		requestIdRef.current = requestId

		const controller = new AbortController()
		setState({ status: 'loading' })

		async function run() {
			// The Studio client carries the session token under token-based auth. Under cookie-based
			// auth it does not, and there is no way to forward credentials the browser will not
			// expose — so say so plainly rather than failing with an opaque 401.
			const token = client.config().token
			if (!token) {
				setState({
					status: 'error',
					message: 'No Sanity session token available in this Studio. Visitor Insights needs token-based auth to call the site API.',
				})
				return
			}

			try {
				const url = `${apiBaseUrl.replace(/\/$/, '')}/api/visitor-insights/${report}?range=${range}`
				const response = await fetch(url, {
					headers: { Authorization: `Bearer ${token}` },
					signal: controller.signal,
				})

				if (requestIdRef.current !== requestId) return

				if (!response.ok) {
					const detail = response.status === 401 ? 'Not authorised — sign in to the Studio again.' : `Request failed (${response.status})`
					setState({ status: 'error', message: detail })
					return
				}

				const envelope = (await response.json()) as ReportEnvelope<T>
				if (requestIdRef.current !== requestId) return

				setState({ status: 'ready', envelope })
			} catch (e) {
				if (controller.signal.aborted || requestIdRef.current !== requestId) return
				setState({ status: 'error', message: (e as Error).message })
			}
		}

		void run()
		return () => controller.abort()
	}, [client, apiBaseUrl, report, range, nonce])

	return { state, reload }
}

/**
 * Vercel Web Analytics client.
 *
 * Vercel's Web Analytics read API is not a stable, versioned public surface the way the GA4 Data
 * API is, and access depends on plan tier. This client is therefore written to degrade rather than
 * throw: a missing token, an unavailable plan, or a changed endpoint all surface as an unconfigured
 * or errored source in the report envelope, so the Measurement Health panel can say "Vercel did not
 * answer" instead of implying the site had no traffic.
 *
 * Vercel is counted here purely as a second, cookieless pageview measurement. It is never treated
 * as ground truth, and never subtracted from a GA4 session count — those are different units.
 */

const API_BASE = 'https://api.vercel.com'

/** Daily pageview counts, keyed by ISO date. */
export interface VercelPageviews {
	byDate: Record<string, number>
	total: number
}

/** A Vercel client bound to one project. */
export interface VercelClient {
	pageviews(start: string, end: string): Promise<VercelPageviews>
}

/**
 * Build a Vercel Web Analytics client.
 *
 * @param projectId - the Vercel project id
 * @param token - a Vercel API token with read access to that project
 * @param teamId - team scope, required when the project belongs to a team
 */
export function createVercelClient(projectId: string, token: string, teamId?: string): VercelClient {
	return {
		async pageviews(start, end) {
			const params = new URLSearchParams({
				projectId,
				since: `${start}T00:00:00.000Z`,
				until: `${end}T23:59:59.999Z`,
			})
			if (teamId) params.set('teamId', teamId)

			const response = await fetch(`${API_BASE}/v1/web-analytics/timeseries?${params.toString()}`, {
				headers: { Authorization: `Bearer ${token}` },
			})

			if (!response.ok) {
				throw new Error(`Vercel Web Analytics failed with ${response.status}`)
			}

			const body = (await response.json()) as { data?: Array<{ key?: string; total?: number; devices?: number }> }
			const byDate: Record<string, number> = {}
			let total = 0

			for (const point of body.data ?? []) {
				if (!point.key) continue
				// `key` is a timestamp or date string depending on granularity; normalise to a date.
				const date = point.key.slice(0, 10)
				const count = typeof point.total === 'number' ? point.total : 0
				byDate[date] = (byDate[date] ?? 0) + count
				total += count
			}

			return { byDate, total }
		},
	}
}

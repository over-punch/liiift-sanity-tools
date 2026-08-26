/**
 * The mountable Next.js API-route handler.
 *
 * Ships from this package rather than being copy-pasted into each site so the three foundries
 * cannot drift apart: a fix applied here reaches all of them on a version bump, instead of being
 * applied to one repo and forgotten in the other two. A consuming site's route is then:
 *
 *   // pages/api/visitor-insights/[report].js
 *   import { createVisitorInsightsHandler } from '@liiift-studio/sanity-visitor-insights/server'
 *   export default createVisitorInsightsHandler({ config: mySiteConfig })
 *
 * Credentials are read from the environment inside this module and never leave the server.
 */

import {
	isReportName,
	type DateRange,
	type RangeKey,
	type ReportEnvelope,
	type SourceName,
	type SourceStatus,
} from '../types'
import { assertValidSiteConfig, type SiteAnalyticsConfig } from '../core/siteConfig'
import { coverageNotices } from '../core/cutover'
import { resolveRange, provisionalNotice } from '../core/ranges'
import { applyCors, requireStudioUser, type HandlerRequest, type HandlerResponse } from './auth'
import { createGa4Client, type Ga4Client } from './ga4'
import { createVercelClient, type VercelClient } from './vercel'
import { parseServiceAccountKey } from './googleAuth'
import { cacheKey, withCache, DEFAULT_TTL_MS } from './cache'
import type { SanityQueryClient } from './orders'
import { measurementHealth } from './reports/measurementHealth'
import { acquisition } from './reports/acquisition'
import { journey } from './reports/journey'
import { typefaceInterest } from './reports/typefaceInterest'
import { JOURNEY_STEPS } from './reports/journey'

/** Environment variables this handler reads. Names are fixed so all three sites match. */
export const ENV_VARS = {
	/** Service-account JSON (raw or base64) with Viewer on the GA4 property. */
	googleServiceAccount: 'VISITOR_INSIGHTS_GA4_SERVICE_ACCOUNT',
	/** Vercel API token with read access to the project. */
	vercelToken: 'VISITOR_INSIGHTS_VERCEL_TOKEN',
} as const

/** Options for building a handler. */
export interface HandlerOptions {
	/** This site's description of itself. */
	config: SiteAnalyticsConfig
	/**
	 * Sanity client used for order counts. Supply the site's existing server-side client so this
	 * package does not need its own Sanity credentials.
	 */
	sanityClient?: SanityQueryClient
	/** Sanity project id used to verify Studio tokens. Defaults to `SANITY_STUDIO_PROJECT_ID`. */
	sanityProjectId?: string
	/** Cache lifetime for report responses. */
	cacheTtlMs?: number
}

/** Valid range keys, as an allow-list for the query parameter. */
const RANGE_KEYS: RangeKey[] = ['week', 'quarter', 'year']

/** Read a query parameter that may arrive as a string or an array. */
function param(req: HandlerRequest, name: string): string | undefined {
	const raw = req.query?.[name]
	return Array.isArray(raw) ? raw[0] : raw
}

/**
 * Build the API-route handler for a site.
 *
 * @param options - the site config and its Sanity client
 * @returns a Next.js Pages Router API handler
 */
export function createVisitorInsightsHandler(options: HandlerOptions) {
	// Fail at construction rather than per-request, so a misconfiguration surfaces on deploy.
	assertValidSiteConfig(options.config)

	const config = options.config
	const ttl = options.cacheTtlMs ?? DEFAULT_TTL_MS

	return async function handler(req: HandlerRequest, res: HandlerResponse): Promise<void> {
		if (applyCors(req, res, config.allowedStudioOrigins ?? [])) return

		if (req.method !== 'GET') {
			res.status(405).json({ error: 'Method not allowed' })
			return
		}

		const sanityProjectId = options.sanityProjectId ?? process.env.SANITY_STUDIO_PROJECT_ID ?? ''
		const user = await requireStudioUser(req, res, sanityProjectId)
		if (!user) return

		// Strict allow-list. The report name selects from a fixed set and is never used to build
		// an upstream request path or to look up code dynamically.
		const reportName = param(req, 'report')
		if (!isReportName(reportName)) {
			res.status(400).json({ error: 'Unknown report' })
			return
		}

		const rangeKey = param(req, 'range') ?? 'week'
		if (!RANGE_KEYS.includes(rangeKey as RangeKey)) {
			res.status(400).json({ error: 'Unknown range' })
			return
		}

		// Ranges are anchored to the GA4 property's timezone so all three sources agree on
		// where a day begins. Falls back to UTC only when GA4 is not configured at all.
		const timezone = config.ga4?.timezone ?? 'UTC'
		const range = resolveRange(rangeKey as RangeKey, timezone)

		const sources: Partial<Record<SourceName, SourceStatus>> = {}

		const serviceAccount = parseServiceAccountKey(process.env[ENV_VARS.googleServiceAccount])
		let ga4: Ga4Client | null = null
		if (!config.ga4) {
			sources.ga4 = { status: 'unconfigured' }
		} else if (!serviceAccount) {
			sources.ga4 = { status: 'error', message: 'Service account missing or unparseable' }
		} else {
			ga4 = createGa4Client(config.ga4.propertyId, serviceAccount)
			sources.ga4 = { status: 'ok' }
		}

		const vercelToken = process.env[ENV_VARS.vercelToken]
		let vercel: VercelClient | null = null
		if (!config.vercel) {
			sources.vercel = { status: 'unconfigured' }
		} else if (!vercelToken) {
			sources.vercel = { status: 'error', message: 'Vercel token missing' }
		} else {
			vercel = createVercelClient(config.vercel.projectId, vercelToken, config.vercel.teamId)
			sources.vercel = { status: 'ok' }
		}

		const sanity = options.sanityClient ?? null
		sources.sanity = sanity ? { status: 'ok' } : { status: 'unconfigured' }

		try {
			const key = cacheKey(['vi', config.siteId, reportName, range.key, range.start, range.end])

			const envelope = await withCache<ReportEnvelope<unknown>>(key, ttl, async () => {
				const notices: string[] = []

				const provisional = provisionalNotice(range)
				if (provisional) notices.push(provisional)

				const data = await runReport(reportName, { config, range, ga4, vercel, sanity, notices })

				return { report: reportName, range, sources, notices, data }
			})

			res.status(200).json(envelope)
		} catch (e) {
			// Upstream messages can echo request detail, so only a generic message crosses the wire.
			console.error(`Visitor insights: report "${reportName}" failed:`, (e as Error).message)
			res.status(502).json({ error: 'Report failed', report: reportName })
		}
	}
}

/** Arguments shared by every report. */
interface RunContext {
	config: SiteAnalyticsConfig
	range: DateRange
	ga4: Ga4Client | null
	vercel: VercelClient | null
	sanity: SanityQueryClient | null
	notices: string[]
}

/** Dispatch to a report by name. A plain switch, so the set of reachable code paths is closed. */
async function runReport(report: string, ctx: RunContext): Promise<unknown> {
	const { config, range, ga4, vercel, sanity, notices } = ctx

	switch (report) {
		case 'measurement-health':
			return measurementHealth({ config, range, ga4, vercel, sanity })

		case 'acquisition':
			if (!ga4) throw new Error('GA4 is required for the acquisition report')
			return acquisition(ga4, range)

		case 'journey': {
			if (!ga4) throw new Error('GA4 is required for the journey report')
			notices.push(...coverageNotices(config.eventCutovers, JOURNEY_STEPS.map((s) => s.event), range))
			return journey(config, ga4, range)
		}

		case 'typeface-interest':
			if (!ga4) throw new Error('GA4 is required for the typeface-interest report')
			return typefaceInterest({ config, range, ga4, sanity })

		default:
			throw new Error(`Unhandled report: ${report}`)
	}
}

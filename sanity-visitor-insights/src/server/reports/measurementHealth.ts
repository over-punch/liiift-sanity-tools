/**
 * Measurement Health — "what are we missing?", answered honestly.
 *
 * This panel began life as a "coverage gap" that subtracted Vercel pageviews from GA4 sessions and
 * attributed the difference to consent, ad-blockers and bots. That is not a valid subtraction:
 * sessions and pageviews are different units, so the difference is dominated by the unit mismatch
 * rather than by anything missing. Worse, GA4 exposes no signal that separates consent-denied from
 * blocked from bot traffic, so the attribution would have been a guess rendered with the authority
 * of a measurement.
 *
 * What this reports instead:
 *   - GA4 pageviews against Vercel pageviews, the same unit on both sides
 *   - GA4 sessions and orders alongside as context, never subtracted
 *   - one residual, labelled unexplained, with the causes we can actually measure broken out
 *
 * The only cause we can measure is consent: a `consent_granted` event makes the acceptance rate a
 * real number rather than an inference. Until that event is instrumented, the residual stays whole
 * and the panel says why.
 */

import type { MeasurementHealthData } from '../../reportData'
import type { DateRange, MetricValue } from '../../types'
import { ok, unavailable } from '../../types'
import type { SiteAnalyticsConfig } from '../../core/siteConfig'
import { coverageForRange } from '../../core/cutover'
import { sumFirstMetric, type Ga4Client } from '../ga4'
import type { VercelClient } from '../vercel'
import { countOrders, type SanityQueryClient } from '../orders'

/** The event whose presence turns the consent share from a guess into a measurement. */
const CONSENT_EVENT = 'consent_granted'


/** Inputs for the measurement-health report. */
export interface MeasurementHealthInput {
	config: SiteAnalyticsConfig
	range: DateRange
	ga4: Ga4Client | null
	vercel: VercelClient | null
	sanity: SanityQueryClient | null
}

/** Build the plain-language reading shown beneath the figures. */
function interpret(ga4Views: MetricValue, vercelViews: MetricValue, shortfall: number | null, consent: MetricValue): string {
	if (ga4Views.status === 'unavailable' && vercelViews.status === 'unavailable') {
		return 'Neither source answered, so nothing can be said about coverage for this range.'
	}
	if (shortfall === null) {
		return 'Only one pageview source answered, so the two cannot be compared for this range.'
	}

	const percent = Math.round(Math.abs(shortfall) * 100)

	if (Math.abs(shortfall) < 0.05) {
		return `GA4 and Vercel agree to within ${percent}% on pageviews. Nothing here suggests a measurement problem.`
	}

	const direction = shortfall > 0 ? 'fewer' : 'more'
	const base = `GA4 recorded ${percent}% ${direction} pageviews than Vercel.`

	if (consent.status === 'unavailable') {
		return `${base} How much of that is consent refusal cannot be measured until the consent_granted event is instrumented, so the difference is currently unexplained rather than attributed.`
	}

	const consentPercent = Math.round((1 - consent.value / 100) * 100)
	return `${base} Around ${consentPercent}% of sessions did not grant analytics consent, which accounts for part of it. The remainder is unexplained — ad-blocking and bot filtering are plausible but are not separately measurable.`
}

/**
 * Run the measurement-health report.
 *
 * Each source is queried independently and a failure in one degrades only its own figures, so the
 * panel can always say which source did not answer rather than showing an unexplained blank.
 */
export async function measurementHealth(input: MeasurementHealthInput): Promise<MeasurementHealthData> {
	const { config, range, ga4, vercel, sanity } = input

	let ga4Pageviews: MetricValue = unavailable('source_error', 'GA4 not configured')
	let ga4Sessions: MetricValue = unavailable('source_error', 'GA4 not configured')
	let consentRate: MetricValue = unavailable('not_instrumented')

	if (ga4) {
		try {
			// One batched call rather than three separate quota-charged requests.
			const [views, sessions, consent] = await ga4.batchRunReports([
				{
					metrics: [{ name: 'screenPageViews' }],
					dateRanges: [{ startDate: range.start, endDate: range.end }],
				},
				{
					metrics: [{ name: 'sessions' }],
					dateRanges: [{ startDate: range.start, endDate: range.end }],
				},
				{
					metrics: [{ name: 'eventCount' }],
					dimensions: [{ name: 'eventName' }],
					dateRanges: [{ startDate: range.start, endDate: range.end }],
					dimensionFilter: {
						filter: {
							fieldName: 'eventName',
							stringFilter: { matchType: 'EXACT', value: CONSENT_EVENT },
						},
					},
				},
			])

			if (views) ga4Pageviews = ok(sumFirstMetric(views))
			if (sessions) ga4Sessions = ok(sumFirstMetric(sessions))

			const consentCoverage = coverageForRange(config.eventCutovers, CONSENT_EVENT, range)
			if (consentCoverage.status === 'full' && consent && ga4Sessions.status === 'ok' && ga4Sessions.value > 0) {
				// Expressed as a percentage of sessions, capped since one session can fire it twice.
				const rate = Math.min(100, (sumFirstMetric(consent) / ga4Sessions.value) * 100)
				consentRate = ok(Math.round(rate * 10) / 10)
			} else if (consentCoverage.status === 'partial') {
				consentRate = unavailable('before_cutover', `Instrumented from ${consentCoverage.cutover}`)
			}
		} catch (e) {
			console.error('Visitor insights: GA4 measurement-health query failed:', (e as Error).message)
			ga4Pageviews = unavailable('source_error')
			ga4Sessions = unavailable('source_error')
		}
	}

	let vercelPageviews: MetricValue = unavailable('source_error', 'Vercel not configured')
	if (vercel) {
		try {
			const result = await vercel.pageviews(range.start, range.end)
			vercelPageviews = ok(result.total)
		} catch (e) {
			console.error('Visitor insights: Vercel query failed:', (e as Error).message)
			vercelPageviews = unavailable('source_error')
		}
	}

	let orders: MetricValue = unavailable('source_error', 'Sanity not configured')
	if (sanity) {
		try {
			const counts = await countOrders(
				sanity,
				config.orders.documentType,
				range.start,
				range.end,
				config.orders.excludeFilter,
			)
			orders = ok(counts.total)
		} catch (e) {
			console.error('Visitor insights: order count failed:', (e as Error).message)
			orders = unavailable('source_error')
		}
	}

	// Computed only when both operands are real numbers, and only between matching units.
	const shortfallRatio =
		ga4Pageviews.status !== 'unavailable' && vercelPageviews.status !== 'unavailable' && vercelPageviews.value > 0
			? (vercelPageviews.value - ga4Pageviews.value) / vercelPageviews.value
			: null

	return {
		ga4Pageviews,
		vercelPageviews,
		shortfallRatio,
		ga4Sessions,
		orders,
		consentRate,
		interpretation: interpret(ga4Pageviews, vercelPageviews, shortfallRatio, consentRate),
	}
}

export type { MeasurementHealthData } from '../../reportData'

/**
 * Journey — how far visitors get, and where they stop.
 *
 * This is an ordered step funnel, not a path graph, and that is a deliberate limit rather than a
 * simplification. GA4's Data API has no path-exploration endpoint; Path Exploration is a UI-only
 * feature. What is available is per-event totals and `runFunnelReport`, an alpha surface that
 * returns step-conversion marginals — not observed sequences. Rendering ribbons from marginals
 * would assert that a given visitor went A to B to C when no such co-occurrence was ever measured.
 *
 * So each step is reported as its own honest total, adjacent drop-off is derived between steps, and
 * the response is explicitly flagged as an approximation for the UI to display.
 *
 * A step whose event is not instrumented on this site reports as unavailable, never as zero. On a
 * site missing `begin_checkout`, the cart-to-checkout drop-off is not "100% drop-off" — it is
 * unmeasured, and the two must not look alike.
 */

import type { JourneyData, JourneyStep, ExitPage } from '../../reportData'
import type { DateRange, MetricValue } from '../../types'
import type { SiteAnalyticsConfig } from '../../core/siteConfig'
import { applyCoverage, coverageForRange } from '../../core/cutover'
import { eventNameFilter, sumFirstMetric, type Ga4Client } from '../ga4'

/** The funnel, in order. Each entry names the GA4 event that evidences the step. */
export const JOURNEY_STEPS = [
	{ key: 'landed', label: 'Landed', event: 'page_view' },
	{ key: 'viewed_typeface', label: 'Viewed a typeface', event: 'view_item' },
	{ key: 'tested', label: 'Used the type tester', event: 'tester_engaged' },
	{ key: 'added_to_cart', label: 'Added to cart', event: 'add_to_cart' },
	{ key: 'began_checkout', label: 'Began checkout', event: 'begin_checkout' },
	{ key: 'purchased', label: 'Purchased', event: 'purchase' },
] as const




const APPROXIMATION_NOTE =
	'These are independent per-step totals, not tracked journeys. GA4 cannot report the actual path a ' +
	'visitor took, so a visitor counted at one step is not necessarily the same visitor counted at the next.'

/**
 * Run the journey report.
 *
 * All step queries go in one batched call rather than one request per step, which would otherwise
 * make this the most quota-expensive panel in the tool.
 */
export async function journey(config: SiteAnalyticsConfig, ga4: Ga4Client, range: DateRange): Promise<JourneyData> {
	// Only query steps whose event could return data; skip the rest to save quota.
	const coverages = JOURNEY_STEPS.map((step) => ({
		step,
		coverage: coverageForRange(config.eventCutovers, step.event, range),
	}))

	const queryable = coverages.filter((entry) => entry.coverage.status !== 'none')

	const reports = await ga4.batchRunReports(
		queryable.map((entry) => ({
			metrics: [{ name: 'eventCount' }],
			dateRanges: [{ startDate: range.start, endDate: range.end }],
			dimensionFilter: eventNameFilter(entry.step.event),
		})),
	)

	const countsByEvent = new Map<string, number>()
	queryable.forEach((entry, index) => {
		const report = reports[index]
		if (report) countsByEvent.set(entry.step.event, sumFirstMetric(report))
	})

	const steps: JourneyStep[] = []
	let previousMeasurable: number | null = null

	for (const { step, coverage } of coverages) {
		const raw = countsByEvent.has(step.event) ? (countsByEvent.get(step.event) as number) : null
		const count = applyCoverage(raw, coverage)

		const current = count.status === 'unavailable' ? null : count.value
		const conversionFromPrevious =
			previousMeasurable !== null && current !== null && previousMeasurable > 0
				? current / previousMeasurable
				: null

		steps.push({ key: step.key, label: step.label, event: step.event, count, conversionFromPrevious })

		// Only advance the baseline on a measurable step, so an unavailable rung does not
		// silently make the next step's conversion look like a collapse.
		if (current !== null) previousMeasurable = current
	}

	let topExitPages: ExitPage[] = []
	try {
		const exits = await ga4.runReport({
			dimensions: [{ name: 'pagePath' }],
			metrics: [{ name: 'exits' }],
			dateRanges: [{ startDate: range.start, endDate: range.end }],
			orderBys: [{ metric: { metricName: 'exits' }, desc: true }],
			limit: 10,
		})

		topExitPages = exits.rows.map((row) => ({
			path: row.dimensions[0] ?? '(unknown)',
			exits: Number.isFinite(row.metrics[0]) ? (row.metrics[0] as number) : 0,
		}))
	} catch (e) {
		// Exit pages are supplementary; losing them should not fail the funnel.
		console.error('Visitor insights: exit-page query failed:', (e as Error).message)
	}

	return { steps, topExitPages, approximate: true, approximationNote: APPROXIMATION_NOTE }
}

export type { JourneyData, JourneyStep, ExitPage } from '../../reportData'

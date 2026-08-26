/**
 * Typeface interest — viewed, tested, bought, per family.
 *
 * This is the one panel GA4's own UI cannot produce, because it joins GA4 engagement to Sanity
 * order documents. It is also the panel most easily misread, so two things are stated in the
 * response rather than left to the reader:
 *
 *   1. It measures aggregate interest per family, not one person's journey. In foundry sales the
 *      designer who tests a typeface is frequently not the person who later pays for it, and the
 *      gap between the two can be months. A low tested-to-bought ratio is therefore not a broken
 *      funnel, and the UI must not frame it as one.
 *   2. "Tested" counts only genuine engagement — a `tester_engaged` event fired when the visitor
 *      changed something. Firing on tester open would count every default-state page load as a
 *      test and make the ratio meaningless.
 */

import type { TypefaceInterestData, TypefaceInterestRow } from '../../reportData'
import type { DateRange, MetricValue } from '../../types'
import { ok, unavailable } from '../../types'
import type { SiteAnalyticsConfig } from '../../core/siteConfig'
import { coverageForRange } from '../../core/cutover'
import { eventNameFilter, type Ga4Client } from '../ga4'
import { countOrdersByTypeface, type SanityQueryClient } from '../orders'

/** GA4 event evidencing a typeface page view. */
const VIEW_EVENT = 'view_item'

/** GA4 event evidencing real type-tester engagement. */
const TEST_EVENT = 'tester_engaged'



const INTERPRETATION_NOTE =
	'Aggregate interest per family, not individual journeys. The person who tests a typeface is often ' +
	'not the person who buys it, and may buy months later — so a low tested-to-bought ratio is not ' +
	'necessarily a conversion problem.'

/**
 * Read per-typeface event counts keyed by the GA4 `itemName` dimension.
 * Returns null when the event is not usable for this range, so the caller can distinguish
 * "no data" from "no interest".
 */
async function countsByItem(
	config: SiteAnalyticsConfig,
	ga4: Ga4Client,
	range: DateRange,
	eventName: string,
): Promise<Map<string, number> | null> {
	if (coverageForRange(config.eventCutovers, eventName, range).status === 'none') return null

	const report = await ga4.runReport({
		dimensions: [{ name: 'itemName' }],
		metrics: [{ name: 'eventCount' }],
		dateRanges: [{ startDate: range.start, endDate: range.end }],
		dimensionFilter: eventNameFilter(eventName),
		orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
		limit: 100,
	})

	const counts = new Map<string, number>()
	for (const row of report.rows) {
		const name = row.dimensions[0]
		const value = row.metrics[0]
		if (name && Number.isFinite(value)) counts.set(name, value as number)
	}

	return counts
}

/** Inputs for the typeface-interest report. */
export interface TypefaceInterestInput {
	config: SiteAnalyticsConfig
	range: DateRange
	ga4: Ga4Client
	sanity: SanityQueryClient | null
}

/** Run the typeface-interest report. */
export async function typefaceInterest(input: TypefaceInterestInput): Promise<TypefaceInterestData> {
	const { config, range, ga4, sanity } = input

	const [viewed, tested] = await Promise.all([
		countsByItem(config, ga4, range, VIEW_EVENT),
		countsByItem(config, ga4, range, TEST_EVENT),
	])

	let bought: Map<string, number> | null = null
	if (sanity) {
		try {
			const counts = await countOrdersByTypeface(
				sanity,
				config.orders.documentType,
				config.orders.typefacesField,
				range.start,
				range.end,
				config.orders.excludeFilter,
			)
			if (counts) bought = new Map(Object.entries(counts.byTypeface))
		} catch (e) {
			console.error('Visitor insights: per-typeface order count failed:', (e as Error).message)
		}
	}

	// Union of every family seen by any source, so a family that sold but was never viewed
	// (or vice versa) still appears rather than being silently dropped.
	const families = new Set<string>([
		...(viewed?.keys() ?? []),
		...(tested?.keys() ?? []),
		...(bought?.keys() ?? []),
	])

	const metric = (counts: Map<string, number> | null, family: string, missingReason: 'not_instrumented' | 'not_applicable'): MetricValue =>
		counts === null ? unavailable(missingReason) : ok(counts.get(family) ?? 0)

	const rows: TypefaceInterestRow[] = [...families].map((family) => {
		const viewedMetric = metric(viewed, family, 'not_instrumented')
		const testedMetric = metric(tested, family, 'not_instrumented')
		const boughtMetric = bought === null ? unavailable('not_applicable', 'Orders do not resolve to typefaces on this site') : ok(bought.get(family) ?? 0)

		const testRate =
			viewedMetric.status !== 'unavailable' &&
			testedMetric.status !== 'unavailable' &&
			viewedMetric.value > 0
				? testedMetric.value / viewedMetric.value
				: null

		return { typeface: family, viewed: viewedMetric, tested: testedMetric, bought: boughtMetric, testRate }
	})

	// Most-viewed first, with unavailable views sorting last rather than as zero.
	rows.sort((a, b) => {
		const av = a.viewed.status === 'unavailable' ? -1 : a.viewed.value
		const bv = b.viewed.status === 'unavailable' ? -1 : b.viewed.value
		return bv - av
	})

	return { rows, interpretationNote: INTERPRETATION_NOTE, rowsWithheld: false }
}

export type { TypefaceInterestData, TypefaceInterestRow } from '../../reportData'

/**
 * Event instrumentation cutovers.
 *
 * GA4 cannot backfill events: data from before an event was instrumented does not exist and never
 * will. A range spanning a cutover therefore mixes two measurement regimes, and a chart drawn
 * across it reads as a change in visitor behaviour when it is really a change in what was counted.
 *
 * This lives in the package rather than in each site repo so all three foundries share one model
 * and one set of semantics, and so the Studio panel and the server handler agree by construction.
 */

import type { DateRange, MetricValue } from '../types'
import { unavailable, partial } from '../types'

/** An event that predates this work — long-running, with no discontinuity to mark. */
export const PREEXISTING = 'preexisting' as const

/**
 * When an event began firing on a site.
 * `PREEXISTING` = live before this work began. `null` = planned, not yet deployed.
 * An ISO `YYYY-MM-DD` string = the deploy date, set in the commit that ships the event.
 */
export type EventCutover = typeof PREEXISTING | string | null

/** How completely an event covers a requested range. */
export type Coverage =
	| { status: 'full' }
	| { status: 'partial'; cutover: string }
	| { status: 'none'; reason: 'not_instrumented' | 'before_cutover' | 'unknown_event'; cutover?: string }

/**
 * Determine how well an event covers a date range.
 *
 * @param cutovers - the site's event cutover map
 * @param eventName - GA4 event name to look up
 * @param range - the requested range
 */
export function coverageForRange(
	cutovers: Readonly<Record<string, EventCutover>>,
	eventName: string,
	range: Pick<DateRange, 'start' | 'end'>,
): Coverage {
	if (!(eventName in cutovers)) return { status: 'none', reason: 'unknown_event' }

	const cutover = cutovers[eventName]
	// `in` proved the key exists, so undefined here means an explicitly undefined value.
	if (cutover === null || cutover === undefined) return { status: 'none', reason: 'not_instrumented' }
	if (cutover === PREEXISTING) return { status: 'full' }

	const cutoverTime = Date.parse(cutover)
	// An unparseable date is a config error; treat it as unknown rather than silently trusting it.
	if (Number.isNaN(cutoverTime)) return { status: 'none', reason: 'unknown_event' }

	if (Date.parse(range.end) < cutoverTime) return { status: 'none', reason: 'before_cutover', cutover }
	if (Date.parse(range.start) < cutoverTime) return { status: 'partial', cutover }

	return { status: 'full' }
}

/**
 * Wrap a raw count in a MetricValue that reflects the event's coverage of the range.
 *
 * Call this instead of returning a bare number, so a value that only covers part of the range
 * carries that fact with it all the way to the renderer.
 *
 * @param count - the number GA4 returned, or null if the query could not run
 * @param coverage - result of coverageForRange for the same event and range
 */
export function applyCoverage(count: number | null, coverage: Coverage): MetricValue {
	if (coverage.status === 'none') {
		return unavailable(
			coverage.reason === 'before_cutover' ? 'before_cutover' : 'not_instrumented',
			coverage.cutover ? `Instrumented from ${coverage.cutover}` : undefined,
		)
	}

	if (count === null) return unavailable('source_error')

	if (coverage.status === 'partial') {
		return partial(count, coverage.cutover, `Only counted from ${coverage.cutover}, when this event was added`)
	}

	return { status: 'ok', value: count }
}

/**
 * Human-readable notices for every event in a range that is not fully covered.
 * Surfaced in the report envelope so the panel can show caveats without recomputing them.
 */
export function coverageNotices(
	cutovers: Readonly<Record<string, EventCutover>>,
	eventNames: readonly string[],
	range: Pick<DateRange, 'start' | 'end'>,
): string[] {
	const notices: string[] = []

	for (const name of eventNames) {
		const coverage = coverageForRange(cutovers, name, range)
		if (coverage.status === 'partial') {
			notices.push(`${name} was instrumented on ${coverage.cutover}; figures before that date are missing, not zero.`)
		} else if (coverage.status === 'none' && coverage.reason === 'not_instrumented') {
			notices.push(`${name} is not instrumented on this site, so it cannot be reported for any range.`)
		} else if (coverage.status === 'none' && coverage.reason === 'before_cutover') {
			notices.push(`${name} did not exist during this range; it was instrumented on ${coverage.cutover}.`)
		}
	}

	return notices
}

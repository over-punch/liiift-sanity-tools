/**
 * Date-range resolution.
 *
 * Every range is resolved against one declared timezone — the GA4 property's — because the three
 * sources bucket time differently: GA4 by the property timezone, Vercel by UTC, Sanity `_createdAt`
 * by UTC. Without a single anchor, an order placed near midnight lands in different weeks depending
 * on which source you ask, which corrupts exactly the cross-source comparison this tool exists for.
 */

import type { DateRange, RangeKey } from '../types'

/** GA4 does not finalise the most recent days. Figures inside this window may still rise. */
export const GA4_PROCESSING_LAG_DAYS = 2

/** Format a Date as `YYYY-MM-DD` in the given IANA timezone. */
export function formatInTimeZone(date: Date, timeZone: string): string {
	// en-CA gives ISO-ordered parts, which is what we want to reassemble.
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(date)

	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
	return `${get('year')}-${get('month')}-${get('day')}`
}

/** Shift an ISO `YYYY-MM-DD` date by a whole number of days. */
export function shiftDays(isoDate: string, days: number): string {
	const time = Date.parse(`${isoDate}T00:00:00Z`)
	if (Number.isNaN(time)) throw new Error(`Invalid ISO date: ${isoDate}`)
	return new Date(time + days * 86_400_000).toISOString().slice(0, 10)
}

/** Inclusive whole days between two ISO dates. */
export function daysBetween(start: string, end: string): number {
	return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1
}

/** How many days each range key spans. */
const RANGE_DAYS: Record<RangeKey, number> = {
	week: 7,
	quarter: 91,
	year: 365,
}

/**
 * Resolve a range key into concrete dates, anchored to `timezone` and ending today.
 *
 * @param key - week, quarter or year
 * @param timezone - IANA timezone of the GA4 property this range will be queried against
 * @param now - injectable clock, so tests are deterministic
 */
export function resolveRange(key: RangeKey, timezone: string, now: Date = new Date()): DateRange {
	const end = formatInTimeZone(now, timezone)
	const start = shiftDays(end, -(RANGE_DAYS[key] - 1))
	return { key, start, end, timezone }
}

/**
 * The equivalent range immediately before `range`, for period-over-period comparison.
 *
 * A bare count answers "how many", which on its own is not actionable; the comparison is what
 * tells someone whether to do anything.
 */
export function previousRange(range: DateRange): DateRange {
	const span = daysBetween(range.start, range.end)
	return {
		key: range.key,
		start: shiftDays(range.start, -span),
		end: shiftDays(range.end, -span),
		timezone: range.timezone,
	}
}

/**
 * The trailing dates within a range whose GA4 figures are not yet settled.
 * Returns an empty array when the range ends before the lag window.
 */
export function provisionalDates(range: DateRange, now: Date = new Date()): string[] {
	const today = formatInTimeZone(now, range.timezone)
	const dates: string[] = []

	for (let i = 0; i < GA4_PROCESSING_LAG_DAYS; i += 1) {
		const date = shiftDays(today, -i)
		if (date >= range.start && date <= range.end) dates.push(date)
	}

	return dates.sort()
}

/**
 * Notice text when a range includes days GA4 has not finished processing, or `null` when it does not.
 * Without this a Monday-morning glance at "this week" reads the trailing dip as a real drop.
 */
export function provisionalNotice(range: DateRange, now: Date = new Date()): string | null {
	const dates = provisionalDates(range, now)
	if (dates.length === 0) return null

	const from = dates[0]
	return `GA4 has not finished processing ${from} onwards; those figures are provisional and will rise.`
}

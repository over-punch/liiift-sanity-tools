/**
 * Acquisition — where visitors come from.
 *
 * Design-industry referrers are pulled out as a named segment rather than left in a generic
 * referrer table. A visit from Fonts In Use or Typewolf is a pre-qualified, industry-literate
 * visitor and behaves nothing like average organic traffic; burying those rows among search and
 * social discards the distinction a foundry actually acts on.
 *
 * `(not set)` rows are surfaced rather than swept into "other". On a type-foundry site they can be
 * a large share — bookmarked visits, stripped referrers, AI crawlers — and hiding them makes the
 * table look more complete than it is.
 */

import type { AcquisitionData, SourceRow } from '../../reportData'
import type { DateRange } from '../../types'
import { sumFirstMetric, type Ga4Client } from '../ga4'

/** Referrer hosts that identify a design-industry source worth tracking separately. */
export const DESIGN_INDUSTRY_SOURCES = [
	'fontsinuse.com',
	'typewolf.com',
	'typographica.org',
	'fonts.google.com',
	'behance.net',
	'dribbble.com',
	'itsnicethat.com',
] as const



/** Whether a GA4 source value is one of the unattributed buckets rather than a real referrer. */
function isUnattributed(source: string): boolean {
	const normalised = source.toLowerCase()
	return normalised === '(not set)' || normalised === '(direct)' || normalised === '(none)' || normalised === ''
}

/** Whether a GA4 source value matches a design-industry referrer. */
function isDesignIndustry(source: string): boolean {
	const normalised = source.toLowerCase()
	return DESIGN_INDUSTRY_SOURCES.some((known) => normalised === known || normalised.endsWith(`.${known}`))
}

/**
 * Run the acquisition report.
 *
 * @param ga4 - client for the site's property
 * @param range - the requested range
 * @param limit - maximum source rows to return
 */
export async function acquisition(ga4: Ga4Client, range: DateRange, limit = 25): Promise<AcquisitionData> {
	const report = await ga4.runReport({
		dimensions: [{ name: 'sessionSource' }, { name: 'sessionDefaultChannelGroup' }],
		metrics: [{ name: 'sessions' }],
		dateRanges: [{ startDate: range.start, endDate: range.end }],
		orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
		limit,
	})

	const rows: SourceRow[] = report.rows.map((row) => {
		const source = row.dimensions[0] ?? '(not set)'
		const sessions = row.metrics[0]

		return {
			source,
			channel: row.dimensions[1] ?? 'Unassigned',
			sessions: Number.isFinite(sessions) ? (sessions as number) : 0,
			designIndustry: isDesignIndustry(source),
			unattributed: isUnattributed(source),
		}
	})

	const totalSessions = sumFirstMetric(report)
	const sumWhere = (predicate: (row: SourceRow) => boolean) =>
		rows.filter(predicate).reduce((total, row) => total + row.sessions, 0)

	return {
		rows,
		totalSessions,
		designIndustryShare: totalSessions > 0 ? sumWhere((r) => r.designIndustry) / totalSessions : null,
		unattributedShare: totalSessions > 0 ? sumWhere((r) => r.unattributed) / totalSessions : null,
		rowsWithheld: report.thresholded,
	}
}

export type { AcquisitionData, SourceRow } from '../../reportData'

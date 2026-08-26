/**
 * GA4 Data API client.
 *
 * Only `runReport` and `batchRunReports` are used. `runFunnelReport` is deliberately not called:
 * it is an alpha surface with its own stricter quota, and it returns step-conversion marginals
 * rather than observed paths — drawing a flow diagram from it would imply co-occurrence that was
 * never measured. The journey report approximates instead, and says so.
 */

import { getAccessToken, type ServiceAccountKey } from './googleAuth'

const DATA_API_BASE = 'https://analyticsdata.googleapis.com/v1beta'

/** A GA4 report request, narrowed to the fields this package sets. */
export interface Ga4ReportRequest {
	dimensions?: Array<{ name: string }>
	metrics?: Array<{ name: string }>
	dateRanges: Array<{ startDate: string; endDate: string }>
	dimensionFilter?: unknown
	orderBys?: unknown
	limit?: number
	keepEmptyRows?: boolean
}

/** A parsed report row: dimension values and metric values, positionally aligned to the request. */
export interface Ga4Row {
	dimensions: string[]
	metrics: number[]
}

/** A parsed GA4 report. */
export interface Ga4Report {
	rows: Ga4Row[]
	/** True when GA4 withheld rows for privacy thresholding — totals are then incomplete. */
	thresholded: boolean
	/** True when GA4 answered from a sample rather than the full data set. */
	sampled: boolean
	/** Total row count GA4 reports, which may exceed rows returned when a limit applied. */
	rowCount: number
}

/** Raw Data API response shape, narrowed to what is read here. */
interface RawReport {
	rows?: Array<{
		dimensionValues?: Array<{ value?: string }>
		metricValues?: Array<{ value?: string }>
	}>
	rowCount?: number
	metadata?: { subjectToThresholding?: boolean; samplingMetadatas?: unknown[] }
	propertyQuota?: unknown
}

/**
 * Coerce a GA4 metric cell to a number.
 *
 * The Data API returns every value as a string, and returns an empty string for suppressed cells.
 * `Number('')` is 0, which would turn a withheld row into a real-looking zero — so empty is
 * treated as NaN and filtered by the caller rather than silently becoming a data point.
 */
function toMetricNumber(raw: string | undefined): number {
	if (raw === undefined || raw === '') return Number.NaN
	const parsed = Number(raw)
	return Number.isFinite(parsed) ? parsed : Number.NaN
}

/** Parse a raw Data API report into the shape the reports consume. */
function parseReport(raw: RawReport): Ga4Report {
	const rows: Ga4Row[] = (raw.rows ?? []).map((row) => ({
		dimensions: (row.dimensionValues ?? []).map((d) => d.value ?? ''),
		metrics: (row.metricValues ?? []).map((m) => toMetricNumber(m.value)),
	}))

	return {
		rows,
		thresholded: raw.metadata?.subjectToThresholding === true,
		sampled: Array.isArray(raw.metadata?.samplingMetadatas) && raw.metadata.samplingMetadatas.length > 0,
		rowCount: raw.rowCount ?? rows.length,
	}
}

/** A GA4 client bound to one property. */
export interface Ga4Client {
	runReport(request: Ga4ReportRequest): Promise<Ga4Report>
	batchRunReports(requests: Ga4ReportRequest[]): Promise<Ga4Report[]>
}

/**
 * Build a GA4 client for one property.
 *
 * @param propertyId - numeric GA4 property id
 * @param key - service-account key with Viewer on that property
 */
export function createGa4Client(propertyId: string, key: ServiceAccountKey): Ga4Client {
	async function post<T>(path: string, body: unknown): Promise<T> {
		const token = await getAccessToken(key)

		const response = await fetch(`${DATA_API_BASE}/properties/${propertyId}:${path}`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		})

		if (!response.ok) {
			// GA4 error bodies can echo the request; keep only the status for the caller's log.
			throw new Error(`GA4 ${path} failed with ${response.status}`)
		}

		return (await response.json()) as T
	}

	return {
		async runReport(request) {
			const raw = await post<RawReport>('runReport', request)
			return parseReport(raw)
		},

		/**
		 * Run several reports in one call. Preferred over parallel runReport calls: it is one
		 * quota-charged request and one round trip rather than N of each.
		 */
		async batchRunReports(requests) {
			if (requests.length === 0) return []

			const raw = await post<{ reports?: RawReport[] }>('batchRunReports', { requests })
			return (raw.reports ?? []).map(parseReport)
		},
	}
}

/** Build a dimension filter matching a single event name. */
export function eventNameFilter(eventName: string): unknown {
	return {
		filter: {
			fieldName: 'eventName',
			stringFilter: { matchType: 'EXACT', value: eventName },
		},
	}
}

/** Sum a report's first metric across all rows, ignoring suppressed cells. */
export function sumFirstMetric(report: Ga4Report): number {
	return report.rows.reduce((total, row) => {
		const value = row.metrics[0]
		return value !== undefined && Number.isFinite(value) ? total + value : total
	}, 0)
}

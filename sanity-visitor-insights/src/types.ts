/** Shared contract types for the Studio plugin and the API-route handler it calls. */

// ---------------------------------------------------------------------------
// Metric values
// ---------------------------------------------------------------------------

/**
 * Why a metric has no usable number. Kept distinct rather than collapsed into one flag, because
 * the UI must say different things: "this site never tracked it" is permanent, "not yet at this
 * date" resolves as time passes, and "GA4 withheld it" means the number exists but is hidden.
 */
export type UnavailableReason =
	/** The event has never been instrumented on this site. Permanent for historical ranges. */
	| 'not_instrumented'
	/** Instrumented, but the requested range predates the cutover date. */
	| 'before_cutover'
	/** GA4 suppressed the row for privacy thresholding. A real number exists; we may not see it. */
	| 'suppressed'
	/** The upstream source errored or timed out. Retryable, unlike the others. */
	| 'source_error'
	/** The metric is not defined for this site at all (e.g. a flow that does not exist there). */
	| 'not_applicable'

/**
 * A metric that may legitimately have no value.
 *
 * The whole point of this union is that there is no way to read a number without first handling
 * the absent case — a missing metric can never silently coerce to 0 and be charted as a real
 * trough. `partial` carries a number that is only valid for part of the requested range.
 */
export type MetricValue =
	| { status: 'ok'; value: number }
	| { status: 'partial'; value: number; coveredFrom: string; note: string }
	| { status: 'unavailable'; reason: UnavailableReason; detail?: string }

/** Construct an available metric. */
export function ok(value: number): MetricValue {
	return { status: 'ok', value }
}

/** Construct an unavailable metric. */
export function unavailable(reason: UnavailableReason, detail?: string): MetricValue {
	return { status: 'unavailable', reason, detail }
}

/**
 * Construct a metric covering only part of the requested range.
 *
 * @param value - the number for the covered portion
 * @param coveredFrom - ISO date from which the number is valid
 * @param note - short human-readable reason, shown next to the figure
 */
export function partial(value: number, coveredFrom: string, note: string): MetricValue {
	return { status: 'partial', value, coveredFrom, note }
}

/**
 * Read a metric's number, or `null` when there isn't a usable one.
 * Use at render time so the absent case has to be handled explicitly.
 */
export function valueOrNull(metric: MetricValue): number | null {
	return metric.status === 'unavailable' ? null : metric.value
}

// ---------------------------------------------------------------------------
// Date ranges
// ---------------------------------------------------------------------------

/** The range granularities offered in the UI. */
export type RangeKey = 'week' | 'quarter' | 'year'

/**
 * A resolved date range. Both bounds are inclusive ISO `YYYY-MM-DD` dates in `timezone`.
 *
 * `timezone` is carried explicitly because GA4 buckets by the property's configured timezone,
 * Vercel reports in UTC, and Sanity `_createdAt` is UTC — comparing them without a single declared
 * anchor silently shifts events across day and week boundaries.
 */
export interface DateRange {
	key: RangeKey
	start: string
	end: string
	timezone: string
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/** The report names this package serves. Used as a strict allow-list, never as dynamic dispatch. */
export const REPORT_NAMES = [
	'measurement-health',
	'acquisition',
	'journey',
	'typeface-interest',
] as const

export type ReportName = (typeof REPORT_NAMES)[number]

/** Narrow an untrusted string to a known report name. */
export function isReportName(value: unknown): value is ReportName {
	return typeof value === 'string' && (REPORT_NAMES as readonly string[]).includes(value)
}

/** Which upstreams a report consulted, and how each fared. */
export type SourceStatus =
	| { status: 'ok' }
	| { status: 'unconfigured' }
	| { status: 'error'; message: string }

/** Upstream data sources this package can read. */
export type SourceName = 'ga4' | 'vercel' | 'sanity'

/**
 * Envelope around every report response.
 *
 * `sources` is mandatory rather than optional because partial failure is the normal case here,
 * not the exception: a panel comparing three sources must be able to distinguish "this source
 * reported zero" from "this source never answered", which a bare payload cannot express.
 */
export interface ReportEnvelope<T> {
	report: ReportName
	range: DateRange
	/** Per-source outcome. A report may succeed overall while one source is unconfigured. */
	sources: Partial<Record<SourceName, SourceStatus>>
	/** Caveats to surface in the UI, e.g. GA4 sampling or an instrumentation cutover in range. */
	notices: string[]
	data: T
}

/** Error shape returned by the handler. Never leaks upstream error text to the browser. */
export interface ReportError {
	error: string
	report?: string
}

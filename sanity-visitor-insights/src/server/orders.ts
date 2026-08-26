/**
 * Order counts from Sanity, used only as a conversion anchor.
 *
 * Orders on these sites carry customer names, emails and postal addresses. Joining that to
 * behavioural analytics would turn aggregate statistics into personal-data processing and put the
 * GA4 property at risk under Google's terms, so no query in this file may project a PII field.
 * The projections below are allow-lists, not conveniences: every GROQ query here names the exact
 * fields it returns, and none of them is a customer identifier.
 *
 * Revenue is likewise absent. This package reports behaviour; the sales portal reports sales.
 */

/** Fields safe to read from an order. Nothing here identifies a person. */
const SAFE_ORDER_PROJECTION = '{ _createdAt, orderStatus }'

/** A daily count of orders. */
export interface OrderCounts {
	byDate: Record<string, number>
	total: number
}

/** Orders attributable to a typeface, for the interest report. */
export interface TypefaceOrderCounts {
	/** Typeface title to order count. */
	byTypeface: Record<string, number>
	total: number
}

/** What this module needs from a Sanity client — kept minimal so it is trivial to stub in tests. */
export interface SanityQueryClient {
	fetch<T>(query: string, params?: Record<string, unknown>): Promise<T>
}

/**
 * Build a GROQ filter for orders in a date range.
 * `excludeFilter` lets a site drop non-typeface orders, e.g. merch-only orders on Darden, which
 * would otherwise inflate a family's apparent purchase count.
 */
function orderFilter(documentType: string, excludeFilter?: string): string {
	const clauses = [
		`_type == $documentType`,
		`_createdAt >= $start`,
		`_createdAt <= $end`,
	]
	if (excludeFilter) clauses.push(`(${excludeFilter})`)
	return clauses.join(' && ')
}

/**
 * Count orders per day across a range.
 *
 * Bounds are passed as full timestamps because `_createdAt` is a UTC datetime; comparing it to a
 * bare date would silently drop the last day's orders.
 *
 * @param client - a Sanity client
 * @param documentType - the site's order document type
 * @param start - inclusive ISO date
 * @param end - inclusive ISO date
 * @param excludeFilter - optional GROQ clause excluding non-typeface orders
 */
export async function countOrders(
	client: SanityQueryClient,
	documentType: string,
	start: string,
	end: string,
	excludeFilter?: string,
): Promise<OrderCounts> {
	const query = `*[${orderFilter(documentType, excludeFilter)}]${SAFE_ORDER_PROJECTION}`

	const orders = await client.fetch<Array<{ _createdAt: string }>>(query, {
		documentType,
		start: `${start}T00:00:00Z`,
		end: `${end}T23:59:59Z`,
	})

	const byDate: Record<string, number> = {}
	for (const order of orders) {
		const date = order._createdAt.slice(0, 10)
		byDate[date] = (byDate[date] ?? 0) + 1
	}

	return { byDate, total: orders.length }
}

/**
 * Count orders per typeface across a range.
 *
 * Returns an empty result when the site has no usable typeface field on orders, rather than
 * guessing — an absent join is reported as unavailable upstream, not as zero purchases.
 *
 * @param typefacesField - the order field holding typeface references, or null when absent
 */
export async function countOrdersByTypeface(
	client: SanityQueryClient,
	documentType: string,
	typefacesField: string | null,
	start: string,
	end: string,
	excludeFilter?: string,
): Promise<TypefaceOrderCounts | null> {
	if (!typefacesField) return null

	// Dereferences only the typeface title — never the order's customer fields.
	const query = `*[${orderFilter(documentType, excludeFilter)}]{
		"typefaces": ${typefacesField}[]->{ title }
	}`

	const orders = await client.fetch<Array<{ typefaces?: Array<{ title?: string } | null> | null }>>(query, {
		documentType,
		start: `${start}T00:00:00Z`,
		end: `${end}T23:59:59Z`,
	})

	const byTypeface: Record<string, number> = {}
	let total = 0

	for (const order of orders) {
		for (const typeface of order.typefaces ?? []) {
			const title = typeface?.title
			if (!title) continue
			byTypeface[title] = (byTypeface[title] ?? 0) + 1
			total += 1
		}
	}

	return { byTypeface, total }
}

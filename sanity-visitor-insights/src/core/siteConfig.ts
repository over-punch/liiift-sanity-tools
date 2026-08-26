/**
 * Per-site adapter configuration.
 *
 * The three foundries differ in ways that cannot be abstracted away: different GA4 event coverage,
 * different order schemas, different flows that exist on one site and not another. Rather than
 * branching on a site id inside the reports — which would mean editing this package to onboard a
 * fourth foundry — each site describes itself through this config and the reports stay generic.
 */

import type { EventCutover } from './cutover'

/** GA4 connection for one site. */
export interface Ga4Config {
	/** Numeric GA4 property id. NOT the `G-XXXXXXX` measurement id, which is the client-side one. */
	propertyId: string
	/** IANA timezone the property is configured with. Every range is anchored to this. */
	timezone: string
}

/** Vercel Web Analytics connection for one site. */
export interface VercelConfig {
	projectId: string
	teamId?: string
}

/** Where to count orders, and what they are called on this site. */
export interface OrdersConfig {
	/** Document type holding orders. */
	documentType: string
	/**
	 * Field holding the typeface references on an order, if the site has one.
	 * Null where orders do not resolve to typefaces in a usable way.
	 */
	typefacesField: string | null
	/**
	 * GROQ filter appended to exclude non-typeface orders, e.g. merch-only orders on Darden.
	 * Merch inflates a family's apparent purchase count if not excluded.
	 */
	excludeFilter?: string
}

/** One site's complete description of itself. */
export interface SiteAnalyticsConfig {
	/** Stable machine id, e.g. `darden`. */
	siteId: string
	/** Human label shown in the Studio UI. */
	label: string
	/** Null when GA4 is not wired up for this site — reports degrade rather than fail. */
	ga4: Ga4Config | null
	/** Null when Vercel Web Analytics is unavailable, e.g. on a plan tier without API access. */
	vercel: VercelConfig | null
	orders: OrdersConfig
	/**
	 * When each GA4 event began firing here. Events absent from this map report as `unknown_event`,
	 * which is the honest answer for a flow the site does not have — distinct from `not_instrumented`,
	 * which implies it is merely pending.
	 */
	eventCutovers: Record<string, EventCutover>
	/** Origins allowed to call this site's handler cross-origin, e.g. a separately deployed Studio. */
	allowedStudioOrigins?: string[]
}

/** A problem found while validating a site config. */
export interface ConfigProblem {
	field: string
	message: string
}

/**
 * Validate a site config at runtime.
 *
 * Compile-time types do not survive into a consuming site's `sanity.config.js`, which is plain
 * JavaScript — so a typo'd property id or a measurement id pasted where a numeric property id
 * belongs would otherwise surface as an empty chart rather than an error.
 *
 * @param config - the candidate config
 * @returns the problems found; an empty array means the config is usable
 */
export function validateSiteConfig(config: Partial<SiteAnalyticsConfig> | undefined): ConfigProblem[] {
	const problems: ConfigProblem[] = []

	if (!config) {
		return [{ field: 'config', message: 'No site config supplied' }]
	}

	if (!config.siteId) problems.push({ field: 'siteId', message: 'Required' })
	if (!config.label) problems.push({ field: 'label', message: 'Required' })

	if (config.ga4) {
		const { propertyId, timezone } = config.ga4
		if (!propertyId) {
			problems.push({ field: 'ga4.propertyId', message: 'Required when ga4 is configured' })
		} else if (propertyId.startsWith('G-')) {
			problems.push({
				field: 'ga4.propertyId',
				message: `Looks like a measurement id ("${propertyId}"). The Data API needs the numeric property id from GA4 Admin instead.`,
			})
		} else if (!/^\d+$/.test(propertyId)) {
			problems.push({ field: 'ga4.propertyId', message: 'Must be the numeric GA4 property id' })
		}

		if (!timezone) {
			problems.push({ field: 'ga4.timezone', message: 'Required — ranges are anchored to it' })
		} else if (!isValidTimeZone(timezone)) {
			problems.push({ field: 'ga4.timezone', message: `Not a recognised IANA timezone: ${timezone}` })
		}
	}

	if (config.vercel && !config.vercel.projectId) {
		problems.push({ field: 'vercel.projectId', message: 'Required when vercel is configured' })
	}

	if (!config.orders?.documentType) {
		problems.push({ field: 'orders.documentType', message: 'Required' })
	}

	if (!config.eventCutovers) {
		problems.push({ field: 'eventCutovers', message: 'Required — omit events the site does not have' })
	}

	for (const origin of config.allowedStudioOrigins ?? []) {
		if (!/^https?:\/\//.test(origin)) {
			problems.push({ field: 'allowedStudioOrigins', message: `Must be a full origin including scheme: ${origin}` })
		}
		if (origin.endsWith('/')) {
			problems.push({ field: 'allowedStudioOrigins', message: `Must not have a trailing slash: ${origin}` })
		}
	}

	return problems
}

/** Whether a string is an IANA timezone this runtime recognises. */
export function isValidTimeZone(timeZone: string): boolean {
	try {
		new Intl.DateTimeFormat('en-CA', { timeZone })
		return true
	} catch {
		return false
	}
}

/** Throw if a config is unusable, naming every problem at once rather than one per run. */
export function assertValidSiteConfig(config: Partial<SiteAnalyticsConfig> | undefined): asserts config is SiteAnalyticsConfig {
	const problems = validateSiteConfig(config)
	if (problems.length > 0) {
		const detail = problems.map((p) => `  ${p.field}: ${p.message}`).join('\n')
		throw new Error(`Invalid visitor-insights site config:\n${detail}`)
	}
}

/**
 * Studio entry point — browser only.
 *
 * Must never import from `./server` or anything under `src/server/`, which reads credentials and
 * uses node:crypto. The split export subpaths are what keep that guarantee enforceable.
 */

import { definePlugin } from 'sanity'
import { resolveIcon } from '@liiift-studio/sanity-ui-compat/icons'
import { VisitorInsightsTool, type VisitorInsightsToolProps } from './studio/VisitorInsightsTool'

/** Chart glyph, resolved against whichever @sanity/icons major the Studio has installed. */
const ChartIcon = resolveIcon('ChartUpwardIcon', 'chart-upward')

/** Options for the Studio plugin. */
export interface VisitorInsightsPluginOptions {
	/**
	 * Base URL of the site serving the reports, e.g. `https://dardenstudio.com`.
	 * Same-origin studios can pass an empty string.
	 */
	apiBaseUrl: string
	/** Label shown in the tool header. */
	siteLabel: string
	/** Tool name in the Studio URL. Defaults to `visitor-insights`. */
	name?: string
	/** Title in the Studio nav. Defaults to `Insights`. */
	title?: string
	/**
	 * Restrict the tool to these Sanity roles. Omit to show it to every Studio user.
	 * These panels read order-derived conversion figures, so gating to administrators is
	 * usually right — matching how the deploy and utilities tools are already gated.
	 */
	roles?: string[]
}

/**
 * Visitor Insights — visitor-behaviour analytics inside the Studio.
 *
 * @example
 * ```ts
 * plugins: [
 *   visitorInsights({
 *     apiBaseUrl: 'https://dardenstudio.com',
 *     siteLabel: 'Darden Studio',
 *     roles: ['administrator'],
 *   }),
 * ]
 * ```
 */
export const visitorInsights = definePlugin<VisitorInsightsPluginOptions>((options) => {
	const { apiBaseUrl, siteLabel, name = 'visitor-insights', title = 'Insights', roles } = options

	return {
		name: '@liiift-studio/sanity-visitor-insights',
		tools: (prev, { currentUser }) => {
			if (roles && roles.length > 0) {
				const userRoles = currentUser?.roles?.map((role) => role.name) ?? []
				const permitted = userRoles.some((role) => roles.includes(role))
				if (!permitted) return prev
			}

			return [
				...prev,
				{
					name,
					title,
					icon: ChartIcon,
					component: VisitorInsightsTool,
					options: { apiBaseUrl, siteLabel } satisfies VisitorInsightsToolProps,
				},
			]
		},
	}
})

export default visitorInsights

export { VisitorInsightsTool, type VisitorInsightsToolProps } from './studio/VisitorInsightsTool'
export { useReport, type ReportState, type UseReportOptions } from './studio/useReport'
export { MetricFigure, ComparisonBar, NoticeList, formatCount, formatPercent } from './studio/Figure'

// Shared contract types, safe in the browser — no server code reachable from here.
export * from './types'
export { PREEXISTING, coverageForRange, type EventCutover, type Coverage } from './core/cutover'
export { validateSiteConfig, type SiteAnalyticsConfig } from './core/siteConfig'
export { resolveRange, previousRange } from './core/ranges'

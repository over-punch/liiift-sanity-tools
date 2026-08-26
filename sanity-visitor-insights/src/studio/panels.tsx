/**
 * The four report panels.
 *
 * Every panel renders a table or labelled bars rather than a chart, and every one surfaces its own
 * caveats inline. Tables are the accessible representation as well as the visual one, so there is
 * no separate "view as data" toggle that could drift out of sync with what is displayed.
 */

import React from 'react'
import { Box, Card, Flex, Heading, Stack, Text } from '@liiift-studio/sanity-ui-compat'
import { ComparisonBar, MetricFigure, NoticeList, formatCount, formatPercent } from './Figure'
import type {
	AcquisitionData,
	JourneyData,
	MeasurementHealthData,
	TypefaceInterestData,
} from '../reportData'
import type { MetricValue } from '../types'

/** Largest available value across metrics, for scaling bars. */
function maxOf(metrics: MetricValue[]): number {
	return metrics.reduce((max, metric) => (metric.status === 'unavailable' ? max : Math.max(max, metric.value)), 0)
}

/** Shared table styling — scrolls inside its own container so the panel never scrolls sideways. */
const tableWrap: React.CSSProperties = { overflowX: 'auto', width: '100%' }
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', minWidth: 420 }
const cell: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--card-border-color)' }
const numericCell: React.CSSProperties = { ...cell, textAlign: 'right' }

/**
 * Measurement Health — how much of reality each source sees.
 * Compares pageviews to pageviews. Sessions and orders sit alongside as context and are never
 * subtracted from a pageview count.
 */
export function MeasurementHealthPanel({ data }: { data: MeasurementHealthData }): React.ReactElement {
	const pageviewMax = maxOf([data.ga4Pageviews, data.vercelPageviews])

	return (
		<Stack space={4}>
			<Stack space={3}>
				<Heading size={1}>Pageviews, source against source</Heading>
				<Text size={1} muted>
					The same unit on both sides. Vercel is cookieless and ungated; GA4 is consent-gated and
					blockable, so GA4 seeing fewer is expected.
				</Text>
				<ComparisonBar label="Vercel pageviews" metric={data.vercelPageviews} max={pageviewMax} tone="primary" />
				<ComparisonBar label="GA4 pageviews" metric={data.ga4Pageviews} max={pageviewMax} tone="default" />
			</Stack>

			{data.shortfallRatio !== null && (
				<Card padding={3} radius={2} tone="transparent" border>
					<Stack space={2}>
						<Text size={1} weight="semibold">
							GA4 shortfall: {formatPercent(Math.abs(data.shortfallRatio), 1)}
						</Text>
						<Text size={1} muted>{data.interpretation}</Text>
					</Stack>
				</Card>
			)}

			<Stack space={3}>
				<Heading size={1}>Context</Heading>
				<Text size={1} muted>
					Different units to the figures above, and to each other. Shown for scale, never differenced.
				</Text>
				<Flex gap={4} wrap="wrap">
					<Stack space={2}>
						<Text size={1} muted>GA4 sessions</Text>
						<MetricFigure metric={data.ga4Sessions} label="GA4 sessions" />
					</Stack>
					<Stack space={2}>
						<Text size={1} muted>Orders</Text>
						<MetricFigure metric={data.orders} label="Orders" />
					</Stack>
					<Stack space={2}>
						<Text size={1} muted>Consent granted</Text>
						<MetricFigure metric={data.consentRate} label="Consent granted, percent of sessions" />
					</Stack>
				</Flex>
			</Stack>
		</Stack>
	)
}

/** Acquisition — where visitors came from, with design-industry referrers called out. */
export function AcquisitionPanel({ data }: { data: AcquisitionData }): React.ReactElement {
	return (
		<Stack space={4}>
			<Flex gap={4} wrap="wrap">
				<Stack space={2}>
					<Text size={1} muted>Sessions</Text>
					<Text size={4}>{formatCount(data.totalSessions)}</Text>
				</Stack>
				{data.designIndustryShare !== null && (
					<Stack space={2}>
						<Text size={1} muted>From design-industry referrers</Text>
						<Text size={4}>{formatPercent(data.designIndustryShare, 1)}</Text>
					</Stack>
				)}
				{data.unattributedShare !== null && (
					<Stack space={2}>
						<Text size={1} muted>Unattributed</Text>
						<Text size={4}>{formatPercent(data.unattributedShare, 1)}</Text>
					</Stack>
				)}
			</Flex>

			<Box style={tableWrap}>
				<table style={table}>
					<caption style={{ textAlign: 'left', paddingBottom: 8 }}>
						<Text size={1} muted>Traffic sources by sessions</Text>
					</caption>
					<thead>
						<tr>
							<th scope="col" style={cell}><Text size={1} weight="semibold">Source</Text></th>
							<th scope="col" style={cell}><Text size={1} weight="semibold">Channel</Text></th>
							<th scope="col" style={numericCell}><Text size={1} weight="semibold">Sessions</Text></th>
						</tr>
					</thead>
					<tbody>
						{data.rows.map((row) => (
							<tr key={`${row.source}-${row.channel}`}>
								<th scope="row" style={cell}>
									<Flex gap={2} align="center">
										<Text size={1}>{row.source}</Text>
										{row.designIndustry && <Text size={0} muted>· design industry</Text>}
										{row.unattributed && <Text size={0} muted>· unattributed</Text>}
									</Flex>
								</th>
								<td style={cell}><Text size={1} muted>{row.channel}</Text></td>
								<td style={numericCell}><Text size={1}>{formatCount(row.sessions)}</Text></td>
							</tr>
						))}
					</tbody>
				</table>
			</Box>

			{data.rowsWithheld && (
				<NoticeList notices={['GA4 withheld some low-traffic rows for privacy, so this list is shorter than reality.']} />
			)}
		</Stack>
	)
}

/** Journey — per-step totals with adjacent drop-off, explicitly not a tracked path. */
export function JourneyPanel({ data }: { data: JourneyData }): React.ReactElement {
	const max = maxOf(data.steps.map((step) => step.count))

	return (
		<Stack space={4}>
			<Card padding={3} radius={2} tone="caution" border>
				<Text size={1}>{data.approximationNote}</Text>
			</Card>

			<Stack space={3}>
				{data.steps.map((step) => (
					<Stack space={2} key={step.key}>
						<ComparisonBar label={step.label} metric={step.count} max={max} tone="primary" />
						{step.conversionFromPrevious !== null && (
							<Text size={0} muted>{formatPercent(step.conversionFromPrevious, 1)} of the previous measurable step</Text>
						)}
					</Stack>
				))}
			</Stack>

			{data.topExitPages.length > 0 && (
				<Stack space={3}>
					<Heading size={1}>Where sessions ended</Heading>
					<Box style={tableWrap}>
						<table style={table}>
							<thead>
								<tr>
									<th scope="col" style={cell}><Text size={1} weight="semibold">Page</Text></th>
									<th scope="col" style={numericCell}><Text size={1} weight="semibold">Exits</Text></th>
								</tr>
							</thead>
							<tbody>
								{data.topExitPages.map((page) => (
									<tr key={page.path}>
										<th scope="row" style={cell}><Text size={1}>{page.path}</Text></th>
										<td style={numericCell}><Text size={1}>{formatCount(page.exits)}</Text></td>
									</tr>
								))}
							</tbody>
						</table>
					</Box>
				</Stack>
			)}
		</Stack>
	)
}

/** Typeface interest — viewed, tested and bought per family. */
export function TypefaceInterestPanel({ data }: { data: TypefaceInterestData }): React.ReactElement {
	return (
		<Stack space={4}>
			<Card padding={3} radius={2} tone="transparent" border>
				<Text size={1} muted>{data.interpretationNote}</Text>
			</Card>

			<Box style={tableWrap}>
				<table style={table}>
					<caption style={{ textAlign: 'left', paddingBottom: 8 }}>
						<Text size={1} muted>Engagement by typeface</Text>
					</caption>
					<thead>
						<tr>
							<th scope="col" style={cell}><Text size={1} weight="semibold">Typeface</Text></th>
							<th scope="col" style={numericCell}><Text size={1} weight="semibold">Viewed</Text></th>
							<th scope="col" style={numericCell}><Text size={1} weight="semibold">Tested</Text></th>
							<th scope="col" style={numericCell}><Text size={1} weight="semibold">Bought</Text></th>
							<th scope="col" style={numericCell}><Text size={1} weight="semibold">Test rate</Text></th>
						</tr>
					</thead>
					<tbody>
						{data.rows.map((row) => (
							<tr key={row.typeface}>
								<th scope="row" style={cell}><Text size={1}>{row.typeface}</Text></th>
								<td style={numericCell}><MetricFigure metric={row.viewed} label={`${row.typeface} viewed`} size={1} /></td>
								<td style={numericCell}><MetricFigure metric={row.tested} label={`${row.typeface} tested`} size={1} /></td>
								<td style={numericCell}><MetricFigure metric={row.bought} label={`${row.typeface} bought`} size={1} /></td>
								<td style={numericCell}>
									<Text size={1} muted>{row.testRate === null ? '—' : formatPercent(row.testRate, 1)}</Text>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</Box>
		</Stack>
	)
}

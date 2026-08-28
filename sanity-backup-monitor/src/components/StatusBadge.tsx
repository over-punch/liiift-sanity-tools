// Colour-coded badge for a run conclusion or a health level.

import { Badge } from '@liiift-studio/sanity-ui-compat'
import type { HealthLevel, RunConclusion } from '../types'

/** Sanity UI tone for each run conclusion. */
const CONCLUSION_TONE: Record<RunConclusion, 'positive' | 'critical' | 'caution' | 'default'> = {
	success: 'positive',
	failure: 'critical',
	timed_out: 'critical',
	cancelled: 'caution',
	skipped: 'default',
	in_progress: 'default',
	unknown: 'default',
}

/** Sanity UI tone for each health level. */
const HEALTH_TONE: Record<HealthLevel, 'positive' | 'critical' | 'caution' | 'default'> = {
	ok: 'positive',
	warning: 'caution',
	critical: 'critical',
	unknown: 'default',
}

/** Human label for each run conclusion. */
const CONCLUSION_LABEL: Record<RunConclusion, string> = {
	success: 'Success',
	failure: 'Failed',
	timed_out: 'Timed out',
	cancelled: 'Cancelled',
	skipped: 'Skipped',
	in_progress: 'Running',
	unknown: 'Unknown',
}

/** Badge for one run's conclusion. */
export function ConclusionBadge(props: { conclusion: RunConclusion }) {
	return <Badge tone={CONCLUSION_TONE[props.conclusion]}>{CONCLUSION_LABEL[props.conclusion]}</Badge>
}

/** Badge for a target's overall health. */
export function HealthBadge(props: { level: HealthLevel }) {
	const label =
		props.level === 'ok' ? 'Healthy' :
		props.level === 'warning' ? 'Overdue' :
		props.level === 'critical' ? 'Attention' : 'Unknown'
	return <Badge tone={HEALTH_TONE[props.level]}>{label}</Badge>
}

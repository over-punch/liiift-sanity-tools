// Colour-coded badges for a run conclusion and for a target's overall health.

import { Badge } from '@liiift-studio/sanity-ui-compat'
import type { HealthAssessment, RunConclusion } from '../types'

/** Sanity UI tones available to these badges. */
type Tone = 'positive' | 'critical' | 'caution' | 'default'

/** Sanity UI tone for each run conclusion. */
const CONCLUSION_TONE: Record<RunConclusion, Tone> = {
	success: 'positive',
	neutral: 'positive',
	failure: 'critical',
	timed_out: 'critical',
	startup_failure: 'critical',
	stale: 'critical',
	cancelled: 'caution',
	action_required: 'caution',
	skipped: 'default',
	in_progress: 'default',
	unknown: 'default',
}

/** Human label for each run conclusion. */
const CONCLUSION_LABEL: Record<RunConclusion, string> = {
	success: 'Success',
	neutral: 'Neutral',
	failure: 'Failed',
	timed_out: 'Timed out',
	startup_failure: 'Startup failed',
	stale: 'Stale',
	cancelled: 'Cancelled',
	action_required: 'Needs approval',
	skipped: 'Skipped',
	in_progress: 'Running',
	unknown: 'Unknown',
}

/** Sanity UI tone for each health level. */
const HEALTH_TONE: Record<HealthAssessment['level'], Tone> = {
	ok: 'positive',
	warning: 'caution',
	critical: 'critical',
	unknown: 'default',
}

/**
 * Label for a health assessment.
 *
 * Keyed on `reason`, not just `level`, so a backup that is running and failing
 * does not get labelled "Overdue" — telling those two apart is the panel's job.
 *
 * @param health - the assessment to label
 */
function healthLabel(health: HealthAssessment): string {
	if (health.reason === 'failing') return health.level === 'critical' ? 'Failing' : 'Errors'
	if (health.reason === 'stale') return health.level === 'critical' ? 'Stale' : 'Overdue'
	if (health.reason === 'no-runs') return 'No runs'
	if (health.reason === 'undetermined') return 'Unknown'
	return 'Healthy'
}

/** Badge for one run's conclusion. */
export function ConclusionBadge(props: { conclusion: RunConclusion }) {
	return <Badge tone={CONCLUSION_TONE[props.conclusion]}>{CONCLUSION_LABEL[props.conclusion]}</Badge>
}

/** Badge for a target's overall health. */
export function HealthBadge(props: { health: HealthAssessment }) {
	return <Badge tone={HEALTH_TONE[props.health.level]}>{healthLabel(props.health)}</Badge>
}

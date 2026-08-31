// Turns a health assessment into wording an editor can act on.

import type { HealthAssessment, RunConclusion } from '../types'

/** Editor-facing summary of one target's state. */
export interface PlainSummary {
	/** Short status line, e.g. "Your content is backed up". */
	headline: string
	/** One sentence of plain detail beneath it. */
	detail: string
	/** What the reader should do, when there is something to do. */
	action?: string
}

/** Describe a cadence in words rather than a number of days. */
function cadence(days: number): string {
	if (days === 1) return 'every day'
	if (days === 7) return 'every week'
	if (days === 14) return 'every two weeks'
	if (days >= 28 && days <= 31) return 'every month'
	return `every ${days} days`
}

/** Turn an hour count into wording an editor would use out loud. */
function whenPhrase(hours: number | null): string {
	if (hours === null) return 'at some point'
	if (hours < 1) return 'just now'
	if (hours < 24) return 'today'
	if (hours < 48) return 'yesterday'
	const days = Math.floor(hours / 24)
	if (days < 14) return `${days} days ago`
	const weeks = Math.floor(days / 7)
	if (weeks < 9) return `about ${weeks} weeks ago`
	return `about ${Math.floor(days / 30)} months ago`
}

/** Standard closing line for anything an editor cannot fix themselves. */
const TELL_SOMEONE = 'Nothing you need to do in the Studio — pass this on to whoever looks after the site.'

/**
 * Describe a target's health in plain language.
 *
 * The panel's audience is editors, not the person who configured it. They need
 * three things: is my work safe, when was it last saved, and do I need to tell
 * anyone. Everything else is detail they can open if they want it.
 *
 * @param health - the assessment to describe
 * @param intervalDays - the target's expected cadence
 * @param workflowState - the workflow's GitHub state, when known
 * @returns editor-facing wording
 */
export function plainSummary(
	health: HealthAssessment,
	intervalDays: number,
	workflowState?: string | null,
): PlainSummary {
	// A disabled workflow outranks anything the run history says.
	if (workflowState && workflowState !== 'active') {
		return {
			headline: 'Backups have stopped',
			detail:
				workflowState === 'disabled_inactivity'
					? 'Automatic backups were switched off after a long gap without changes to the site code. Nothing is being backed up right now.'
					: 'Automatic backups have been switched off. Nothing is being backed up right now.',
			action: TELL_SOMEONE,
		}
	}

	switch (health.reason) {
		case 'ok':
			return {
				headline: 'Your content is backed up',
				detail: `The last backup finished ${whenPhrase(health.hoursSinceSuccess)}. Backups run automatically ${cadence(intervalDays)}.`,
			}
		case 'stale':
			return {
				headline: health.level === 'critical' ? 'Backups have stopped running' : 'Backup is overdue',
				detail: `The last successful backup was ${whenPhrase(health.hoursSinceSuccess)}, and they are meant to run ${cadence(intervalDays)}.`,
				action: TELL_SOMEONE,
			}
		case 'failing':
			return {
				headline: health.hoursSinceSuccess === null ? 'Backups are not working' : 'Recent backups have failed',
				detail:
					health.hoursSinceSuccess === null
						? 'Every recent backup attempt has failed. Your existing backups are still safe, but no new ones are being made.'
						: `${health.consecutiveFailures} recent ${health.consecutiveFailures === 1 ? 'attempt has' : 'attempts have'} failed. The last one that worked was ${whenPhrase(health.hoursSinceSuccess)}.`,
				action: TELL_SOMEONE,
			}
		case 'no-runs':
			return {
				headline: 'No backups found',
				detail: 'No backup has ever run for this content, which usually means something is set up wrong.',
				action: TELL_SOMEONE,
			}
		default:
			return {
				headline: 'Backup status unclear',
				detail: 'A backup may be running right now, or the status could not be read.',
			}
	}
}

/** How a run was started, in words rather than GitHub's event names. */
export function plainEvent(event: string): string {
	if (event === 'schedule') return 'Automatic'
	if (event === 'workflow_dispatch') return 'Started by hand'
	return event.replace(/_/g, ' ')
}

/** Outcome wording for the detail list. */
const PLAIN_OUTCOME: Partial<Record<RunConclusion, string>> = {
	success: 'Backed up',
	neutral: 'Backed up',
	failure: 'Failed',
	timed_out: 'Took too long',
	startup_failure: 'Could not start',
	stale: 'Expired',
	cancelled: 'Cancelled',
	skipped: 'Skipped',
	action_required: 'Needs approval',
	in_progress: 'Running now',
}

/**
 * Outcome of a single run, in plain words.
 *
 * @param conclusion - normalised run conclusion
 */
export function plainOutcome(conclusion: RunConclusion): string {
	return PLAIN_OUTCOME[conclusion] ?? 'Unknown'
}

// Decides whether a target's backup is healthy, stale, broken, or unassessable.

import type { HealthAssessment, RunConclusion, WorkflowRun } from '../types'

/** Default expected cadence when a target does not specify one. */
export const DEFAULT_INTERVAL_DAYS = 7

/**
 * Grace before a late backup is called stale. GitHub delays scheduled runs by
 * minutes or hours, never days, so 25% of the interval is ample slack — on a
 * weekly cadence that surfaces a problem at 8.75 days rather than sitting quiet
 * for a fortnight. Early detection is the entire point.
 */
const WARNING_MULTIPLIER = 1.25

/** Two full missed cycles is an outage, not a delay. */
const CRITICAL_MULTIPLIER = 2

/**
 * Conclusions that mean the backup ran and did its job.
 * `neutral` is GitHub's "completed without failing" and counts as a success.
 */
const SUCCEEDED: ReadonlySet<RunConclusion> = new Set(['success', 'neutral'])

/**
 * Conclusions that mean the backup ran and did not do its job.
 * Anything outside this set and SUCCEEDED is treated as neither — see
 * countLeadingFailures.
 */
const FAILED: ReadonlySet<RunConclusion> = new Set([
	'failure',
	'timed_out',
	'startup_failure',
	'stale',
])

/**
 * Parse an ISO timestamp, returning null rather than NaN for unusable input.
 *
 * A NaN age silently defeats every `>` comparison, which previously let a run
 * with a malformed timestamp fall through to a healthy verdict. A backup
 * monitor must never report green because it could not read its own data.
 *
 * @param iso - timestamp from the API
 * @returns epoch milliseconds, or null if unparseable
 */
function epoch(iso: string | undefined): number | null {
	if (!iso) return null
	const ms = new Date(iso).getTime()
	return Number.isFinite(ms) ? ms : null
}

/** Format an hour count as a short human phrase. */
function humanAge(hours: number): string {
	if (hours < 1) return 'less than an hour ago'
	if (hours < 24) return `${Math.floor(hours)}h ago`
	const days = Math.floor(hours / 24)
	return days === 1 ? '1 day ago' : `${days} days ago`
}

/**
 * Count failed runs at the head of the list.
 *
 * Runs that are still going, or that finished in a way that says nothing about
 * backup health (`skipped` from a path filter, `cancelled` by a concurrency
 * group, `action_required` awaiting approval, `unknown`), are stepped over
 * rather than counted. Treating them as failures previously downgraded healthy
 * targets on entirely routine events.
 *
 * @param byNewest - runs sorted newest first
 * @returns number of consecutive failures before the first success
 */
function countLeadingFailures(byNewest: WorkflowRun[]): number {
	let failures = 0
	for (const run of byNewest) {
		if (SUCCEEDED.has(run.conclusion)) break
		if (FAILED.has(run.conclusion)) failures++
	}
	return failures
}

/**
 * Assess backup health from a target's recent runs.
 *
 * This is the reason the panel exists. A backup's failure mode is silence: TDF's
 * workflow existed, appeared in the Actions tab, and had not succeeded in three
 * months, because nothing surfaced the gap where anyone would see it.
 *
 * Runs may arrive in any order; the newest successful run is what matters.
 *
 * @param runs - recent runs for one target, any order
 * @param expectedIntervalDays - how often the backup is meant to run
 * @param now - current time, injected so this stays testable
 * @returns the assessment shown in the panel
 */
export function assessHealth(
	runs: WorkflowRun[],
	expectedIntervalDays: number = DEFAULT_INTERVAL_DAYS,
	now: Date = new Date(),
): HealthAssessment {
	// A non-positive cadence would make every age exceed every threshold.
	const interval = expectedIntervalDays > 0 ? expectedIntervalDays : DEFAULT_INTERVAL_DAYS

	if (runs.length === 0) {
		return {
			level: 'unknown',
			reason: 'no-runs',
			hoursSinceSuccess: null,
			message: 'No runs found — check the workflow filename is correct',
			consecutiveFailures: 0,
		}
	}

	const byNewest = [...runs].sort((a, b) => (epoch(b.createdAt) ?? 0) - (epoch(a.createdAt) ?? 0))
	const consecutiveFailures = countLeadingFailures(byNewest)
	const lastSuccess = byNewest.find(r => SUCCEEDED.has(r.conclusion))

	if (!lastSuccess) {
		// Nothing has succeeded. If nothing has failed either, every run is still
		// in flight or inconclusive - that is unknown, not an outage.
		if (consecutiveFailures === 0) {
			return {
				level: 'unknown',
				reason: 'undetermined',
				hoursSinceSuccess: null,
				message: 'No completed runs yet',
				consecutiveFailures: 0,
			}
		}
		return {
			level: 'critical',
			reason: 'failing',
			hoursSinceSuccess: null,
			message: `No successful backup in the ${byNewest.length} most recent runs`,
			consecutiveFailures,
		}
	}

	const successAt = epoch(lastSuccess.createdAt)
	if (successAt === null) {
		// Unreadable timestamp: report that we cannot tell, never that it is fine.
		return {
			level: 'unknown',
			reason: 'undetermined',
			hoursSinceSuccess: null,
			message: 'Last run has an unreadable timestamp — cannot assess age',
			consecutiveFailures,
		}
	}

	const hoursSinceSuccess = (now.getTime() - successAt) / 3_600_000
	const expectedHours = interval * 24
	const age = humanAge(hoursSinceSuccess)

	if (hoursSinceSuccess > expectedHours * CRITICAL_MULTIPLIER) {
		return {
			level: 'critical',
			reason: 'stale',
			hoursSinceSuccess,
			message: `Last successful backup ${age} — expected every ${interval} days`,
			consecutiveFailures,
		}
	}
	if (hoursSinceSuccess > expectedHours * WARNING_MULTIPLIER) {
		return {
			level: 'warning',
			reason: 'stale',
			hoursSinceSuccess,
			message: `Last successful backup ${age} — overdue`,
			consecutiveFailures,
		}
	}
	// Recent success, but newer runs have failed since. Distinct from stale:
	// the schedule is firing, the backup is breaking.
	if (consecutiveFailures > 0) {
		return {
			level: 'warning',
			reason: 'failing',
			hoursSinceSuccess,
			message: `${consecutiveFailures} failed run${consecutiveFailures === 1 ? '' : 's'} since the last success ${age}`,
			consecutiveFailures,
		}
	}
	return {
		level: 'ok',
		reason: 'ok',
		hoursSinceSuccess,
		message: `Last successful backup ${age}`,
		consecutiveFailures,
	}
}

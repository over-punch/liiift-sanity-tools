// Decides whether a target's backup is healthy, stale, or broken.

import type { HealthAssessment, WorkflowRun } from '../types'

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

/** Format an hour count as a short human phrase. */
function humanAge(hours: number): string {
	if (hours < 1) return 'less than an hour ago'
	if (hours < 24) return `${Math.floor(hours)}h ago`
	const days = Math.floor(hours / 24)
	return days === 1 ? '1 day ago' : `${days} days ago`
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
	if (runs.length === 0) {
		return {
			level: 'unknown',
			hoursSinceSuccess: null,
			message: 'No runs found for this workflow',
			consecutiveFailures: 0,
		}
	}

	const byNewest = [...runs].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	)

	// Count failures at the head, ignoring runs still in flight.
	let consecutiveFailures = 0
	for (const run of byNewest) {
		if (run.conclusion === 'in_progress') continue
		if (run.conclusion === 'success') break
		consecutiveFailures++
	}

	const lastSuccess = byNewest.find(r => r.conclusion === 'success')
	if (!lastSuccess) {
		return {
			level: 'critical',
			hoursSinceSuccess: null,
			message: `No successful backup in the last ${byNewest.length} runs`,
			consecutiveFailures,
		}
	}

	const hoursSinceSuccess =
		(now.getTime() - new Date(lastSuccess.createdAt).getTime()) / 3_600_000
	const expectedHours = expectedIntervalDays * 24
	const age = humanAge(hoursSinceSuccess)

	if (hoursSinceSuccess > expectedHours * CRITICAL_MULTIPLIER) {
		return {
			level: 'critical',
			hoursSinceSuccess,
			message: `Last successful backup ${age} — expected every ${expectedIntervalDays} days`,
			consecutiveFailures,
		}
	}
	if (hoursSinceSuccess > expectedHours * WARNING_MULTIPLIER) {
		return {
			level: 'warning',
			hoursSinceSuccess,
			message: `Last successful backup ${age} — overdue`,
			consecutiveFailures,
		}
	}
	// Recent success, but newer runs have failed since.
	if (consecutiveFailures > 0) {
		return {
			level: 'warning',
			hoursSinceSuccess,
			message: `${consecutiveFailures} failed run${consecutiveFailures === 1 ? '' : 's'} since the last success ${age}`,
			consecutiveFailures,
		}
	}
	return {
		level: 'ok',
		hoursSinceSuccess,
		message: `Last successful backup ${age}`,
		consecutiveFailures,
	}
}

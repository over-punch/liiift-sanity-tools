// Tests for backup health assessment - the panel's reason for existing.

import { describe, expect, it } from 'vitest'
import { assessHealth } from '../src/lib/health'
import type { RunConclusion, WorkflowRun } from '../src/types'

const NOW = new Date('2026-08-28T12:00:00Z')

/** Build a run that started a given number of hours before NOW. */
function run(hoursAgo: number, conclusion: RunConclusion, id = hoursAgo): WorkflowRun {
	const t = new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString()
	return {
		id,
		runNumber: id,
		status: conclusion === 'in_progress' ? 'in_progress' : 'completed',
		conclusion,
		createdAt: t,
		updatedAt: t,
		htmlUrl: `https://github.com/x/y/actions/runs/${id}`,
		event: 'schedule',
	}
}

describe('assessHealth', () => {
	it('reports unknown when there are no runs at all', () => {
		const h = assessHealth([], 7, NOW)
		expect(h.level).toBe('unknown')
		expect(h.reason).toBe('no-runs')
		expect(h.hoursSinceSuccess).toBeNull()
	})

	it('is ok for a recent success on a weekly cadence', () => {
		const h = assessHealth([run(24, 'success')], 7, NOW)
		expect(h.level).toBe('ok')
		expect(h.reason).toBe('ok')
		expect(h.consecutiveFailures).toBe(0)
	})

	it('warns once the backup is overdue but not yet badly late', () => {
		const h = assessHealth([run(24 * 9, 'success')], 7, NOW)
		expect(h.level).toBe('warning')
		expect(h.reason).toBe('stale')
	})

	it('escalates to critical when far past the expected interval', () => {
		const h = assessHealth([run(24 * 30, 'success')], 7, NOW)
		expect(h.level).toBe('critical')
		expect(h.reason).toBe('stale')
	})

	it('is critical when every run failed - the TDF case', () => {
		const runs = [run(1, 'failure'), run(24 * 7, 'failure'), run(24 * 14, 'failure')]
		const h = assessHealth(runs, 7, NOW)
		expect(h.level).toBe('critical')
		expect(h.reason).toBe('failing')
		expect(h.hoursSinceSuccess).toBeNull()
		expect(h.consecutiveFailures).toBe(3)
	})

	it('distinguishes failing from overdue', () => {
		const h = assessHealth([run(2, 'failure'), run(20, 'success')], 7, NOW)
		expect(h.level).toBe('warning')
		expect(h.reason).toBe('failing')
		expect(h.consecutiveFailures).toBe(1)
	})

	it('does not count an in-flight run as a failure', () => {
		const h = assessHealth([run(0, 'in_progress'), run(20, 'success')], 7, NOW)
		expect(h.level).toBe('ok')
		expect(h.consecutiveFailures).toBe(0)
	})

	it('handles runs supplied oldest-first', () => {
		const h = assessHealth([run(24 * 30, 'success'), run(2, 'success')], 7, NOW)
		expect(h.level).toBe('ok')
	})

	it('respects a per-target cadence', () => {
		const runs = [run(24 * 3, 'success')]
		expect(assessHealth(runs, 1, NOW).level).toBe('critical')
		expect(assessHealth(runs, 7, NOW).level).toBe('ok')
	})

	// --- regressions found in the panel review ---

	it('never reports ok when the timestamp is unreadable', () => {
		const bad = {...run(1, 'success'), createdAt: 'not-a-date'}
		const h = assessHealth([bad], 7, NOW)
		expect(h.level).not.toBe('ok')
		expect(h.level).toBe('unknown')
		expect(h.reason).toBe('undetermined')
		expect(h.message).not.toMatch(/NaN/)
	})

	it('treats neutral as a success, not a failure', () => {
		const h = assessHealth([run(24, 'neutral')], 7, NOW)
		expect(h.level).toBe('ok')
		expect(h.consecutiveFailures).toBe(0)
	})

	it('does not count skipped or cancelled runs as failures', () => {
		const runs = [run(1, 'skipped'), run(2, 'cancelled'), run(20, 'success')]
		const h = assessHealth(runs, 7, NOW)
		expect(h.level).toBe('ok')
		expect(h.consecutiveFailures).toBe(0)
	})

	it('counts startup_failure and stale as failures', () => {
		const runs = [run(1, 'startup_failure'), run(2, 'stale'), run(20, 'success')]
		const h = assessHealth(runs, 7, NOW).consecutiveFailures
		expect(runs).toHaveLength(3)
		expect(h).toBe(2)
	})

	it('reports unknown, not critical, when every run is still in flight', () => {
		const h = assessHealth([run(0, 'in_progress'), run(1, 'in_progress')], 7, NOW)
		expect(h.level).toBe('unknown')
		expect(h.reason).toBe('undetermined')
	})

	it('falls back to the default cadence for a non-positive interval', () => {
		// 0 would previously make every positive age exceed every threshold.
		expect(assessHealth([run(24, 'success')], 0, NOW).level).toBe('ok')
		expect(assessHealth([run(24, 'success')], -5, NOW).level).toBe('ok')
	})

	it('pins the warning threshold at 1.25x the interval', () => {
		const justUnder = assessHealth([run(7 * 24 * 1.25 - 1, 'success')], 7, NOW)
		const justOver = assessHealth([run(7 * 24 * 1.25 + 1, 'success')], 7, NOW)
		expect(justUnder.level).toBe('ok')
		expect(justOver.level).toBe('warning')
	})

	it('pins the critical threshold at 2x the interval', () => {
		const justUnder = assessHealth([run(7 * 24 * 2 - 1, 'success')], 7, NOW)
		const justOver = assessHealth([run(7 * 24 * 2 + 1, 'success')], 7, NOW)
		expect(justUnder.level).toBe('warning')
		expect(justOver.level).toBe('critical')
	})

	it('finds the newest success even when a bad timestamp is mixed in', () => {
		const runs = [
			{...run(5, 'success', 1), createdAt: 'garbage'},
			run(24 * 40, 'success', 2),
		]
		// The only readable success is 40 days old, so this must not read as healthy.
		expect(assessHealth(runs, 7, NOW).level).not.toBe('ok')
	})
})

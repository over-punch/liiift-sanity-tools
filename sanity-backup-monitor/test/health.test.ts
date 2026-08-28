// Tests for backup health assessment - the panel's reason for existing.

import { describe, expect, it } from 'vitest'
import { assessHealth } from '../src/lib/health'
import type { RunConclusion, WorkflowRun } from '../src/types'

const NOW = new Date('2026-08-28T12:00:00Z')

/** Build a run that finished a given number of hours before NOW. */
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
		expect(h.hoursSinceSuccess).toBeNull()
	})

	it('is ok for a recent success on a weekly cadence', () => {
		const h = assessHealth([run(24, 'success')], 7, NOW)
		expect(h.level).toBe('ok')
		expect(h.consecutiveFailures).toBe(0)
	})

	it('warns once the backup is overdue but not yet badly late', () => {
		// 7-day cadence, last success 9 days ago -> past 1.5x, under 2.5x
		const h = assessHealth([run(24 * 9, 'success')], 7, NOW)
		expect(h.level).toBe('warning')
	})

	it('escalates to critical when far past the expected interval', () => {
		const h = assessHealth([run(24 * 30, 'success')], 7, NOW)
		expect(h.level).toBe('critical')
	})

	it('is critical when every run failed - the TDF case', () => {
		const runs = [run(1, 'failure'), run(24 * 7, 'failure'), run(24 * 14, 'failure')]
		const h = assessHealth(runs, 7, NOW)
		expect(h.level).toBe('critical')
		expect(h.hoursSinceSuccess).toBeNull()
		expect(h.consecutiveFailures).toBe(3)
	})

	it('warns when failures follow a recent success', () => {
		const h = assessHealth([run(2, 'failure'), run(20, 'success')], 7, NOW)
		expect(h.level).toBe('warning')
		expect(h.consecutiveFailures).toBe(1)
		expect(h.message).toMatch(/1 failed run/)
	})

	it('does not count an in-flight run as a failure', () => {
		const h = assessHealth([run(0, 'in_progress'), run(20, 'success')], 7, NOW)
		expect(h.level).toBe('ok')
		expect(h.consecutiveFailures).toBe(0)
	})

	it('handles runs supplied oldest-first', () => {
		const runs = [run(24 * 30, 'success'), run(2, 'success')]
		const h = assessHealth(runs, 7, NOW)
		expect(h.level).toBe('ok')
	})

	it('respects a per-target cadence', () => {
		const runs = [run(24 * 3, 'success')]
		expect(assessHealth(runs, 1, NOW).level).toBe('critical')
		expect(assessHealth(runs, 7, NOW).level).toBe('ok')
	})
})

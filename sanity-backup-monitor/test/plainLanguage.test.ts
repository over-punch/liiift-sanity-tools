// Tests for the editor-facing wording.

import { describe, expect, it } from 'vitest'
import { plainEvent, plainOutcome, plainSummary } from '../src/lib/plainLanguage'
import type { HealthAssessment } from '../src/types'

/** Build an assessment with the given shape. */
function health(over: Partial<HealthAssessment>): HealthAssessment {
	return {
		level: 'ok',
		reason: 'ok',
		hoursSinceSuccess: 24,
		message: '',
		consecutiveFailures: 0,
		...over,
	}
}

describe('plainSummary', () => {
	it('reassures when healthy, and says how often backups run', () => {
		const s = plainSummary(health({}), 7)
		expect(s.headline).toBe('Your content is backed up')
		expect(s.detail).toContain('every week')
		expect(s.action).toBeUndefined()
	})

	it('tells the reader who to contact when something is wrong', () => {
		const s = plainSummary(health({ level: 'warning', reason: 'stale', hoursSinceSuccess: 24 * 12 }), 7)
		expect(s.headline).toBe('Backup is overdue')
		expect(s.action).toMatch(/pass this on/i)
	})

	it('escalates the wording for a long outage', () => {
		const s = plainSummary(health({ level: 'critical', reason: 'stale', hoursSinceSuccess: 24 * 40 }), 7)
		expect(s.headline).toBe('Backups have stopped running')
	})

	it('reassures that existing backups survive when everything is failing', () => {
		const s = plainSummary(health({ level: 'critical', reason: 'failing', hoursSinceSuccess: null }), 7)
		expect(s.headline).toBe('Backups are not working')
		expect(s.detail).toMatch(/existing backups are still safe/i)
	})

	it('a disabled workflow outranks whatever the run history says', () => {
		const s = plainSummary(health({}), 7, 'disabled_inactivity')
		expect(s.headline).toBe('Backups have stopped')
		expect(s.detail).toMatch(/switched off/i)
		expect(s.action).toBeDefined()
	})

	it('uses everyday words for recency', () => {
		expect(plainSummary(health({ hoursSinceSuccess: 0.5 }), 7).detail).toContain('just now')
		expect(plainSummary(health({ hoursSinceSuccess: 5 }), 7).detail).toContain('today')
		expect(plainSummary(health({ hoursSinceSuccess: 30 }), 7).detail).toContain('yesterday')
		expect(plainSummary(health({ hoursSinceSuccess: 24 * 21 }), 7).detail).toContain('about 3 weeks ago')
	})

	it('describes common cadences in words', () => {
		expect(plainSummary(health({}), 1).detail).toContain('every day')
		expect(plainSummary(health({}), 14).detail).toContain('every two weeks')
		expect(plainSummary(health({}), 30).detail).toContain('every month')
		expect(plainSummary(health({}), 3).detail).toContain('every 3 days')
	})

	it('never leaves an editor without an explanation', () => {
		for (const reason of ['ok', 'stale', 'failing', 'no-runs', 'undetermined'] as const) {
			const s = plainSummary(health({ reason }), 7)
			expect(s.headline.length).toBeGreaterThan(0)
			expect(s.detail.length).toBeGreaterThan(0)
		}
	})
})

describe('plainEvent / plainOutcome', () => {
	it('translates GitHub event names', () => {
		expect(plainEvent('schedule')).toBe('Automatic')
		expect(plainEvent('workflow_dispatch')).toBe('Started by hand')
		expect(plainEvent('pull_request')).toBe('pull request')
	})

	it('translates outcomes', () => {
		expect(plainOutcome('success')).toBe('Backed up')
		expect(plainOutcome('neutral')).toBe('Backed up')
		expect(plainOutcome('timed_out')).toBe('Took too long')
		expect(plainOutcome('unknown')).toBe('Unknown')
	})
})

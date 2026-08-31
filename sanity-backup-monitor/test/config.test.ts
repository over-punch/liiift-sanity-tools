// Tests for plugin option resolution, especially the trigger opt-in.

import { describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config'

describe('resolveConfig', () => {
	it('hides the trigger button by default', () => {
		expect(resolveConfig({}).allowTrigger).toBe(false)
	})

	it('honours an explicit opt-in', () => {
		expect(resolveConfig({ allowTrigger: true }).allowTrigger).toBe(true)
	})

	it('defaults to proxy mode when a proxyUrl is given', () => {
		expect(resolveConfig({ proxyUrl: 'https://x/api' }).mode).toBe('proxy')
	})

	it('defaults to direct mode without one', () => {
		expect(resolveConfig({}).mode).toBe('direct')
	})

	it('defaults runLimit and targets', () => {
		const c = resolveConfig()
		expect(c.runLimit).toBe(5)
		expect(c.targets).toEqual([])
	})
})

describe('resolveConfig — polling', () => {
	it('polls every 5 minutes by default', () => {
		expect(resolveConfig({}).refreshIntervalMs).toBe(300_000)
	})

	it('honours an explicit interval', () => {
		expect(resolveConfig({ refreshIntervalMs: 60_000 }).refreshIntervalMs).toBe(60_000)
	})

	it('allows polling to be disabled with 0', () => {
		expect(resolveConfig({ refreshIntervalMs: 0 }).refreshIntervalMs).toBe(0)
	})
})

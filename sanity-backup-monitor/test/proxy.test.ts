// Tests for the proxy's allowlist and key handling - the security-relevant parts.

import { describe, expect, it } from 'vitest'
import { checkStatusKey, parseTargets } from '../proxy/core'
import type { ProxyEnv } from '../proxy/core'

const baseEnv: ProxyEnv = { githubToken: 't', targets: {} }

describe('parseTargets', () => {
	it('parses a single target with a default ref', () => {
		const t = parseTargets('mckl:Liiift-Studio/mckl-cms/backup-routine.yml')
		expect(t.mckl).toEqual({
			owner: 'Liiift-Studio', repo: 'mckl-cms', workflow: 'backup-routine.yml', ref: 'main',
		})
	})

	it('honours an explicit ref', () => {
		const t = parseTargets('x:o/r/w.yml@staging')
		expect(t.x.ref).toBe('staging')
	})

	it('parses several comma-separated targets', () => {
		const t = parseTargets('a:o/r/w.yml, b:o2/r2/w2.yml')
		expect(Object.keys(t).sort()).toEqual(['a', 'b'])
	})

	it('skips malformed entries rather than half-parsing them', () => {
		const t = parseTargets('good:o/r/w.yml,missingcolon,bad:only/two')
		expect(Object.keys(t)).toEqual(['good'])
	})

	it('returns an empty allowlist for undefined', () => {
		expect(parseTargets(undefined)).toEqual({})
	})
})

describe('checkStatusKey', () => {
	it('allows any request when no key is configured', () => {
		expect(checkStatusKey(null, baseEnv)).toBeNull()
	})

	it('rejects a wrong key', () => {
		const r = checkStatusKey('nope', { ...baseEnv, statusKey: 'secret' })
		expect(r?.status).toBe(401)
	})

	it('rejects a missing key when one is required', () => {
		expect(checkStatusKey(null, { ...baseEnv, statusKey: 'secret' })?.status).toBe(401)
	})

	it('allows the correct key', () => {
		expect(checkStatusKey('secret', { ...baseEnv, statusKey: 'secret' })).toBeNull()
	})
})

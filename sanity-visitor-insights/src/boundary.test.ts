/**
 * Guards the client/server boundary.
 *
 * The Studio entry runs in a public browser bundle; the server entry reads a GA4 service-account
 * key and a Vercel token. Nothing reachable from `src/index.ts` may touch `src/server/`, and that
 * needs to be enforced by a test rather than by reviewer vigilance — the failure mode is a
 * credential-reading module silently shipped to every visitor of a Studio, which no type check
 * and no lint rule in this repo would catch.
 *
 * Walks the real import graph from each entry point rather than checking a single file, since the
 * dangerous case is a transitive import several modules deep.
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname)

/** Resolve a relative import specifier to a file on disk, trying the usual extensions. */
function resolveImport(fromFile: string, specifier: string): string | null {
	const base = resolve(dirname(fromFile), specifier)

	for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
		if (existsSync(candidate) && !candidate.endsWith('/')) {
			try {
				if (readFileSync(candidate).length >= 0) return candidate
			} catch {
				// Directory rather than file — keep trying.
			}
		}
	}

	return null
}

/**
 * Collect every local module reachable from an entry point.
 * Type-only imports are included deliberately: an `import type` erases at build time, but its
 * presence still means the boundary is being crossed in source, which is what this guards.
 */
function reachableFrom(entry: string): Set<string> {
	const seen = new Set<string>()
	const queue = [entry]

	while (queue.length > 0) {
		const file = queue.pop()
		if (!file || seen.has(file)) continue
		seen.add(file)

		const source = readFileSync(file, 'utf8')
		const specifiers = [...source.matchAll(/from\s+'(\.[^']+)'/g)].map((m) => m[1])

		for (const specifier of specifiers) {
			if (!specifier) continue
			const resolved = resolveImport(file, specifier)
			if (resolved && !seen.has(resolved)) queue.push(resolved)
		}
	}

	return seen
}

describe('client/server boundary', () => {
	it('does not let the Studio entry reach any server module', () => {
		const reachable = reachableFrom(join(SRC, 'index.ts'))
		const leaked = [...reachable].filter((file) => file.includes('/src/server'))

		expect(leaked, `Studio entry reaches server modules:\n${leaked.join('\n')}`).toEqual([])
	})

	it('does not let the Studio entry reach node:crypto or process.env', () => {
		const reachable = reachableFrom(join(SRC, 'index.ts'))

		for (const file of reachable) {
			const source = readFileSync(file, 'utf8')
			expect(source, `${file} imports node:crypto`).not.toContain("from 'node:crypto'")
			expect(source, `${file} reads process.env`).not.toContain('process.env')
		}
	})

	it('keeps the server entry free of React and @sanity/ui', () => {
		// The reverse direction matters less for safety but keeps the server bundle small and
		// importable from a plain Node API route without a React runtime present.
		const reachable = reachableFrom(join(SRC, 'server.ts'))

		for (const file of reachable) {
			const source = readFileSync(file, 'utf8')
			expect(source, `${file} imports React`).not.toMatch(/from 'react'/)
			expect(source, `${file} imports @sanity/ui`).not.toContain("from '@sanity/ui'")
		}
	})
})

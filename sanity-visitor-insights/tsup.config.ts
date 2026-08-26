/**
 * tsup build config — two entries that must never merge.
 *
 * `index` is the Studio plugin and runs in the browser. `server` is the API-route handler factory
 * and runs in Node, holding the GA4 service account and Vercel token. Keeping them as separate
 * entries with separate export subpaths is what guarantees a credential-bearing dependency can
 * never be pulled into a Studio bundle by a bundler that fails to tree-shake node-only code.
 */
import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/index.ts', 'src/server.ts'],
	format: ['cjs', 'esm'],
	dts: true,
	// Peer/host-provided packages. Node builtins used by the server entry stay external by default.
	external: ['sanity', 'react', 'react/jsx-runtime', '@sanity/ui', '@sanity/icons'],
	clean: true,
	sourcemap: true,
	splitting: false,
})

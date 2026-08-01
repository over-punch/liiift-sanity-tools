/** tsup build config — JSX action + bundled Hyperglot orthography data */
import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/index.js'],
	format: ['cjs', 'esm'],
	dts: false,
	external: ['sanity', '@sanity/ui', 'react'],
	loader: { '.json': 'json' },
	clean: true,
	sourcemap: true,
})

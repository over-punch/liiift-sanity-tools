import { defineConfig } from 'tsup'

export default defineConfig({
	// Two entries: the icons table is split out so a plugin importing only layout
	// primitives does not pull in 43 icon resolutions, and vice versa.
	entry: ['src/index.ts', 'src/icons.tsx'],
	format: ['esm', 'cjs'],
	dts: true,
	clean: true,
	/*
	 * Exact-string externals are sufficient HERE because this package never imports
	 * a @sanity/ui or @sanity/icons subpath — it reads the installed namespace at
	 * runtime. Any plugin that does import a subpath must extend its own externals,
	 * or esbuild will bundle a second copy of the ui runtime and break theme context.
	 */
	external: ['react', 'react-dom', 'sanity', '@sanity/ui', '@sanity/icons'],
})

import { defineConfig } from 'tsup'

export default defineConfig({
	// proxy/core is built too, so a JavaScript-only site (no tsconfig, no
	// typescript dependency) can import it instead of copying a .ts file.
	entry: { index: 'src/index.tsx', 'proxy-core': 'proxy/core.ts' },
	format: ['esm', 'cjs'],
	dts: true,
	clean: true,
	external: ['react', 'react-dom', 'sanity', '@sanity/ui', '@sanity/icons'],
})

import { defineConfig } from 'tsup'

export default defineConfig({
	// Only the Studio plugin is published. proxy/ stays in the repo as reference
	// but is not built or shipped - see README for why.
	entry: { index: 'src/index.tsx' },
	format: ['esm', 'cjs'],
	dts: true,
	clean: true,
	external: ['react', 'react-dom', 'sanity', '@sanity/ui', '@sanity/icons'],
})

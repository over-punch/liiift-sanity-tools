// Sanity CLI config — Vite aliases for sibling package resolution
import { defineCliConfig } from 'sanity/cli';
import path from 'path';

const studioRoot = __dirname;
const toolsRoot = path.resolve(__dirname, '..');
const nm = (...segments: string[]) => path.join(studioRoot, 'node_modules', ...segments);

export default defineCliConfig({
	api: {
		projectId: process.env.SANITY_STUDIO_PROJECT_ID || '6fljbzmb',
		dataset: process.env.SANITY_STUDIO_DATASET || 'production',
	},
	vite: (prev) => ({
		...prev,
		resolve: {
			...prev.resolve,
			alias: {
				...(prev.resolve?.alias || {}),

				// --- Cross-package @overpunch/* imports ---
				// Tools that import each other by package name
				'@overpunch/sanity-advanced-reference-array': path.join(toolsRoot, 'sanity-advanced-reference-array/src'),
				'@overpunch/sanity-key-value-input': path.join(toolsRoot, 'sanity-key-value-input/src'),
				'@overpunch/sanity-nested-object-selector': path.join(toolsRoot, 'sanity-nested-object-selector/src'),
				'@overpunch/sanity-foundry-constants': path.join(toolsRoot, 'sanity-foundry-constants/src'),
				'@overpunch/sanity-font-manager': path.join(toolsRoot, 'sanity-font-uploader/src'),
				'@overpunch/sanity-typeface-fields': path.join(toolsRoot, 'sanity-typeface-fields/src'),
				'@overpunch/sanity-typeface-seo': path.join(toolsRoot, 'sanity-typeface-seo/src'),

				// --- Runtime deps used by sibling tools ---
				// Sibling tool source files can't find these via normal node_modules
				// resolution because test-studio/node_modules is a sibling, not an ancestor.
				// Alias each to the test-studio's installed copy.
				'date-fns': nm('date-fns'),
				'groq': nm('groq'),
				'lib-font': nm('lib-font'),
				'nanoid': nm('nanoid'),
				'pako': nm('pako'),
				'slugify': nm('slugify'),
				'base-64': nm('base-64'),
				'@devtools-ds/object-inspector': nm('@devtools-ds', 'object-inspector'),
				'fontkit': nm('fontkit'),
			},
		},
		// Exclude lib-font and pako from Vite's dep optimizer so that
		// globalThis.pako is set by parseFont.js BEFORE lib-font evaluates.
		// Without this, Vite pre-bundles lib-font and it reads globalThis.pako
		// as undefined, falling back to Node zlib (unavailable in browser).
		optimizeDeps: {
			...prev.optimizeDeps,
			exclude: [
				...(prev.optimizeDeps?.exclude || []),
				'lib-font',
				'pako',
			],
		},
		// Allow Vite dev server to serve files from sibling tool directories
		server: {
			...prev.server,
			fs: {
				...prev.server?.fs,
				allow: [
					studioRoot,
					toolsRoot,
				],
			},
		},
	}),
});

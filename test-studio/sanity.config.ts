// Test studio configuration — mirrors foundry platform pattern with Structure + Utilities + Font tools
import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';

// --- definePlugin factories ---
import { vercelDeploy } from '../deploy-vercel-from-sanity/src';
import { backupMonitor } from '../sanity-backup-monitor/src';
import { liiiftVersionBadge } from '../sanity-studio-version-badge/src';

// --- Utilities desk (matches foundry sites) ---
import { Utilities } from '../sanity-type-foundry-utilities/components/utilities';

// --- Font tools ---
import { FontDataExtractor } from '../sanity-font-data-extractor/src';

// --- Other component tools ---
import { RenewalsAuthorizationComponent } from '../sanity-renewals-authorization/src';
import { SalesPortalComponent } from '../sanity-sales-portal/src/components/SalesPortalComponent';

// --- Test schemas ---
import { schemaTypes } from './schemas';
import { inputTestSchemas } from './schemas/input-test';

// Instantiate the utilities desk (same pattern as Darden, TDF, etc.)
const utilitiesDesk = Utilities();

export default defineConfig({
	name: 'liiift-tools-test-studio',
	title: 'Liiift Sanity Tools — Test Studio',

	projectId: process.env.SANITY_STUDIO_PROJECT_ID || '6fljbzmb',
	dataset: process.env.SANITY_STUDIO_DATASET || 'production',

	plugins: [
		backupMonitor({
			token: process.env.SANITY_STUDIO_BACKUP_GH_TOKEN,
			targets: [
				{ label: 'MCKL', owner: 'Liiift-Studio', repo: 'mckl-cms', workflow: 'backup-routine.yml', expectedIntervalDays: 7 },
				{ label: 'Darden', owner: 'Liiift-Studio', repo: 'Darden-Studio', workflow: 'backup-routine.yml', expectedIntervalDays: 7 },
				{ label: 'TDF', owner: 'Liiift-Studio', repo: 'the-designers-foundry', workflow: 'backup-routine.yml', expectedIntervalDays: 7 },
			],
		}),
		structureTool(),
		visionTool(),
		vercelDeploy(),
		liiiftVersionBadge(),
	],

	schema: {
		types: [
			...schemaTypes,
			...inputTestSchemas,
		],
	},

	tools: (prev) => [
		...prev,
		// BatchUploadFonts is a document input component, not a standalone tool —
		// test it inside a Typeface document's Styles tab instead.
		{
			name: 'font-data-extractor',
			title: 'Font Data Extractor',
			component: FontDataExtractor,
		},
		// Renewals
		{
			name: 'renewals-authorization',
			title: 'Renewals',
			component: RenewalsAuthorizationComponent,
		},
		// Sales Portal
		{
			name: 'sales-portal',
			title: 'Sales Portal',
			component: SalesPortalComponent,
		},
		// Utilities desk — bundles all data management / dev tools (matches foundry sites)
		utilitiesDesk,
	],
});

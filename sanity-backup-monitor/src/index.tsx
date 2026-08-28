// sanity-backup-monitor — Studio panel for backup health across foundry repos.

import { definePlugin } from 'sanity'
import { ClockIcon } from '@liiift-studio/sanity-ui-compat/icons'
import { BackupTool } from './components/BackupTool'
import { ConfigProvider, resolveConfig } from './config'
import type { BackupMonitorConfig } from './types'

export { assessHealth, DEFAULT_INTERVAL_DAYS } from './lib/health'
export type {
	BackupMonitorConfig,
	BackupMonitorMode,
	BackupTarget,
	HealthAssessment,
	HealthLevel,
	RunConclusion,
	WorkflowRun,
} from './types'

/**
 * Sanity Studio plugin — backup health, with on-demand triggering.
 *
 * @example
 * // sanity.config.ts
 * import { backupMonitor } from '@liiift-studio/sanity-backup-monitor'
 *
 * export default defineConfig({
 *   plugins: [
 *     backupMonitor({
 *       proxyUrl: 'https://ops.example.com/api/backup-proxy',
 *       statusKey: process.env.SANITY_STUDIO_BACKUP_STATUS_KEY,
 *       targets: [
 *         { label: 'MCKL', owner: 'Liiift-Studio', repo: 'mckl-cms',
 *           workflow: 'backup-routine.yml', expectedIntervalDays: 7 },
 *       ],
 *     }),
 *   ],
 * })
 */
export const backupMonitor = definePlugin<BackupMonitorConfig | void>(options => {
	const config = options ?? {}
	const resolved = resolveConfig(options)
	return {
		name: 'sanity-backup-monitor',
		tools: [
			{
				name: config.name ?? 'backup-monitor',
				title: config.title ?? 'Backups',
				icon: config.icon ?? ClockIcon,
				// Wrapped so the tool tree can read resolved config without prop drilling.
				component: () => (
					<ConfigProvider value={resolved}>
						<BackupTool />
					</ConfigProvider>
				),
			},
		],
	}
})

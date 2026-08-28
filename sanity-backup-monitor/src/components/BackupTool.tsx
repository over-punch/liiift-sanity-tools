// Studio tool: backup health for every configured repository.

import { Box, Card, Container, Stack, Text } from '@liiift-studio/sanity-ui-compat'
import { useConfig } from '../config'
import { TargetCard } from './TargetCard'

/** Shown when the plugin is installed but not configured. */
function EmptyState() {
	return (
		<Card padding={4} radius={2} tone="caution">
			<Stack space={3}>
				<Text size={2} weight="semibold">No backup targets configured</Text>
				<Text size={1}>
					Pass <code>targets</code> to <code>backupMonitor()</code> in sanity.config, each with
					an owner, repo and workflow filename.
				</Text>
			</Stack>
		</Card>
	)
}

/** Warns when the GitHub token is being shipped in the Studio bundle. */
function DirectModeWarning() {
	return (
		<Card padding={3} radius={2} tone="caution">
			<Text size={1}>
				Running in direct mode: the GitHub token is stored in the dataset and is readable by
				everyone who can read it — on a public dataset, by anyone. Use proxy mode in production.
			</Text>
		</Card>
	)
}

/** Root component for the Backups tool. */
export function BackupTool() {
	const config = useConfig()

	return (
		<Container width={2}>
			<Box padding={4}>
				<Stack space={4}>
					<Stack space={2}>
						<Text size={3} weight="semibold">Backups</Text>
						<Text size={1} muted>
							Scheduled dataset backups. A backup that stops running fails silently, so this
							panel surfaces staleness rather than waiting for someone to check Actions.
						</Text>
					</Stack>

					{config.mode === 'direct' && config.token ? <DirectModeWarning /> : null}

					{config.targets.length === 0 ? (
						<EmptyState />
					) : (
						<Stack space={4}>
							{config.targets.map(target => (
								<TargetCard key={`${target.owner}/${target.repo}/${target.workflow}`} target={target} />
							))}
						</Stack>
					)}
				</Stack>
			</Box>
		</Container>
	)
}

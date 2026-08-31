// Studio tool: backup health for every configured repository.

import { Box, Card, Container, Stack, Text, ToastViewport } from '@liiift-studio/sanity-ui-compat'
import { useConfig } from '../config'
import { TargetCard } from './TargetCard'
import type { BackupTarget } from '../types'

/** Shown when the plugin is installed but not configured. */
function EmptyState() {
	return (
		<Card padding={4} radius={2} tone="caution">
			<Stack space={3}>
				<Text as="h2" size={2} weight="semibold">
					No backup targets configured
				</Text>
				<Text size={1}>
					Pass <code>targets</code> to <code>backupMonitor()</code> in sanity.config, each with
					an owner, repo and workflow filename.
				</Text>
			</Stack>
		</Card>
	)
}

/**
 * Warns when a *trigger-capable* token is shipped in the Studio bundle.
 *
 * Deliberately not shown for the read-only setup. A token scoped to Actions: read
 * on one repository reaches nothing a Studio user cannot already read from the
 * dataset, so warning about it every time is noise. Once triggering is enabled the
 * token needs Actions: write, which a Studio user can extract and use to dispatch
 * workflows — that is worth flagging.
 */
function TriggerTokenWarning() {
	return (
		<Card padding={3} radius={2} tone="caution" role="alert">
			<Text size={1}>
				Triggering is enabled in direct mode, so a token with Actions: write is compiled into
				the Studio bundle and can be read by anyone who can open this Studio. Use proxy mode to
				keep it server-side.
			</Text>
		</Card>
	)
}

/**
 * Identity for a configured target.
 *
 * Includes the label: two entries can legitimately watch the same workflow under
 * different labels or cadences, and keying without it collides, letting React
 * reconcile one card's state into another.
 *
 * @param target - the target to key
 */
function targetKey(target: BackupTarget): string {
	return `${target.label}::${target.owner}/${target.repo}/${target.workflow}`
}

/** Root component for the Backups tool. */
export function BackupTool() {
	const config = useConfig()

	return (
		<Container width={2}>
			<Box padding={4}>
				<Stack space={4}>
					<Stack space={2}>
						<Text as="h1" size={3} weight="semibold">
							Backups
						</Text>
						<Text size={1} muted>
							Scheduled dataset backups. A backup that stops running fails silently, so this
							panel surfaces staleness rather than waiting for someone to check Actions.
						</Text>
					</Stack>

					{config.mode === 'direct' && config.token && config.allowTrigger ? (
						<TriggerTokenWarning />
					) : null}

					{config.targets.length === 0 ? (
						<EmptyState />
					) : (
						<Stack space={4}>
							{config.targets.map(target => (
								<TargetCard key={targetKey(target)} target={target} />
							))}
						</Stack>
					)}
				</Stack>
			</Box>
			{/*
			  Required on @sanity/ui v4+, where useToast is tombstoned off the barrel and
			  the compat shim falls back to a local queue that renders nothing without a
			  viewport. Without this every toast from this plugin is silently discarded.
			*/}
			<ToastViewport />
		</Container>
	)
}

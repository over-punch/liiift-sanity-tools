// One repository's backup health, recent runs, and trigger button.

import { useCallback, useEffect, useState } from 'react'
import { Box, Button, Card, Flex, Spinner, Stack, Text, useToast } from '@liiift-studio/sanity-ui-compat'
import { RefreshIcon, SyncIcon } from '@liiift-studio/sanity-ui-compat/icons'
import { assessHealth, DEFAULT_INTERVAL_DAYS } from '../lib/health'
import { fetchRuns, triggerBackup } from '../lib/transport'
import { useConfig } from '../config'
import { ConclusionBadge, HealthBadge } from './StatusBadge'
import type { BackupTarget, HealthAssessment, WorkflowRun } from '../types'

/** Format an ISO timestamp for display, falling back to the raw value. */
function formatTime(iso: string): string {
	const d = new Date(iso)
	return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

/**
 * Panel section for a single backup target.
 *
 * @param props.target - the repository to show
 */
export function TargetCard(props: { target: BackupTarget }) {
	const { target } = props
	const config = useConfig()
	const toast = useToast()

	const [runs, setRuns] = useState<WorkflowRun[] | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)
	const [triggering, setTriggering] = useState(false)

	// True when no credential is configured yet, which is the state a Studio is in
	// between installing the plugin and someone adding the token.
	const unconfigured =
		(config.mode === 'direct' && !config.token) || (config.mode === 'proxy' && !config.proxyUrl)

	const load = useCallback(async () => {
		if (unconfigured) {
			setLoading(false)
			return
		}
		setLoading(true)
		setError(null)
		try {
			setRuns(await fetchRuns(config, target))
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err))
			setRuns(null)
		} finally {
			setLoading(false)
		}
	}, [config, target, unconfigured])

	useEffect(() => {
		void load()
	}, [load])

	const onTrigger = useCallback(async () => {
		setTriggering(true)
		try {
			await triggerBackup(config, target)
			toast.push({ status: 'success', title: `Backup started for ${target.label}` })
			// GitHub needs a moment before the new run appears in the list.
			setTimeout(() => void load(), 4000)
		} catch (err) {
			toast.push({
				status: 'error',
				title: `Could not start backup for ${target.label}`,
				description: err instanceof Error ? err.message : String(err),
			})
		} finally {
			setTriggering(false)
		}
	}, [config, target, toast, load])

	const health: HealthAssessment | null = runs
		? assessHealth(runs, target.expectedIntervalDays ?? DEFAULT_INTERVAL_DAYS)
		: null

	// A stale or broken backup gets a coloured card, so it reads at a glance
	// rather than needing to be looked for.
	const tone =
		health?.level === 'critical' ? 'critical' :
		health?.level === 'warning' ? 'caution' : 'default'

	return (
		<Card padding={4} radius={2} shadow={1} tone={tone}>
			<Stack space={4}>
				<Flex align="center" gap={3}>
					<Box flex={1}>
						<Stack space={2}>
							<Text size={2} weight="semibold">{target.label}</Text>
							<Text size={1} muted>{target.owner}/{target.repo} · {target.workflow}</Text>
						</Stack>
					</Box>
					{health ? <HealthBadge level={health.level} /> : null}
				</Flex>

				{unconfigured ? (
					<Card padding={3} radius={2} tone="caution">
						<Text size={1}>
							{config.mode === 'direct'
								? 'No GitHub token configured. Pass `token` to backupMonitor() with an Actions: read scoped fine-grained token.'
								: 'No proxyUrl configured. Point backupMonitor() at your backup proxy.'}
						</Text>
					</Card>
				) : loading ? (
					<Flex align="center" gap={2}><Spinner muted /><Text size={1} muted>Loading runs…</Text></Flex>
				) : error ? (
					<Card padding={3} radius={2} tone="critical">
						<Text size={1}>{error}</Text>
					</Card>
				) : (
					<Stack space={3}>
						{health ? <Text size={1}>{health.message}</Text> : null}
						<Stack space={2}>
							{(runs ?? []).map(run => (
								<Flex key={run.id} align="center" gap={3}>
									<Box flex={1}>
										<Text size={1} muted>
											#{run.runNumber} · {run.event} · {formatTime(run.createdAt)}
										</Text>
									</Box>
									<ConclusionBadge conclusion={run.conclusion} />
								</Flex>
							))}
							{(runs ?? []).length === 0 ? (
								<Text size={1} muted>No runs recorded yet.</Text>
							) : null}
						</Stack>
					</Stack>
				)}

				<Flex gap={2} hidden={unconfigured}>
					<Button
						mode="ghost"
						icon={RefreshIcon}
						text="Refresh"
						onClick={() => void load()}
						disabled={loading}
					/>
					<Button
						tone="primary"
						icon={SyncIcon}
						text={triggering ? 'Starting…' : 'Back up now'}
						onClick={() => void onTrigger()}
						disabled={triggering || loading}
					/>
				</Flex>
			</Stack>
		</Card>
	)
}

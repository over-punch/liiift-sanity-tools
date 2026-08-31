// One repository's backup health, recent runs, and optional trigger button.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Card, Flex, Spinner, Stack, Text, useToast } from '@liiift-studio/sanity-ui-compat'
import { RefreshIcon, SyncIcon } from '@liiift-studio/sanity-ui-compat/icons'
import { assessHealth, DEFAULT_INTERVAL_DAYS } from '../lib/health'
import { fetchRuns, fetchState, triggerBackup } from '../lib/transport'
import { useConfig } from '../config'
import { ConclusionBadge, HealthBadge } from './StatusBadge'
import type { BackupTarget, WorkflowRun } from '../types'

/** How long to wait after a dispatch before looking for the new run. */
const POST_TRIGGER_REFRESH_MS = 4000

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
	// null means not checked or unavailable on this transport, not 'healthy'.
	const [workflowState, setWorkflowState] = useState<string | null>(null)

	// Ignores responses from superseded requests, so a slow earlier load cannot
	// overwrite a newer one. Also gates state updates after unmount.
	const generation = useRef(0)
	const mounted = useRef(true)
	const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
			// Without this, a dispatch's delayed refresh fires against an unmounted
			// card, issuing an orphan request and setting state on a dead component.
			if (refreshTimer.current) clearTimeout(refreshTimer.current)
		}
	}, [])

	// True when no credential is configured yet, which is the state a Studio is in
	// between installing the plugin and someone adding the token.
	const unconfigured =
		(config.mode === 'direct' && !config.token) || (config.mode === 'proxy' && !config.proxyUrl)

	const load = useCallback(async () => {
		if (unconfigured) {
			setLoading(false)
			return
		}
		const ticket = ++generation.current
		setLoading(true)
		setError(null)
		try {
			// State is best-effort: a failure to read it must not blank the run list.
			const [next, state] = await Promise.all([
				fetchRuns(config, target),
				fetchState(config, target).catch(() => null),
			])
			if (!mounted.current || ticket !== generation.current) return
			setRuns(next)
			setWorkflowState(state)
		} catch (err) {
			if (!mounted.current || ticket !== generation.current) return
			// Keep the last known good runs. Discarding them means a transient blip
			// replaces the whole health picture with a bare error.
			setError(err instanceof Error ? err.message : String(err))
		} finally {
			if (mounted.current && ticket === generation.current) setLoading(false)
		}
	}, [config, target, unconfigured])

	useEffect(() => {
		void load()
	}, [load])

	// Poll, so a panel left open does not sit on whatever it knew at mount.
	useEffect(() => {
		if (!config.refreshIntervalMs || unconfigured) return
		const id = setInterval(() => void load(), config.refreshIntervalMs)
		return () => clearInterval(id)
	}, [config.refreshIntervalMs, unconfigured, load])

	const onTrigger = useCallback(async () => {
		setTriggering(true)
		try {
			await triggerBackup(config, target)
			toast.push({ status: 'success', title: `Backup started for ${target.label}` })
			// Stay busy until the refresh lands, otherwise the buttons re-enable while
			// the card still shows pre-trigger data and a second click double-dispatches.
			if (refreshTimer.current) clearTimeout(refreshTimer.current)
			refreshTimer.current = setTimeout(() => {
				void load().finally(() => {
					if (mounted.current) setTriggering(false)
				})
			}, POST_TRIGGER_REFRESH_MS)
		} catch (err) {
			const raw = err instanceof Error ? err.message : String(err)
			toast.push({
				status: 'error',
				title: `Could not start backup for ${target.label}`,
				// Only claim a token-scope problem when talking to GitHub directly; the
				// proxy returns its own 403 when triggering is disabled server-side.
				description:
					config.mode === 'direct' && raw.includes('403')
						? 'The token lacks Actions: write. Triggering needs it; reading run status does not.'
						: raw,
			})
			if (mounted.current) setTriggering(false)
		}
	}, [config, target, toast, load])

	// Sorted for display so the list agrees with the badge, which assesses
	// newest-first. Memoised so it is not redone on every unrelated re-render.
	const ordered = useMemo(
		() =>
			[...(runs ?? [])].sort(
				(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			),
		[runs],
	)

	const health = useMemo(
		() => (runs ? assessHealth(runs, target.expectedIntervalDays ?? DEFAULT_INTERVAL_DAYS) : null),
		[runs, target.expectedIntervalDays],
	)

	// A stale or broken backup gets a coloured card, so it reads at a glance
	// rather than needing to be looked for.
	const tone =
		health?.level === 'critical' ? 'critical' : health?.level === 'warning' ? 'caution' : 'default'

	const headingId = `backup-${target.owner}-${target.repo}-${target.workflow}`

	return (
		<Card padding={4} radius={2} shadow={1} tone={tone} as="section" aria-labelledby={headingId}>
			<Stack space={4}>
				<Flex align="center" gap={3}>
					<Box flex={1}>
						<Stack space={2}>
							<Text as="h3" id={headingId} size={2} weight="semibold">
								{target.label}
							</Text>
							<Text size={1} muted>
								{target.owner}/{target.repo} · {target.workflow}
							</Text>
						</Stack>
					</Box>
					{health ? <HealthBadge health={health} /> : null}
				</Flex>

				{unconfigured ? (
					<Card padding={3} radius={2} tone="caution">
						<Text size={1}>
							{config.mode === 'direct' ? (
								<>
									No GitHub token configured. Pass <code>token</code> to <code>backupMonitor()</code>{' '}
									with a fine-grained token scoped to Actions: read on this repository.
								</>
							) : (
								<>
									No <code>proxyUrl</code> configured. Point <code>backupMonitor()</code> at your
									backup proxy.
								</>
							)}
						</Text>
					</Card>
				) : (
					<Stack space={3}>
						{/* Announced so a screen reader hears the outcome of a refresh. */}
						<div role="status" aria-live="polite">
							{loading ? (
								<Flex align="center" gap={2}>
									<Spinner muted />
									<Text size={1} muted>
										Loading runs…
									</Text>
								</Flex>
							) : health ? (
								<Text size={1}>{health.message}</Text>
							) : null}
						</div>

							{workflowState && workflowState !== 'active' ? (
							<Card padding={3} radius={2} tone="critical" role="alert">
								<Text size={1}>
									<strong>This workflow is disabled ({workflowState}).</strong>{' '}
									{workflowState === 'disabled_inactivity'
										? 'GitHub disables scheduled workflows after 60 days of repository inactivity. Re-enable it in the Actions tab; no backups are running.'
										: 'No backups are running until it is re-enabled in the Actions tab.'}
								</Text>
							</Card>
						) : null}

						{error ? (
							<Card padding={3} radius={2} tone="critical">
								<Text size={1}>
									<strong>Error:</strong> {error}
									{runs ? ' — showing the last successful fetch.' : ''}
								</Text>
							</Card>
						) : null}

						<Stack space={2}>
							{ordered.map(run => (
								<Flex key={run.id} align="center" gap={3}>
									<Box flex={1}>
										<Text size={1} muted>
											{/* Linked so a failed run is one click from its logs. */}
											<a href={run.htmlUrl} target="_blank" rel="noreferrer">
												#{run.runNumber}
											</a>{' '}
											· {run.event} · {formatTime(run.createdAt)}
										</Text>
									</Box>
									<ConclusionBadge conclusion={run.conclusion} />
								</Flex>
							))}
							{runs && ordered.length === 0 ? (
								<Text size={1} muted>
									No runs recorded yet.
								</Text>
							) : null}
						</Stack>
					</Stack>
				)}

				{/* Conditional render rather than the hidden attribute: hidden depends on a
				    :not([hidden]) guard in the UI library and leaves controls in the DOM. */}
				{unconfigured ? null : (
					<Flex gap={2}>
						<Button
							mode="ghost"
							icon={RefreshIcon}
							text="Refresh"
							aria-label={`Refresh ${target.label}`}
							onClick={() => void load()}
							disabled={loading || triggering}
						/>
						{config.allowTrigger ? (
							<Button
								tone="primary"
								icon={SyncIcon}
								text={triggering ? 'Starting…' : 'Back up now'}
								aria-label={`Back up ${target.label} now`}
								onClick={() => void onTrigger()}
								disabled={triggering || loading}
							/>
						) : null}
					</Flex>
				)}
			</Stack>
		</Card>
	)
}

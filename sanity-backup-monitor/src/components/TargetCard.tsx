// One repository's backup health, written for editors, with detail on request.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Card, Flex, Spinner, Stack, Text, useToast } from '@liiift-studio/sanity-ui-compat'
import { ChevronDownIcon, ChevronRightIcon, RefreshIcon, SyncIcon } from '@liiift-studio/sanity-ui-compat/icons'
import { assessHealth, DEFAULT_INTERVAL_DAYS } from '../lib/health'
import { plainEvent, plainOutcome, plainSummary } from '../lib/plainLanguage'
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
 * Leads with a plain-language verdict because the audience is editors, not the
 * person who configured this. Repo paths, workflow filenames and run history are
 * real but secondary, so they sit behind a disclosure.
 *
 * @param props.target - the repository to show
 * @param props.showLabel - render the target's name; redundant when it is the
 *   only card, because the workspace name above it already says the same thing
 */
export function TargetCard(props: { target: BackupTarget; showLabel?: boolean }) {
	const { target, showLabel = true } = props
	const config = useConfig()
	const toast = useToast()

	const [runs, setRuns] = useState<WorkflowRun[] | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)
	const [triggering, setTriggering] = useState(false)
	const [showDetail, setShowDetail] = useState(false)
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
				description:
					config.mode === 'direct' && raw.includes('403')
						? 'The token lacks Actions: write. Triggering needs it; reading run status does not.'
						: raw,
			})
			if (mounted.current) setTriggering(false)
		}
	}, [config, target, toast, load])

	const ordered = useMemo(
		() =>
			[...(runs ?? [])].sort(
				(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			),
		[runs],
	)

	const intervalDays = target.expectedIntervalDays ?? DEFAULT_INTERVAL_DAYS

	const health = useMemo(
		() => (runs ? assessHealth(runs, intervalDays) : null),
		[runs, intervalDays],
	)

	const summary = useMemo(
		() => (health ? plainSummary(health, intervalDays, workflowState) : null),
		[health, intervalDays, workflowState],
	)

	// A stale or broken backup gets a coloured card, so it reads at a glance.
	// A disabled workflow is always critical regardless of run history.
	const disabled = Boolean(workflowState && workflowState !== 'active')
	const tone = disabled
		? 'critical'
		: health?.level === 'critical'
			? 'critical'
			: health?.level === 'warning'
				? 'caution'
				: 'default'

	const headingId = `backup-${target.owner}-${target.repo}-${target.workflow}`

	return (
		<Card padding={4} radius={2} shadow={1} tone={tone} as="section" aria-labelledby={headingId}>
			<Stack space={4}>
				{showLabel ? (
					<Flex align="center" gap={3}>
						<Box flex={1}>
							<Text as="h3" id={headingId} size={2} weight="semibold">
								{target.label}
							</Text>
						</Box>
						{health ? <HealthBadge health={health} /> : null}
					</Flex>
				) : (
					// Keeps an accessible name for the section without showing it twice.
					<span id={headingId} hidden>
						{target.label}
					</span>
				)}

				{unconfigured ? (
					<Card padding={3} radius={2} tone="caution">
						<Text size={1}>
							Backup checking is not set up yet for this content. Whoever looks after the site
							needs to finish configuring it.
						</Text>
					</Card>
				) : (
					<Stack space={3}>
						{/* Announced so a screen reader hears the outcome of a refresh. */}
						<div role="status" aria-live="polite">
							{loading && !summary ? (
								<Flex align="center" gap={2}>
									<Spinner muted />
									<Text size={1} muted>
										Checking…
									</Text>
								</Flex>
							) : summary ? (
								<Stack space={2}>
									<Flex align="center" gap={3}>
										<Box flex={1}>
											<Text size={2} weight="semibold">
												{summary.headline}
											</Text>
										</Box>
										{!showLabel && health ? <HealthBadge health={health} /> : null}
									</Flex>
									<Text size={1} muted>
										{summary.detail}
									</Text>
								</Stack>
							) : null}
						</div>

						{summary?.action ? (
							<Card padding={3} radius={2} tone="caution">
								<Text size={1}>{summary.action}</Text>
							</Card>
						) : null}

						{error ? (
							<Card padding={3} radius={2} tone="critical">
								<Text size={1}>
									Could not check the backup status just now
									{runs ? ' — showing the last result we have.' : '.'}
								</Text>
							</Card>
						) : null}
					</Stack>
				)}

				{unconfigured ? null : (
					<Stack space={3}>
						<Flex gap={2} align="center">
							<Button
								mode="bleed"
								icon={showDetail ? ChevronDownIcon : ChevronRightIcon}
								text={showDetail ? 'Hide technical details' : 'Show technical details'}
								aria-expanded={showDetail}
								onClick={() => setShowDetail(v => !v)}
							/>
						</Flex>

						{showDetail ? (
							<Stack space={3}>
								<Text size={1} muted>
									{target.owner}/{target.repo} · {target.workflow}
									{workflowState ? ` · workflow ${workflowState}` : ''}
								</Text>

								{error ? (
									<Text size={1} muted>
										{error}
									</Text>
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
													· {plainEvent(run.event)} · {formatTime(run.createdAt)}
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

								<Flex gap={2}>
									<Button
										mode="ghost"
										icon={RefreshIcon}
										text="Check again"
										aria-label={`Check ${target.label} again`}
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
							</Stack>
						) : null}
					</Stack>
				)}
			</Stack>
		</Card>
	)
}

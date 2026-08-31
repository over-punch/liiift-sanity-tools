// Chooses between calling GitHub directly and going through the backup proxy.

import { dispatchWorkflow, fetchWorkflowState, listRuns, toWorkflowRun } from './github'
import type { BackupTarget, ResolvedConfig, WorkflowRun } from '../types'

/** Read a JSON response from the proxy, turning a failure into a useful message. */
async function proxyFetch<T>(url: string, statusKey: string | undefined, init?: RequestInit): Promise<T> {
	const res = await fetch(url, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...(statusKey ? { 'x-backup-status-key': statusKey } : {}),
			...init?.headers,
		},
	})
	if (!res.ok) {
		const hint =
			res.status === 401 ? ' — the proxy rejected the status key. Check `statusKey` matches the proxy.' :
			res.status === 404 ? ' — the proxy has no target with that key. Check `proxyKey` matches the proxy configuration.' :
			res.status >= 500  ? ' — the backup proxy is failing. Check its logs.' :
			''
		throw new Error(`Backup proxy ${res.status}${hint}`)
	}
	if (res.status === 204) return undefined as T
	return res.json() as Promise<T>
}

/** Fetch recent runs for a target over whichever transport is configured. */
export async function fetchRuns(config: ResolvedConfig, target: BackupTarget): Promise<WorkflowRun[]> {
	if (config.mode === 'direct') {
		if (!config.token) throw new Error('Direct mode requires a GitHub token')
		return listRuns({
			owner: target.owner,
			repo: target.repo,
			workflow: target.workflow,
			token: config.token,
			limit: config.runLimit,
		})
	}
	if (!config.proxyUrl) throw new Error('Proxy mode requires proxyUrl')
	const params = new URLSearchParams({ key: target.proxyKey ?? target.label })
	params.set('limit', String(config.runLimit))
	const data = await proxyFetch<{ runs?: unknown[] }>(
		`${config.proxyUrl}/runs?${params}`,
		config.statusKey,
	)
	// The proxy returns GitHub's raw shape so normalisation stays in one place.
	return (data.runs ?? []).map(r => toWorkflowRun(r as Parameters<typeof toWorkflowRun>[0]))
}

/** Trigger a backup for a target over whichever transport is configured. */
export async function triggerBackup(config: ResolvedConfig, target: BackupTarget): Promise<void> {
	if (config.mode === 'direct') {
		if (!config.token) throw new Error('Direct mode requires a GitHub token')
		return dispatchWorkflow({
			owner: target.owner,
			repo: target.repo,
			workflow: target.workflow,
			token: config.token,
			ref: target.ref,
		})
	}
	if (!config.proxyUrl) throw new Error('Proxy mode requires proxyUrl')
	await proxyFetch<void>(`${config.proxyUrl}/trigger`, config.statusKey, {
		method: 'POST',
		body: JSON.stringify({ key: target.proxyKey ?? target.label }),
	})
}

/**
 * Fetch a workflow's state, when the transport can.
 *
 * Only available in direct mode: the proxy exposes no equivalent endpoint, and
 * returning null there means the panel simply omits the check rather than
 * showing a false alarm.
 *
 * @param config - resolved plugin config
 * @param target - the target to inspect
 * @returns the state string, or null when unavailable
 */
export async function fetchState(config: ResolvedConfig, target: BackupTarget): Promise<string | null> {
	if (config.mode !== 'direct' || !config.token) return null
	return fetchWorkflowState({
		owner: target.owner,
		repo: target.repo,
		workflow: target.workflow,
		token: config.token,
	})
}

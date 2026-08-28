// Thin wrapper over the GitHub Actions REST API, for direct mode.

import type { RunConclusion, WorkflowRun } from '../types'

const GITHUB_API = 'https://api.github.com'

/** Normalise GitHub's status/conclusion pair into a single value the panel uses. */
export function normaliseConclusion(status: string, conclusion: string | null): RunConclusion {
	if (status !== 'completed') return 'in_progress'
	switch (conclusion) {
		case 'success':
		case 'failure':
		case 'cancelled':
		case 'timed_out':
		case 'skipped':
			return conclusion
		default:
			return 'unknown'
	}
}

/** Shape of the run objects GitHub returns, narrowed to what is used here. */
interface RawRun {
	id: number
	run_number: number
	status: string
	conclusion: string | null
	created_at: string
	updated_at: string
	html_url: string
	event: string
}

/** Convert a GitHub run payload into the panel's shape. */
export function toWorkflowRun(raw: RawRun): WorkflowRun {
	return {
		id: raw.id,
		runNumber: raw.run_number,
		status: raw.status,
		conclusion: normaliseConclusion(raw.status, raw.conclusion),
		createdAt: raw.created_at,
		updatedAt: raw.updated_at,
		htmlUrl: raw.html_url,
		event: raw.event,
	}
}

/** Issue a GitHub API request, turning failures into messages worth reading. */
async function gh<T>(path: string, token: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${GITHUB_API}${path}`, {
		...init,
		headers: {
			Accept: 'application/vnd.github+json',
			Authorization: `Bearer ${token}`,
			'X-GitHub-Api-Version': '2022-11-28',
			...init?.headers,
		},
	})
	if (!res.ok) {
		const hint =
			res.status === 401 ? ' — the GitHub token is invalid or expired.' :
			res.status === 403 ? ' — the token lacks Actions permission on this repository.' :
			res.status === 404 ? ' — repository or workflow not found. Check owner, repo and workflow filename.' :
			''
		throw new Error(`GitHub ${res.status}${hint}`)
	}
	// 204 No Content is the success case for workflow dispatch.
	if (res.status === 204) return undefined as T
	return res.json() as Promise<T>
}

/**
 * List recent runs of one workflow.
 *
 * @param params.owner - GitHub owner
 * @param params.repo - repository name
 * @param params.workflow - workflow filename
 * @param params.token - GitHub token with Actions read access
 * @param params.limit - how many runs to return
 */
export async function listRuns(params: {
	owner: string
	repo: string
	workflow: string
	token: string
	limit?: number
}): Promise<WorkflowRun[]> {
	const { owner, repo, workflow, token, limit = 5 } = params
	const data = await gh<{ workflow_runs?: RawRun[] }>(
		`/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs?per_page=${limit}`,
		token,
	)
	return (data.workflow_runs ?? []).map(toWorkflowRun)
}

/**
 * Trigger a workflow_dispatch run.
 *
 * @param params.ref - branch to dispatch on; scheduled workflows only run from
 *   the default branch, and dispatch is subject to the same rule.
 */
export async function dispatchWorkflow(params: {
	owner: string
	repo: string
	workflow: string
	token: string
	ref?: string
	inputs?: Record<string, string>
}): Promise<void> {
	const { owner, repo, workflow, token, ref = 'main', inputs } = params
	await gh<void>(
		`/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
		token,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ref, ...(inputs ? { inputs } : {}) }),
		},
	)
}

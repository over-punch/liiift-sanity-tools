// Shared types for the backup monitor plugin.

import type { ComponentType } from 'react'

/** How the Studio reaches the GitHub API. */
export type BackupMonitorMode = 'direct' | 'proxy'

/** One repository whose backup workflow is being watched. */
export interface BackupTarget {
	/** Human label shown in the panel, e.g. "MCKL". */
	label: string
	/** GitHub owner, e.g. "Liiift-Studio". */
	owner: string
	/** Repository name, e.g. "mckl-cms". */
	repo: string
	/** Workflow filename, e.g. "backup-routine.yml". */
	workflow: string
	/** Branch the workflow is dispatched on. Defaults to "main". */
	ref?: string
	/**
	 * How often the backup is expected to run, in days. Drives the staleness
	 * warning, which is the whole point of the panel. Defaults to 7.
	 */
	expectedIntervalDays?: number
	/** Opaque key identifying this target to the proxy, in proxy mode. */
	proxyKey?: string
}

/** Plugin options, as passed to `backupMonitor()`. */
export interface BackupMonitorConfig {
	/** Tool name in the Studio. Defaults to "backup-monitor". */
	name?: string
	/** Tool title. Defaults to "Backups". */
	title?: string
	/** Tool icon. */
	icon?: ComponentType
	/** Repositories to watch. */
	targets?: BackupTarget[]
	/**
	 * 'proxy' keeps the GitHub token on a server you control. 'direct' puts it in
	 * the Studio bundle, where anyone who can read the dataset can read it.
	 * Defaults to 'proxy' when proxyUrl is set, otherwise 'direct'.
	 */
	mode?: BackupMonitorMode
	/** Base URL of the backup proxy, in proxy mode. */
	proxyUrl?: string
	/** Shared key the proxy checks on status reads, in proxy mode. */
	statusKey?: string
	/** GitHub token, in direct mode only. See the README for why to avoid this. */
	token?: string
	/** Number of runs to list per target. Defaults to 5. */
	runLimit?: number
	/**
	 * Show the "Back up now" button. Defaults to **false**.
	 *
	 * Triggering needs `Actions: write`, a meaningfully larger grant than the
	 * `Actions: read` a status panel needs - a write token extracted from the
	 * bundle can dispatch workflows. Left off, the panel is read-only and the
	 * button is hidden rather than shown and failing with a 403.
	 */
	allowTrigger?: boolean
}

/** Resolved config with defaults applied. */
export interface ResolvedConfig extends BackupMonitorConfig {
	mode: BackupMonitorMode
	targets: BackupTarget[]
	runLimit: number
	allowTrigger: boolean
}

/** GitHub Actions run conclusion, as the panel cares about it. */
export type RunConclusion =
	| 'success'
	| 'neutral'
	| 'failure'
	| 'timed_out'
	| 'startup_failure'
	| 'stale'
	| 'cancelled'
	| 'skipped'
	| 'action_required'
	| 'in_progress'
	| 'unknown'

/** One workflow run, normalised from the GitHub API. */
export interface WorkflowRun {
	id: number
	runNumber: number
	status: string
	conclusion: RunConclusion
	createdAt: string
	updatedAt: string
	htmlUrl: string
	event: string
}

/** How healthy a target's backup is. */
export type HealthLevel = 'ok' | 'warning' | 'critical' | 'unknown'

/**
 * Why an assessment reached its level. Distinguishes a backup that is late from
 * one that is running and breaking - the panel exists to tell those apart.
 */
export type HealthReason = 'ok' | 'stale' | 'failing' | 'no-runs' | 'undetermined'

/** Result of evaluating a target's run history. */
export interface HealthAssessment {
	level: HealthLevel
	/** Why it reached that level. */
	reason: HealthReason
	/** Hours since the last successful run, or null if there has never been one. */
	hoursSinceSuccess: number | null
	/** Short human sentence for the panel. */
	message: string
	/** Consecutive failures at the head of the run list. */
	consecutiveFailures: number
}

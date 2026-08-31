// Resolves plugin options and shares them with the tool tree without prop drilling.

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { BackupMonitorConfig, ResolvedConfig } from './types'

/** Runs listed per target when not configured. */
const DEFAULT_RUN_LIMIT = 5

/**
 * Apply defaults to plugin options.
 *
 * Mode defaults to 'proxy' whenever a proxyUrl is supplied, because a Sanity
 * dataset has no per-document ACL: a token stored in the dataset is readable by
 * everyone who can read it, and on a public dataset that means anyone.
 *
 * @param options - raw plugin options
 * @returns options with defaults applied
 */
export function resolveConfig(options?: BackupMonitorConfig | void): ResolvedConfig {
	const config = options ?? {}
	return {
		...config,
		mode: config.mode ?? (config.proxyUrl ? 'proxy' : 'direct'),
		targets: config.targets ?? [],
		runLimit: config.runLimit ?? DEFAULT_RUN_LIMIT,
		// Off by default: triggering needs Actions:write, a status panel does not.
		allowTrigger: config.allowTrigger ?? false,
	}
}

const ConfigContext = createContext<ResolvedConfig | null>(null)

/** Provide resolved config to the tool tree. */
export function ConfigProvider(props: { value: ResolvedConfig; children: ReactNode }) {
	return <ConfigContext.Provider value={props.value}>{props.children}</ConfigContext.Provider>
}

/** Read the resolved config. Throws if used outside the provider. */
export function useConfig(): ResolvedConfig {
	const ctx = useContext(ConfigContext)
	if (!ctx) throw new Error('useConfig must be used inside ConfigProvider')
	return ctx
}

// Determinate progress bar — owned outright, because @sanity/ui has never exported one
import { UI, resolveComponent } from './resolve'

/** Props for the compat Progress bar. */
export type ProgressProps = {
	/** Current value on the `min`..`max` scale. Clamped, so a caller cannot overflow the track. */
	value?: number
	/** Lower bound of the scale. Defaults to 0. */
	min?: number
	/** Upper bound of the scale. Defaults to 100. */
	max?: number
	/** Accessible name. Falls back to a generic label so the bar is never unnamed. */
	label?: string
	style?: React.CSSProperties
	className?: string
}

/*
 * Resolved defensively rather than assumed absent. `Progress` is not exported by
 * @sanity/ui 2.8.9, 3.1.14 or 4.0.5 — it has never existed on any major this
 * package supports, which is why two plugins importing it have been carrying a
 * latent crash. But Sanity could add one, and if they do the host's version
 * should win over ours.
 */
const InstalledProgress = resolveComponent<ProgressProps>(UI, 'Progress')

/** Track height in px. Matches the visual weight of Sanity's own thin dividers. */
const TRACK_HEIGHT = 6

/**
 * Determinate progress bar.
 *
 * Colours come from Sanity's CSS custom properties with literal fallbacks, so the
 * bar follows the Studio theme (including dark mode) where those properties are
 * defined and still renders visibly where they are not — the fallbacks are what
 * make this safe outside a ThemeProvider.
 *
 * @param value Current progress. Values outside `min`..`max` are clamped rather
 *              than allowed to overflow the track.
 */
export function Progress({
	value = 0,
	min = 0,
	max = 100,
	label = 'Progress',
	style,
	className,
}: ProgressProps): React.JSX.Element {
	if (InstalledProgress) {
		return <InstalledProgress value={value} min={min} max={max} label={label} style={style} className={className} />
	}

	// A zero or inverted span would make the percentage NaN or Infinity.
	const span = max - min
	const ratio = span > 0 ? (value - min) / span : 0
	const clamped = Math.min(1, Math.max(0, ratio))

	return (
		<div
			role="progressbar"
			aria-valuenow={value}
			aria-valuemin={min}
			aria-valuemax={max}
			aria-label={label}
			className={className}
			style={{
				width: '100%',
				height: TRACK_HEIGHT,
				borderRadius: TRACK_HEIGHT / 2,
				overflow: 'hidden',
				background: 'var(--card-border-color, rgba(128,128,128,0.25))',
				...style,
			}}
		>
			<div
				style={{
					width: `${clamped * 100}%`,
					height: '100%',
					background: 'var(--card-link-fg-color, currentColor)',
					transition: 'width 150ms ease-out',
				}}
			/>
		</div>
	)
}

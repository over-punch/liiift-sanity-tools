// Autocomplete — Studio's combobox where available, a knowingly reduced input elsewhere
import { useId } from 'react'
import type { ReactNode } from 'react'
import { UI, resolveComponent } from './resolve'
import { TextInput } from './primitives'

/** One option in the list. `value` is what the field stores. */
export type AutocompleteOption = { value: string; [key: string]: unknown }

/** Props for the compat Autocomplete — the subset the plugin suite passes. */
export type AutocompleteProps = {
	id: string
	options?: AutocompleteOption[]
	value?: string
	placeholder?: string
	onChange?: (value: string) => void
	onSelect?: (value: string) => void
	/** v2/v3 only. See the note below on why this is not honoured by the fallback. */
	renderOption?: (option: AutocompleteOption) => ReactNode
	filterOption?: (query: string, option: AutocompleteOption) => boolean
	style?: React.CSSProperties
	className?: string
	disabled?: boolean
}

const InstalledAutocomplete = resolveComponent<AutocompleteProps>(UI, 'Autocomplete')

/**
 * Autocomplete.
 *
 * On @sanity/ui v2 and v3 this is Studio's own component, unchanged.
 *
 * On v4 it is NOT. `Autocomplete` moved to the `@sanity/ui/autocomplete` subpath,
 * which cannot be imported statically across the supported range, so the fallback
 * here is a text input backed by a native `<datalist>`.
 *
 * That degradation is deliberate and it is not equivalent. A correct combobox
 * (ARIA 1.2 listbox popup, aria-activedescendant, managed focus) is a substantial
 * piece of work, and a half-correct one is worse for keyboard and screen-reader
 * users than an honest plain input. What is lost on v4:
 *
 *   - `renderOption` is ignored — datalist options cannot carry custom markup.
 *     Any plugin relying on rich option rendering will look plainer, not broken.
 *   - `filterOption` is ignored — the browser does its own substring matching.
 *   - Selection fires through `onChange`; `onSelect` is called on an exact match
 *     against a known option value.
 *
 * Before shipping any plugin that renders this on a v4 Studio, check whether it
 * actually needs the combobox behaviour. If it does, that plugin should get a real
 * implementation rather than inherit this.
 */
export function Autocomplete(props: AutocompleteProps): React.JSX.Element {
	const listId = useId()

	if (InstalledAutocomplete) return <InstalledAutocomplete {...props} />

	const { id, options = [], value, placeholder, onChange, onSelect, style, className, disabled } = props

	return (
		<>
			<TextInput
				id={id}
				list={listId}
				value={value}
				placeholder={placeholder}
				style={style}
				className={className}
				disabled={disabled}
				onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
					const next = e.currentTarget.value
					onChange?.(next)
					// Native datalist gives no distinct "picked from list" event, so an exact
					// match against a known option is the only signal available.
					if (onSelect && options.some(o => o.value === next)) onSelect(next)
				}}
			/>
			<datalist id={listId}>
				{options.map(o => <option key={o.value} value={o.value} />)}
			</datalist>
		</>
	)
}

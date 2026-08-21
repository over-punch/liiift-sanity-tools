// Version-agnostic access to @sanity/icons — named exports on v2/v3/v4, <Icon symbol> on v5+
import { forwardRef } from 'react'
import type { ComponentType, SVGProps } from 'react'
import { ICONS, resolveComponent, resolveRecord } from './resolve'

/** Props every Sanity icon accepts — it renders a plain sized SVG. */
export type IconProps = SVGProps<SVGSVGElement>

/** An icon component, whichever shape the installed @sanity/icons exposes it in. */
export type IconComponent = ComponentType<IconProps>

/** Sizing of a Sanity icon glyph — 1em square on a 25-unit viewBox, matching @sanity/icons. */
const GLYPH = { width: '1em', height: '1em', viewBox: '0 0 25 25', fill: 'none' } as const

/**
 * Placeholder for when the installed @sanity/icons exposes neither shape. Holds
 * layout, draws nothing, and is hidden from assistive tech since every icon in
 * this plugin is decorative.
 */
const MissingIcon = forwardRef<SVGSVGElement, IconProps>(function MissingIcon(props, ref) {
	return <svg {...GLYPH} xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" {...props} ref={ref} />
})

/** The v5+ `<Icon>` component, absent on icons v2, v3 and v4. */
type SymbolIcon = ComponentType<IconProps & { symbol: string }>

/**
 * The symbol map v5+ exposes alongside `Icon`. Used to check a symbol exists
 * before relying on it: `<Icon>` renders `null` for an unrecognised symbol, so
 * a renamed glyph would otherwise vanish silently rather than reaching
 * {@link MissingIcon}.
 */
const SYMBOL_MAP = resolveRecord(ICONS, 'icons')

/**
 * Resolve one glyph against whichever @sanity/icons the host Studio installed.
 * Always reads from the host package, so new and revised artwork is picked up on
 * the consumer's next @sanity/icons update without a release here.
 *
 * Note the named exports are not merely absent on v5 — they are declared `never`
 * with a deprecation note pointing at per-icon subpaths, so a static named import
 * is a type error as well as a runtime one. Subpaths only exist from v4.1.0,
 * which is why this resolves at runtime instead.
 *
 * @param name   Named export used by icons v2, v3 and v4, e.g. `RocketIcon`.
 * @param symbol Kebab-case symbol used by the v5+ `<Icon>` component, e.g. `rocket`.
 */
function resolveIcon(name: string, symbol: string): IconComponent {
	const named = resolveComponent<IconProps>(ICONS, name)
	if (named) return named

	const Icon = resolveComponent<IconProps & { symbol: string }>(ICONS, 'Icon')
	if (!Icon) return MissingIcon
	// An unknown symbol would render nothing at all; fall back to the sized placeholder instead.
	if (SYMBOL_MAP && !(symbol in SYMBOL_MAP)) return MissingIcon

	const Resolved = forwardRef<SVGSVGElement, IconProps>(function SanityIcon(props, ref) {
		return <Icon symbol={symbol} {...props} ref={ref} />
	})
	Resolved.displayName = name
	return Resolved
}

/*
 * Every glyph used anywhere in the in-house plugin suite, resolved by explicit
 * (namedExport, symbol) pair rather than derived by kebab-casing the name.
 *
 * Auto-derivation was measured against the 236-key symbol map in @sanity/icons
 * 5.2.1: it resolves 42 of these 43 correctly, and the single miss is exactly the
 * one worth catching — see DuplicateIcon below. An explicit table turns that class
 * of miss into a visible line in a diff instead of a blank space in a toolbar.
 */
export const AccessDeniedIcon = resolveIcon('AccessDeniedIcon', 'access-denied')
export const AddIcon = resolveIcon('AddIcon', 'add')
export const ArrowDownIcon = resolveIcon('ArrowDownIcon', 'arrow-down')
export const ArrowUpIcon = resolveIcon('ArrowUpIcon', 'arrow-up')
export const CheckmarkCircleIcon = resolveIcon('CheckmarkCircleIcon', 'checkmark-circle')
export const CheckmarkIcon = resolveIcon('CheckmarkIcon', 'checkmark')
export const ChevronDownIcon = resolveIcon('ChevronDownIcon', 'chevron-down')
export const ChevronRightIcon = resolveIcon('ChevronRightIcon', 'chevron-right')
export const ChevronUpIcon = resolveIcon('ChevronUpIcon', 'chevron-up')
export const ClipboardIcon = resolveIcon('ClipboardIcon', 'clipboard')
export const ClockIcon = resolveIcon('ClockIcon', 'clock')
export const CogIcon = resolveIcon('CogIcon', 'cog')
export const CloseCircleIcon = resolveIcon('CloseCircleIcon', 'close-circle')
export const CloseIcon = resolveIcon('CloseIcon', 'close')
export const CollapseIcon = resolveIcon('CollapseIcon', 'collapse')
export const ControlsIcon = resolveIcon('ControlsIcon', 'controls')
export const CopyIcon = resolveIcon('CopyIcon', 'copy')
export const DashboardIcon = resolveIcon('DashboardIcon', 'dashboard')
export const DocumentIcon = resolveIcon('DocumentIcon', 'document')
export const DocumentTextIcon = resolveIcon('DocumentTextIcon', 'document-text')
export const DocumentsIcon = resolveIcon('DocumentsIcon', 'documents')
export const DownloadIcon = resolveIcon('DownloadIcon', 'download')

/**
 * NOT a kebab-case derivation, deliberately.
 *
 * `DuplicateIcon` has never existed in @sanity/icons — it is absent from v3.8.0's
 * named exports and there is no `duplicate` key in v5.2.1's symbol map. The import
 * in sanity-duplicate-and-rename has therefore always resolved to nothing, and the
 * button has been rendering a blank. Mapped to `copy` as the closest real glyph,
 * chosen over `documents` and `stack`, which read as "several documents" rather
 * than the duplicate action itself.
 */
export const DuplicateIcon = resolveIcon('DuplicateIcon', 'copy')

export const EditIcon = resolveIcon('EditIcon', 'edit')
export const EllipsisHorizontalIcon = resolveIcon('EllipsisHorizontalIcon', 'ellipsis-horizontal')
export const EllipsisVerticalIcon = resolveIcon('EllipsisVerticalIcon', 'ellipsis-vertical')
export const ExpandIcon = resolveIcon('ExpandIcon', 'expand')
export const HomeIcon = resolveIcon('HomeIcon', 'home')
export const ImageIcon = resolveIcon('ImageIcon', 'image')
export const InfoOutlineIcon = resolveIcon('InfoOutlineIcon', 'info-outline')
export const LaunchIcon = resolveIcon('LaunchIcon', 'launch')
export const LinkRemovedIcon = resolveIcon('LinkRemovedIcon', 'link-removed')
export const LockIcon = resolveIcon('LockIcon', 'lock')
export const RefreshIcon = resolveIcon('RefreshIcon', 'refresh')
export const ResetIcon = resolveIcon('ResetIcon', 'reset')
export const RocketIcon = resolveIcon('RocketIcon', 'rocket')
export const SearchIcon = resolveIcon('SearchIcon', 'search')
export const SortIcon = resolveIcon('SortIcon', 'sort')
export const SparkleIcon = resolveIcon('SparkleIcon', 'sparkle')
export const SparklesIcon = resolveIcon('SparklesIcon', 'sparkles')
export const StackIcon = resolveIcon('StackIcon', 'stack')
export const StackCompactIcon = resolveIcon('StackCompactIcon', 'stack-compact')
export const StringIcon = resolveIcon('StringIcon', 'string')
export const SyncIcon = resolveIcon('SyncIcon', 'sync')
export const TagIcon = resolveIcon('TagIcon', 'tag')
export const TokenIcon = resolveIcon('TokenIcon', 'token')
export const TransferIcon = resolveIcon('TransferIcon', 'transfer')
export const TrashIcon = resolveIcon('TrashIcon', 'trash')
export const UnlockIcon = resolveIcon('UnlockIcon', 'unlock')
export const UploadIcon = resolveIcon('UploadIcon', 'upload')
export const UsersIcon = resolveIcon('UsersIcon', 'users')
export const WarningOutlineIcon = resolveIcon('WarningOutlineIcon', 'warning-outline')

/**
 * Escape hatch for a glyph not in the table above. Resolves the same way, so a
 * plugin needing a one-off icon does not have to fork this package.
 *
 * @param name   Named export used by icons v2, v3 and v4, e.g. `RocketIcon`.
 * @param symbol Kebab-case symbol used by the v5+ `<Icon>` component, e.g. `rocket`.
 */
export { resolveIcon }

// Single entry point for every @sanity/ui value the plugin suite uses, resolved against the installed major
export {
	Box, Card, Flex, Text, Heading, Label, Spinner, Button, TextInput,
	Select, Switch, Dialog, Checkbox, Radio, TextArea, Container,
	Stack, Inline, Grid, Badge,
} from './primitives'
export type { StackProps, InlineProps, GridProps, BadgeProps } from './primitives'

export { useToast, ToastViewport } from './toast'
export type { ToastParams, Toaster } from './toast'

export { Tooltip } from './tooltip'
export type { TooltipProps, TooltipPlacement } from './tooltip'

export { usePrefersDark } from './hooks'

export { ActionMenu, Menu, MenuButton, MenuItem } from './menu'
export type {
	ActionMenuProps, MenuAction,
	CompatMenuProps, CompatMenuButtonProps, CompatMenuItemProps,
} from './menu'

export { Code } from './code'
export type { CodeProps } from './code'

export { Progress } from './progress'
export type { ProgressProps } from './progress'

export { Autocomplete } from './autocomplete'
export type { AutocompleteProps, AutocompleteOption } from './autocomplete'

/*
 * Escape hatches. A plugin needing an export outside the curated surface above
 * should reach for these rather than fork the package or import @sanity/ui
 * directly — a direct named import is exactly what breaks on v4.
 */
export { UI, ICONS, resolveComponent, resolveFunction, resolveRecord, STACK_USES_GAP } from './resolve'

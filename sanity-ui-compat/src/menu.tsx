// Overflow menu — Studio's MenuButton where available, a WAI-ARIA menu button implementation otherwise
import { cloneElement, isValidElement, useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ComponentType, ReactNode, SVGProps } from 'react'
import { UI, resolveComponent } from './resolve'
import { Button, Card, Flex, Stack, Text } from './primitives'

/** An icon component, matching what this plugin's icon shim produces. */
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

/** One entry in an ActionMenu. Exactly one of `onClick` or `href` drives the behaviour. */
export type MenuAction =
	| { key?: string; text: string; icon: IconComponent; tone?: 'critical'; onClick: () => void; href?: never }
	| { key?: string; text: string; icon: IconComponent; tone?: 'critical'; href: string; onClick?: never }

/** Props for the compat ActionMenu — a declarative item list rather than nested JSX. */
export type ActionMenuProps = {
	/** Stable DOM id for the trigger. */
	id: string
	/** Accessible name for the trigger, which is icon-only. */
	label: string
	items: MenuAction[]
	buttonIcon: IconComponent
}

/*
 * Prop shapes for the installed menu trio, declared locally rather than taken from
 * `typeof SanityUi.MenuButton`: on @sanity/ui v4 those are tombstoned as `never`,
 * which would make this branch a build error even though it never runs there.
 * Declaring them keeps the branch that DOES run on v2/v3 type-checked — an
 * index-signature bag would accept any prop, on the only path most Studios take.
 */

/** Subset of @sanity/ui's MenuButtonProps this plugin passes. */
type InstalledMenuButtonProps = {
	id: string
	button: React.JSX.Element
	menu: React.JSX.Element
	popover?: { placement?: string }
}

/** Subset of @sanity/ui's MenuProps this plugin passes. */
type InstalledMenuProps = { children?: ReactNode }

/** Subset of @sanity/ui's MenuItemProps this plugin passes, including the anchor form. */
type InstalledMenuItemProps = {
	text: string
	icon: IconComponent
	tone?: 'critical'
	onClick?: () => void
	as?: 'a'
	href?: string
	target?: string
	rel?: string
	/** Present on @sanity/ui v2/v3. Must be forwarded — see the note on MenuItem. */
	disabled?: boolean
}

const InstalledMenuButton = resolveComponent<InstalledMenuButtonProps>(UI, 'MenuButton')
const InstalledMenu = resolveComponent<InstalledMenuProps>(UI, 'Menu')
const InstalledMenuItem = resolveComponent<InstalledMenuItemProps>(UI, 'MenuItem')

/** Whether the installed @sanity/ui still exports the full menu trio. */
const INSTALLED_MENU = InstalledMenuButton && InstalledMenu && InstalledMenuItem
	? { MenuButton: InstalledMenuButton, Menu: InstalledMenu, MenuItem: InstalledMenuItem }
	: null

/** Stable identity for an item, used for React keys and focus tracking. Labels can repeat; keys should not. */
const itemKey = (item: MenuAction, index: number): string => item.key ?? `${index}-${item.text}`

/**
 * Overflow menu. Uses Studio's MenuButton where available and otherwise implements
 * the WAI-ARIA menu button pattern locally: focus moves into the menu on open,
 * Arrow/Home/End move between items with a roving tabindex, Escape and Tab close
 * and return focus to the trigger.
 *
 * The item list is snapshotted while the menu is open, so background polling
 * cannot insert or remove rows under the pointer.
 */
export function ActionMenu({ id, label, items, buttonIcon }: ActionMenuProps): React.JSX.Element {
	const menuId = useId()
	const [open, setOpen] = useState(false)
	const [activeIndex, setActiveIndex] = useState(0)
	const wrapRef = useRef<HTMLDivElement>(null)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const itemRefs = useRef<(HTMLElement | null)[]>([])

	// Snapshot taken at open time — the live `items` array is rebuilt on every poll.
	const [frozenItems, setFrozenItems] = useState<MenuAction[]>(items)
	const shownItems = open ? frozenItems : items

	/** Close the menu and hand focus back to the trigger, as the menu button pattern requires. */
	const close = useCallback((returnFocus = true) => {
		setOpen(false)
		if (returnFocus) triggerRef.current?.focus()
	}, [])

	const openMenu = useCallback((index: number) => {
		setFrozenItems(items)
		setActiveIndex(index)
		setOpen(true)
	}, [items])

	// Move DOM focus to follow the active item while the menu is open.
	useEffect(() => {
		if (!open || INSTALLED_MENU) return
		itemRefs.current[activeIndex]?.focus()
	}, [open, activeIndex])

	// Fallback only — dismiss on outside pointer down. Escape and Tab are handled on the menu itself
	// so they do not swallow keys belonging to any dialog the tool has open.
	useEffect(() => {
		if (INSTALLED_MENU || !open) return
		const onPointerDown = (e: MouseEvent) => {
			if (wrapRef.current?.contains(e.target as Node)) return
			// Only reclaim focus if it was inside the menu; otherwise the element the
			// user just clicked should keep it.
			const hadFocus = wrapRef.current?.contains(document.activeElement)
			setOpen(false)
			if (hadFocus) triggerRef.current?.focus()
		}
		document.addEventListener('mousedown', onPointerDown)
		return () => document.removeEventListener('mousedown', onPointerDown)
	}, [open])

	const runAction = useCallback((item: MenuAction) => {
		close()
		item.onClick?.()
	}, [close])

	if (INSTALLED_MENU) {
		const { MenuButton, Menu, MenuItem } = INSTALLED_MENU
		return (
			<MenuButton
				id={id}
				button={<Button mode="ghost" icon={buttonIcon} padding={2} aria-label={label} />}
				popover={{ placement: 'bottom-end' }}
				menu={
					<Menu>
						{items.map((item, i) => (
							<MenuItem
								key={itemKey(item, i)}
								text={item.text}
								icon={item.icon}
								tone={item.tone}
								{...(item.href
									? { as: 'a', href: item.href, target: '_blank', rel: 'noreferrer' }
									: { onClick: item.onClick })}
							/>
						))}
					</Menu>
				}
			/>
		)
	}

	/** Arrow/Home/End/Escape/Tab handling for the open menu, per the WAI-ARIA menu button pattern. */
	const onMenuKeyDown = (e: React.KeyboardEvent) => {
		const last = shownItems.length - 1
		if (e.key === 'Escape') { e.stopPropagation(); close(); return }
		if (e.key === 'Tab') {
			// Move focus to the trigger synchronously, then let the browser perform the
			// default traversal from there. Closing first would unmount the focused item
			// and drop focus to <body>, restarting tab order at the top of the Studio.
			triggerRef.current?.focus()
			setOpen(false)
			return
		}
		if (e.key === 'Enter' || e.key === ' ') {
			// Anchors do not activate on Space natively, so activation is handled here
			// for every item shape rather than only for buttons.
			e.preventDefault()
			const item = shownItems[activeIndex]
			if (item) {
				if (item.href) { itemRefs.current[activeIndex]?.click() }
				else { runAction(item) }
			}
			return
		}
		if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => (i >= last ? 0 : i + 1)); return }
		if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => (i <= 0 ? last : i - 1)); return }
		if (e.key === 'Home') { e.preventDefault(); setActiveIndex(0); return }
		if (e.key === 'End') { e.preventDefault(); setActiveIndex(last); return }
	}

	const onTriggerKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMenu(0) }
		else if (e.key === 'ArrowUp') { e.preventDefault(); openMenu(items.length - 1) }
	}

	return (
		<div ref={wrapRef} style={{ position: 'relative' }}>
			<Button
				ref={triggerRef}
				mode="ghost"
				icon={buttonIcon}
				padding={2}
				id={id}
				aria-label={label}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-controls={open ? menuId : undefined}
				onClick={() => (open ? close() : openMenu(0))}
				onKeyDown={onTriggerKeyDown}
			/>
			{open && (
				<Card
					id={menuId}
					radius={2}
					shadow={3}
					padding={1}
					role="menu"
					aria-labelledby={id}
					onKeyDown={onMenuKeyDown}
					style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 1000, minWidth: 200 }}
				>
					{/* role="none" so the menu still directly owns its menuitem children. */}
					<Stack space={1} role="none">
						{shownItems.map((item, i) => {
							const Icon = item.icon
							const row = (
								<Flex align="center" gap={2} paddingX={2} paddingY={2}>
									<Icon width="1em" height="1em" aria-hidden="true" />
									<Text size={1}>{item.text}</Text>
								</Flex>
							)
							// A destructive item is wrapped in a critical-tone Card so it picks up Sanity's
							// validated foreground/background pairing rather than a hand-picked colour.
							const content = item.tone === 'critical'
								? <Card tone="critical" radius={1}>{row}</Card>
								: row
							const shared: {
								role: 'menuitem'
								tabIndex: number
								ref: (el: HTMLElement | null) => void
								style: React.CSSProperties
							} = {
								role: 'menuitem',
								// Roving tabindex — the menu is one tab stop, arrows move within it.
								tabIndex: i === activeIndex ? 0 : -1,
								ref: (el: HTMLElement | null) => { itemRefs.current[i] = el },
								style: {
									display: 'block',
									width: '100%',
									textAlign: 'left' as const,
									cursor: 'pointer',
									borderRadius: 3,
									background: 'none',
									border: 0,
									padding: 0,
									font: 'inherit',
									color: 'inherit',
									textDecoration: 'none',
									// Card suppresses its own focus ring, so the active item draws one explicitly.
									outline: i === activeIndex ? '2px solid var(--card-focus-ring-color, currentColor)' : 'none',
									outlineOffset: -2,
								},
							}
							return item.href ? (
								<a
									key={itemKey(item, i)}
									{...shared}
									href={item.href}
									target="_blank"
									rel="noreferrer"
									onClick={() => { setOpen(false); triggerRef.current?.focus() }}
								>
									{content}
								</a>
							) : (
								<div
									key={itemKey(item, i)}
									{...shared}
									onClick={() => runAction(item)}
								>
									{content}
								</div>
							)
						})}
					</Stack>
				</Card>
			)}
		</div>
	)
}

/* ---------------------------------------------------------------------------
 * Composable trio — Menu / MenuButton / MenuItem
 *
 * ActionMenu above is the blessed path: it owns its item list, so it can manage
 * focus without knowing anything about its children. The trio exists because 17
 * plugins already write menus as nested JSX, and rewriting them all into the
 * declarative form is a far larger change than swapping an import.
 *
 * The fallback deliberately does NOT use a registration context. Children would
 * have to register in mount order, which is not render order once a plugin wraps
 * an item in a conditional or a fragment — a class of bug that only shows up as
 * arrow keys skipping a row. Instead MenuButton queries the live DOM for
 * `[role="menuitem"]` inside its own container, so focus order is always exactly
 * what the user sees, whatever the children did.
 * ------------------------------------------------------------------------- */

/** Props for the compat MenuButton. Mirrors the subset of upstream's surface plugins pass. */
export type CompatMenuButtonProps = {
	id: string
	/** The trigger. Cloned to receive the aria-* wiring and open handler. */
	button: React.JSX.Element
	/** The menu body, normally a `<Menu>` containing `<MenuItem>`s. */
	menu: React.JSX.Element
	popover?: { placement?: string }
}

/** Props for the compat Menu — a plain container in the fallback. */
export type CompatMenuProps = { children?: ReactNode; style?: React.CSSProperties }

/** Props for the compat MenuItem, including the anchor form. */
export type CompatMenuItemProps = {
	text?: string
	icon?: IconComponent
	tone?: 'critical'
	onClick?: () => void
	as?: 'a'
	href?: string
	target?: string
	rel?: string
	disabled?: boolean
	children?: ReactNode
}

/** Selector for focusable rows inside a fallback menu. Skips disabled items. */
const MENUITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"])'

/**
 * Menu container. Resolves to Studio's Menu on v2/v3; on v4 renders the ARIA
 * container the fallback MenuButton drives.
 */
export function Menu({ children, style }: CompatMenuProps): React.JSX.Element {
	if (InstalledMenu) return <InstalledMenu>{children}</InstalledMenu>
	// role="none" on the Stack so the menu still directly owns its menuitem children.
	return (
		<Stack space={1} role="none" style={style}>
			{children}
		</Stack>
	)
}

/**
 * One menu row. Resolves to Studio's MenuItem on v2/v3. The fallback renders the
 * same visual row as ActionMenu, with `tabIndex={-1}` — the owning MenuButton
 * promotes exactly one row to `0` as focus moves.
 */
export function MenuItem({
	text, icon, tone, onClick, as, href, target, rel, disabled, children,
}: CompatMenuItemProps): React.JSX.Element {
	/*
	 * `disabled` must be forwarded here. An earlier version omitted it, so on v2/v3 —
	 * the path most Studios take — a disabled item rendered fully enabled and
	 * clickable, while the v4 fallback below honoured it correctly. That is the worst
	 * shape of bug this package can have: correct on the major being migrated TO, and
	 * silently wrong on the one currently in production.
	 */
	if (InstalledMenuItem) {
		return (
			<InstalledMenuItem
				text={text as string}
				icon={icon as IconComponent}
				tone={tone}
				onClick={onClick}
				as={as}
				href={href}
				target={target}
				rel={rel}
				disabled={disabled}
			/>
		)
	}

	const Icon = icon
	const row = children ?? (
		<Flex align="center" gap={2} paddingX={2} paddingY={2}>
			{Icon ? <Icon width="1em" height="1em" aria-hidden="true" /> : null}
			<Text size={1}>{text}</Text>
		</Flex>
	)
	// Critical items are wrapped in a critical-tone Card so they pick up Sanity's
	// validated foreground/background pairing rather than a hand-picked colour.
	const content = tone === 'critical' ? <Card tone="critical" radius={1}>{row}</Card> : row

	const shared = {
		role: 'menuitem' as const,
		tabIndex: -1,
		'aria-disabled': disabled ? true : undefined,
		style: {
			display: 'block', width: '100%', textAlign: 'left' as const,
			cursor: disabled ? 'default' : 'pointer', borderRadius: 3,
			background: 'none', border: 0, padding: 0, font: 'inherit',
			color: 'inherit', textDecoration: 'none', opacity: disabled ? 0.5 : 1,
		},
	}

	if (href && !disabled) {
		return <a {...shared} href={href} target={target} rel={rel}>{content}</a>
	}
	return <div {...shared} onClick={disabled ? undefined : onClick}>{content}</div>
}

/**
 * Menu button. Uses Studio's MenuButton where available; otherwise implements the
 * WAI-ARIA menu button pattern over whatever `menu` renders, driving focus by DOM
 * query rather than by child registration.
 */
export function MenuButton({ id, button, menu, popover }: CompatMenuButtonProps): React.JSX.Element {
	const menuId = useId()
	const [open, setOpen] = useState(false)
	const wrapRef = useRef<HTMLDivElement>(null)
	const menuRef = useRef<HTMLDivElement>(null)
	const triggerRef = useRef<HTMLElement>(null)

	/*
	 * Every hook is declared before the InstalledMenuButton branch below, matching
	 * ActionMenu. The branch is on a module-level constant so hook order is stable
	 * across renders either way, but keeping the declarations unconditional is what
	 * react-hooks/rules-of-hooks checks statically — and it stays correct if the
	 * resolution ever becomes dynamic.
	 */

	/** Live menu rows, in the order they actually appear in the DOM. */
	const rows = useCallback(
		(): HTMLElement[] => Array.from(menuRef.current?.querySelectorAll<HTMLElement>(MENUITEM_SELECTOR) ?? []),
		[],
	)

	/** Promote one row to the single tab stop and focus it. */
	const focusRow = useCallback((index: number) => {
		const all = rows()
		if (all.length === 0) return
		const clamped = (index + all.length) % all.length
		all.forEach((el, i) => { el.tabIndex = i === clamped ? 0 : -1 })
		all[clamped]?.focus()
	}, [rows])

	const close = useCallback((returnFocus = true) => {
		setOpen(false)
		if (returnFocus) triggerRef.current?.focus()
	}, [])

	// Focus the first row once the menu has rendered.
	useEffect(() => { if (open) focusRow(0) }, [open, focusRow])

	// Dismiss on outside pointer down, reclaiming focus only if it was inside.
	useEffect(() => {
		if (!open) return
		const onPointerDown = (e: MouseEvent) => {
			if (wrapRef.current?.contains(e.target as Node)) return
			const hadFocus = wrapRef.current?.contains(document.activeElement)
			setOpen(false)
			if (hadFocus) triggerRef.current?.focus()
		}
		document.addEventListener('mousedown', onPointerDown)
		return () => document.removeEventListener('mousedown', onPointerDown)
	}, [open])

	// Studio's own MenuButton handles focus, portalling and placement — defer to it
	// whenever the installed major still exports the trio.
	if (InstalledMenuButton) {
		return <InstalledMenuButton id={id} button={button} menu={menu} popover={popover} />
	}

	const onMenuKeyDown = (e: React.KeyboardEvent) => {
		const all = rows()
		const current = all.indexOf(document.activeElement as HTMLElement)
		if (e.key === 'Escape') { e.stopPropagation(); close(); return }
		if (e.key === 'Tab') {
			// Focus the trigger synchronously, then let the browser traverse from there.
			// Closing first would unmount the focused row and drop focus to <body>.
			triggerRef.current?.focus()
			setOpen(false)
			return
		}
		if (e.key === 'Enter' || e.key === ' ') {
			// Anchors do not activate on Space natively, so activation is explicit here.
			e.preventDefault()
			;(document.activeElement as HTMLElement)?.click()
			if (!all[current]?.getAttribute('href')) close()
			return
		}
		if (e.key === 'ArrowDown') { e.preventDefault(); focusRow(current + 1); return }
		if (e.key === 'ArrowUp') { e.preventDefault(); focusRow(current - 1); return }
		if (e.key === 'Home') { e.preventDefault(); focusRow(0); return }
		if (e.key === 'End') { e.preventDefault(); focusRow(all.length - 1); return }
	}

	// Clone the caller's trigger so it keeps its own styling but gains the wiring.
	const trigger = isValidElement(button)
		? cloneElement(button as React.JSX.Element, {
			ref: triggerRef,
			id,
			'aria-haspopup': 'menu',
			'aria-expanded': open,
			'aria-controls': open ? menuId : undefined,
			onClick: () => (open ? close() : setOpen(true)),
			onKeyDown: (e: React.KeyboardEvent) => {
				if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) }
			},
		} as Record<string, unknown>)
		: button

	const placement = popover?.placement ?? 'bottom-end'
	const alignRight = placement.endsWith('-end')

	return (
		<div ref={wrapRef} style={{ position: 'relative' }}>
			{trigger}
			{open && (
				<div
					ref={menuRef}
					id={menuId}
					role="menu"
					aria-labelledby={id}
					onKeyDown={onMenuKeyDown}
					style={{
						position: 'absolute', top: '100%', marginTop: 4, zIndex: 1000, minWidth: 200,
						...(alignRight ? { right: 0 } : { left: 0 }),
					}}
				>
					<Card radius={2} shadow={3} padding={1}>{menu}</Card>
				</div>
			)}
		</div>
	)
}

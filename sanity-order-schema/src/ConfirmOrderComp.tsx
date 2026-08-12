// Order status custom input — action buttons, summary panel, and purchased-items detail for Sanity Studio
import React, { useEffect, useState } from 'react'
import {
	Text,
	Stack,
	Grid,
	Button,
	Badge,
	Inline,
	Spinner,
	MenuButton,
	Menu,
	MenuItem,
	Card,
} from '@sanity/ui'
import { useFormValue, useClient, set, type ObjectInputProps } from 'sanity'

/** Fields stored inside the orderStatus object */
interface OrderStatusValue {
	status?: string
	paymentIntentId?: string
	setupIntentId?: string
	orderNumber?: string
	shippingStatus?: boolean
	invoiceId?: string
}

/** Human-readable status labels with outcome icons */
const STATUS_LABEL: Record<string, string> = {
	verified:     '✓ Verified',
	wireVerified: '✓ Wire Verified',
	failed:       '✗ Failed',
	wireFailed:   '✗ Wire Failed',
	wireFail:     '✗ Wire Cancelled',
	refunded:     '↩ Refunded',
	pending:      'Pending',
	wirePending:  'Wire Pending',
}

const STATUS_TONE: Record<string, 'caution' | 'positive' | 'critical'> = {
	pending:      'caution',
	wirePending:  'caution',
	verified:     'positive',
	wireVerified: 'positive',
	failed:       'critical',
	wireFailed:   'critical',
	wireFail:     'critical',
}

const labelStyle = { textTransform: 'uppercase' as const, letterSpacing: '0.06em' }

/** Truncate a Stripe ID for display — keeps first 22 chars */
const truncateId = (id?: string | null) =>
	id ? id.slice(0, 22) + (id.length > 22 ? '…' : '') : null

/** A Sanity reference as it appears in the raw form value */
interface Ref { _ref?: string }

/** One licence tier as stored on a typeface line: an allowance plus an optional term */
interface LicenseTier {
	value?: number
	label?: string
	yearsValue?: number
	yearsLabel?: string
}

/** One purchased typeface line on the order */
interface TypefaceLine {
	_key?: string
	typeface?: Ref
	fonts?: Ref[]
	collections?: Ref[]
	licenseDesktop?: LicenseTier
	licenseWeb?: LicenseTier
	licenseApp?: LicenseTier
	licenseFluid?: LicenseTier
	/** Absent means active; revoked and superseded lines are excluded from renewals */
	licenseStatus?: string
	revokedReason?: string
}

/** One purchased merch line on the order */
interface MerchLine {
	_key?: string
	merchItem?: Ref
	amount?: number
}

/** A manually added line item (setup fees, custom work, discounts applied as items) */
interface LineItem {
	_key?: string
	title?: string
	description?: string
	quantity?: number
	price?: number
}

/** Formats a dollar amount for display; order costs carry float noise from tax maths. */
const money = (n?: number | null) =>
	typeof n === 'number' && !Number.isNaN(n)
		? n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
		: '—'

/** Renders the licences bought on a typeface line as "Desktop 1 CPUs / 1 year" strings. */
function licenseSummary(line: TypefaceLine): string[] {
	return ([
		['Desktop', line.licenseDesktop],
		['Web', line.licenseWeb],
		['App', line.licenseApp],
		['Fluid', line.licenseFluid],
	] as [string, LicenseTier | undefined][])
		.filter(([, tier]) => tier && Number(tier.value) > 0)
		.map(([name, tier]) => {
			const size = tier?.label || String(tier?.value ?? '')
			return tier?.yearsLabel ? `${name} ${size} / ${tier.yearsLabel}` : `${name} ${size}`
		})
}

/** Order status panel — confirm, resend, rebuild, wire-verify actions */
export const ConfirmOrderComp = (props: ObjectInputProps) => {
	const { value, onChange } = props
	const typedValue = value as OrderStatusValue | undefined

	const orderNumber      = typedValue?.orderNumber   ?? (useFormValue(['orderNumber']) as string | undefined)
	const paymentIntentId  = typedValue?.paymentIntentId
	const setupIntentId    = typedValue?.setupIntentId
	const invoiceId        = typedValue?.invoiceId
	const status           = typedValue?.status
	const shippingStatus   = typedValue?.shippingStatus

	const shippingId         = useFormValue(['shippingId']) as string[] | undefined
	const receiptDescription = useFormValue(['receiptDescription']) as string | undefined
	const shippingData       = useFormValue(['shippingData']) as string | undefined
	const contactEmail       = useFormValue(['licenseeAddress', 'email']) as string | undefined
	const company            = useFormValue(['licenseeAddress', 'company']) as string | undefined
	const brand              = useFormValue(['licenseeAddress', 'brand']) as string | undefined
	const licenseeName       = useFormValue(['licenseeAddress', 'name']) as string | undefined
	const licenseeFirstName  = useFormValue(['licenseeAddress', 'firstName']) as string | undefined
	const licenseeLastName   = useFormValue(['licenseeAddress', 'lastName']) as string | undefined
	const behalfOfIndividual = useFormValue(['licenseeAddress', 'behalfOfIndividual']) as boolean | undefined
	const billingEmail       = useFormValue(['billingAddress', 'email']) as string | undefined
	const merch              = useFormValue(['merch']) as MerchLine[] | undefined
	const hasMerch           = (merch?.length ?? 0) > 0

	const typefaceLines      = useFormValue(['typefaces']) as TypefaceLine[] | undefined
	const lineItems          = useFormValue(['additionalLineItems']) as LineItem[] | undefined
	const cost               = useFormValue(['cost']) as number | undefined
	const receiptUrl         = useFormValue(['invoice']) as string | undefined

	const [loading, setLoading]           = useState(false)
	const [error, setError]               = useState<string | null>(null)
	const [detailsOpen, setDetailsOpen]   = useState(false)

	// Titles for every document the order references, keyed by _id. The form value holds bare
	// references, so the names have to be fetched before the breakdown can name anything.
	const client = useClient({ apiVersion: '2023-03-12' })
	const [refTitles, setRefTitles] = useState<Record<string, string>>({})
	const [refsLoading, setRefsLoading] = useState(false)

	// Collected here rather than in the effect so the dependency is a stable string.
	const refIds = [
		...(typefaceLines ?? []).flatMap(l => [
			l.typeface?._ref,
			...(l.fonts ?? []).map(f => f?._ref),
			...(l.collections ?? []).map(c => c?._ref),
		]),
		...(merch ?? []).map(m => m.merchItem?._ref),
	].filter(Boolean) as string[]
	const refKey = refIds.join(',')

	useEffect(() => {
		// Only resolve once the panel is actually open — an order list should not fan out queries.
		if (!detailsOpen || !refIds.length) return
		const missing = refIds.filter(id => !(id in refTitles))
		if (!missing.length) return

		let cancelled = false
		setRefsLoading(true)
		client.fetch<{ _id: string, title?: string }[]>('*[_id in $ids]{_id, title}', { ids: missing })
			.then(docs => {
				if (cancelled) return
				const next: Record<string, string> = {}
				// Missing ids are recorded too, so a deleted reference does not retry on every render.
				for (const id of missing) next[id] = ''
				for (const d of docs) next[d._id] = d.title ?? ''
				setRefTitles(prev => ({ ...prev, ...next }))
			})
			.catch(e => console.warn('Could not resolve order references:', e?.message))
			.finally(() => { if (!cancelled) setRefsLoading(false) })

		return () => { cancelled = true }
	}, [detailsOpen, refKey])

	/** Reference title, falling back to the raw id so a broken reference is still identifiable. */
	const titleOf = (ref?: Ref) => {
		const id = ref?._ref
		if (!id) return '—'
		return refTitles[id] || id
	}

	const siteUrl = process.env.SANITY_STUDIO_SITE_URL ?? ''

	/** Dispatch one of the action types, handling loading + error state */
	async function buttonPress(type: 'confirm' | 'resend' | 'rebuild' | 'wire', args?: string) {
		if (loading) return
		setLoading(true)
		setError(null)
		try {
			if (type === 'confirm') await handleConfirm(args)
			else if (type === 'resend') await resendOrder(args)
			else if (type === 'rebuild') await rebuildOrder()
			else if (type === 'wire') await verifyWire(args)
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : 'Unexpected error')
		} finally {
			setLoading(false)
		}
	}

	/** Confirm or reject/refund an order via the site's confirmOrder endpoint */
	async function handleConfirm(confirm?: string) {
		const sid = (!setupIntentId || setupIntentId === null) ? 'non stripe payment' : setupIntentId
		const pid = (!paymentIntentId || paymentIntentId === null) ? 'non stripe payment' : paymentIntentId

		const res = await fetch(`${siteUrl}/api/sanity/confirmOrder`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				paymentIntentId: pid,
				setupIntentId: sid,
				orderNumber,
				order: confirm,
				invoiceId,
				shippingId,
				shippingData,
				receiptDescription,
			}),
		})

		const data = await res.json()
		console.warn('Confirm order response:', data)

		if (!data.success) {
			let msg: string = data.stripeError || data.message || 'Action failed'
			if (data.stripeDeclineCode) msg += ` (${data.stripeDeclineCode})`
			setError(msg)
		}
	}

	/** Resend the order confirmation email, or the shipping confirmation if type is 'shipping' */
	async function resendOrder(type?: string) {
		if (type === 'shipping') {
			await fetch(`${siteUrl}/api/sanity/resendOrder`, {
				method: 'POST',
				mode: 'no-cors',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ orderNumber, invoiceId, status: 'confirmShipping' }),
			}).then(() => {
				onChange(set({ ...typedValue, shippingStatus: true }))
			}).catch(e => console.error(e.message))
		} else {
			await fetch(`${siteUrl}/api/sanity/resendOrder`, {
				method: 'POST',
				mode: 'no-cors',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ orderNumber, invoiceId, status: 'resend' }),
			}).catch(e => console.error(e.message))
		}
	}

	/** Trigger a package rebuild for the order */
	async function rebuildOrder() {
		await fetch(`${siteUrl}/api/sanity/rebuildOrder`, {
			method: 'POST',
			mode: 'no-cors',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ orderNumber }),
		}).catch(e => console.error(e.message))
	}

	/** Verify or reject a wire transfer payment */
	async function verifyWire(code?: string) {
		await fetch(`${siteUrl}/api/sanity/verifyWire`, {
			method: 'POST',
			mode: 'no-cors',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ orderNumber: Number(orderNumber), invoiceId, code }),
		}).catch(e => console.error(e.message))
	}

	const displayName = licenseeName || [licenseeFirstName, licenseeLastName].filter(Boolean).join(' ') || null
	const showCompany = !behalfOfIndividual && !!company
	const showName    = behalfOfIndividual || (!company && !!displayName)

	const hasPrimaryAction = orderNumber && (
		status === 'pending' || status === 'failed' ||
		status === 'wirePending' || status === 'wireFail' ||
		(status === 'verified' && paymentIntentId)
	)

	return (
		<Stack space={4}>

			{/* Status badge + spinner */}
			<Stack>
				<Inline space={2}>
					<Badge
						tone={STATUS_TONE[status ?? ''] ?? 'caution'}
						fontSize={3}
						style={{ textTransform: 'capitalize' }}
						padding={3}
						radius={3}
					>
						<b>{STATUS_LABEL[status ?? ''] ?? status}</b>
					</Badge>
					{loading && <Spinner />}
				</Inline>
				{error && (
					<Text size={1} style={{ color: 'var(--card-critical-fg-color, #e05252)', fontWeight: 600 }}>
						{error}
					</Text>
				)}
			</Stack>

			{/* Contact info grid */}
			{(contactEmail || showCompany || showName || brand || hasMerch) && (
				<Grid columns={[1, 2]} gap={4}>
					{contactEmail && (
						<Stack space={2}>
							<Text size={0} muted style={labelStyle}>Licensee Email</Text>
							<Text size={1}>{contactEmail}</Text>
						</Stack>
					)}
					{(billingEmail || contactEmail) && (
						<Stack space={2}>
							<Text size={0} muted style={labelStyle}>Billing Email</Text>
							<Text size={1}>{billingEmail || contactEmail}</Text>
						</Stack>
					)}
					{showCompany && (
						<Stack space={2}>
							<Text size={0} muted style={labelStyle}>Company</Text>
							<Text size={1}>{company}</Text>
						</Stack>
					)}
					{showName && displayName && (
						<Stack space={2}>
							<Text size={0} muted style={labelStyle}>Name</Text>
							<Text size={1}>{displayName}</Text>
						</Stack>
					)}
					{brand && (
						<Stack space={2}>
							<Text size={0} muted style={labelStyle}>Brand</Text>
							<Text size={1}>{brand}</Text>
						</Stack>
					)}
					{hasMerch && (
						<Stack space={2}>
							<Text size={0} muted style={labelStyle}>Shipment</Text>
							<Text size={1} style={{ color: shippingStatus ? 'var(--card-positive-fg-color, #43d675)' : 'var(--card-caution-fg-color, #f5a623)' }}>
								{status !== 'verified' ? '—' : shippingStatus ? 'Email sent' : 'Not sent'}
							</Text>
						</Stack>
					)}
				</Grid>
			)}

			{/* Action buttons */}
			<Inline space={2}>
				{hasPrimaryAction && status === 'pending' && (
					<Button disabled={loading} mode="default" tone="positive" onClick={() => buttonPress('confirm', 'verify')} text="Confirm" />
				)}
				{hasPrimaryAction && status === 'pending' && (
					<Button disabled={loading} mode="ghost" tone="critical" onClick={() => buttonPress('confirm', 'reject')} text="Cancel" />
				)}
				{hasPrimaryAction && status === 'failed' && (
					<Button disabled={loading} mode="ghost" tone="caution" onClick={() => buttonPress('confirm', 'verify')} text="Try Again" />
				)}
				{hasPrimaryAction && status === 'verified' && paymentIntentId && (
					<Button disabled={loading} mode="ghost" tone="critical" onClick={() => buttonPress('confirm', 'refund')} text="Refund" />
				)}
				{hasPrimaryAction && status === 'wirePending' && (
					<Button disabled={loading} mode="default" tone="positive" onClick={() => buttonPress('wire', 'verify')} text="Verify" />
				)}
				{hasPrimaryAction && status === 'wirePending' && (
					<Button disabled={loading} mode="ghost" tone="critical" onClick={() => buttonPress('wire', 'reject')} text="Reject" />
				)}
				{hasPrimaryAction && status === 'wireFail' && (
					<Text size={1} style={{ color: 'var(--card-critical-fg-color, #e05252)' }}>Wire Cancelled</Text>
				)}
				{hasPrimaryAction && (
					<Text size={1} muted style={{ opacity: 0.25 }}>|</Text>
				)}
				<MenuButton
					button={<Button mode="ghost" text="More" disabled={loading} />}
					id="order-more-menu"
					menu={
						<Menu>
							<MenuItem text="Resend" disabled={loading} onClick={() => buttonPress('resend')} />
							<MenuItem text="Rebuild" disabled={loading} onClick={() => buttonPress('rebuild')} />
							<MenuItem text="Send Shipment" disabled={!hasMerch || loading} onClick={() => buttonPress('resend', 'shipping')} />
						</Menu>
					}
					popover={{ placement: 'bottom-start' }}
				/>
				<Button
					mode="ghost"
					onClick={() => setDetailsOpen(v => !v)}
					text={detailsOpen ? 'Close Details' : 'Details'}
				/>
			</Inline>

			{/* Purchased items, licences and total — accordion */}
			{detailsOpen && (
				<Card padding={3} radius={2} shadow={1} tone="transparent">
					<Stack space={4}>
						<Inline space={2}>
							<Text size={0} muted style={labelStyle}>Purchased</Text>
							{refsLoading && <Spinner size={0} />}
						</Inline>

						{(typefaceLines ?? []).map((line, i) => {
							const licenses = licenseSummary(line)
							const fonts = (line.fonts ?? []).map(titleOf).filter(t => t !== '—')
							const collections = (line.collections ?? []).map(titleOf).filter(t => t !== '—')
							const inactive = !!line.licenseStatus && line.licenseStatus !== 'active'
							return (
								<Stack space={2} key={line._key ?? i} style={inactive ? { opacity: 0.55 } : undefined}>
									{inactive && (
										<Text size={0} style={{ ...labelStyle, color: 'var(--card-critical-fg-color, #e05252)' }}>
											{line.licenseStatus === 'superseded' ? 'Superseded' : 'Revoked'}
											{line.revokedReason ? ` — ${line.revokedReason.replace(/-/g, ' ')}` : ''}
											{' · not counted for renewals'}
										</Text>
									)}
									<Text size={1} weight="semibold" style={inactive ? { textDecoration: 'line-through' } : undefined}>
										{titleOf(line.typeface)}
										{fonts.length ? ` — ${fonts.length} ${fonts.length === 1 ? 'style' : 'styles'}` : ''}
										{collections.length ? ` + ${collections.length} ${collections.length === 1 ? 'collection' : 'collections'}` : ''}
									</Text>
									{!!fonts.length && <Text size={1} muted>{fonts.join(', ')}</Text>}
									{!!collections.length && <Text size={1} muted>Collections: {collections.join(', ')}</Text>}
									<Text size={1} style={{ opacity: licenses.length ? 0.9 : 0.35 }}>
										{licenses.length ? licenses.join('  ·  ') : 'No licence selected'}
									</Text>
								</Stack>
							)
						})}

						{(merch ?? []).map((m, i) => (
							<Stack space={2} key={m._key ?? i}>
								<Text size={1} weight="semibold">{titleOf(m.merchItem)}</Text>
								<Text size={1} muted>Qty {m.amount ?? 1}</Text>
							</Stack>
						))}

						{(lineItems ?? []).map((li, i) => (
							<Stack space={2} key={li._key ?? i}>
								<Text size={1} weight="semibold">{li.title || 'Line item'}</Text>
								<Text size={1} muted>
									{li.description ? `${li.description} — ` : ''}
									{li.quantity ?? 1} × {money(li.price)}
								</Text>
							</Stack>
						))}

						{!typefaceLines?.length && !merch?.length && !lineItems?.length && (
							<Text size={1} muted>No items recorded on this order.</Text>
						)}

						{/* Cost excludes tax and shipping — say so rather than implying it is the charge. */}
						<Inline space={3}>
							<Text size={0} muted style={labelStyle}>Total</Text>
							<Text size={2} weight="semibold">{money(cost)}</Text>
							<Text size={0} muted>discount included · tax &amp; shipping excluded</Text>
						</Inline>

						{(receiptUrl || invoiceId) && (
							<Inline space={2}>
								{receiptUrl && (
									<Button
										mode="ghost"
										as="a"
										href={receiptUrl}
										target="_blank"
										rel="noopener noreferrer"
										text="Open receipt"
									/>
								)}
								{invoiceId && (
									<Button
										mode="ghost"
										as="a"
										href={`https://dashboard.stripe.com/invoices/${invoiceId}`}
										target="_blank"
										rel="noopener noreferrer"
										text="Stripe invoice"
									/>
								)}
							</Inline>
						)}
					</Stack>
				</Card>
			)}

			{/* ID details — accordion */}
			{detailsOpen && (
				<Grid columns={[1, 2]} gap={4}>
					<Stack space={2}>
						<Text size={0} muted style={labelStyle}>Invoice</Text>
						<Text size={1} style={{ fontFamily: 'monospace', opacity: invoiceId ? 1 : 0.35, wordBreak: 'break-all' }}>
							{invoiceId ? truncateId(invoiceId) : '—'}
						</Text>
					</Stack>
					<Stack space={2}>
						<Text size={0} muted style={labelStyle}>Payment</Text>
						<Text size={1} style={{ fontFamily: 'monospace', opacity: paymentIntentId ? 1 : 0.35, wordBreak: 'break-all' }}>
							{paymentIntentId ? truncateId(paymentIntentId) : '—'}
						</Text>
					</Stack>
					{hasMerch && (
						<Stack space={2}>
							<Text size={0} muted style={labelStyle}>Shipping</Text>
							<Text size={1} style={{ fontFamily: 'monospace', opacity: shippingId?.length ? 1 : 0.35, wordBreak: 'break-all' }}>
								{shippingId?.length ? truncateId(shippingId[0]) : '—'}
							</Text>
						</Stack>
					)}
				</Grid>
			)}

		</Stack>
	)
}

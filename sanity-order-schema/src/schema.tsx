// createOrderSchema — factory for the shared order document schema
import React from 'react'
import { ConfirmOrderComp } from './ConfirmOrderComp'

/** Feature flags — each defaults to the corresponding SANITY_STUDIO_* env var */
export interface OrderSchemaOptions {
	/** Show renewal and tier-upgrade order types. Env: SANITY_STUDIO_RENEWALS_ENABLED */
	enableRenewals?: boolean
	/** Show the merch array and shipping fields. Env: SANITY_STUDIO_MERCH_ENABLED */
	enableMerch?: boolean
	/** Show the scripts support field. Env: SANITY_STUDIO_SCRIPTS_ENABLED */
	enableScripts?: boolean
	/** Replace account reference with guest-checkout field. Env: SANITY_STUDIO_GUEST_CHECKOUT */
	enableGuestCheckout?: boolean
}

/** Resolve an option: explicit value > env var > false */
function flag(explicit: boolean | undefined, envKey: string): boolean {
	if (explicit !== undefined) return explicit
	return !!process.env[envKey]
}

/** Returns the Sanity `order` document schema, parameterised by feature flags */
export function createOrderSchema(options: OrderSchemaOptions = {}) {
	const renewals     = flag(options.enableRenewals,    'SANITY_STUDIO_RENEWALS_ENABLED')
	const merch        = flag(options.enableMerch,       'SANITY_STUDIO_MERCH_ENABLED')
	const scripts      = flag(options.enableScripts,     'SANITY_STUDIO_SCRIPTS_ENABLED')
	const guestCheckout = flag(options.enableGuestCheckout, 'SANITY_STUDIO_GUEST_CHECKOUT')

	/** Order status object — houses the ConfirmOrderComp custom input */
	const orderStatusField = {
		title: 'Order Status',
		name: 'orderStatus',
		type: 'object',
		group: 'order',
		fields: [
			{
				title: 'Status',
				name: 'status',
				type: 'string',
				readOnly: true,
				options: {
					list: [
						{ title: 'Pending',              value: 'pending' },
						{ title: 'Verified',             value: 'verified' },
						{ title: 'Failed',               value: 'failed' },
						{ title: 'Refunded',             value: 'refunded' },
						{ title: 'Wire Transfer Pending', value: 'wirePending' },
						{ title: 'Wire Transferred',     value: 'wireVerified' },
						{ title: 'Wire Cancelled',       value: 'wireFail' },
					],
				},
			},
			{
				title: 'Stripe Payment Intent Id',
				name: 'paymentIntentId',
				type: 'string',
				readOnly: true,
			},
			{
				title: 'Stripe Setup Intent Id',
				name: 'setupIntentId',
				type: 'string',
				readOnly: true,
				hidden: true,
			},
			{
				title: 'Order Number',
				name: 'orderNumber',
				type: 'string',
				readOnly: true,
				hidden: true,
			},
			{
				title: 'Shipping ID',
				name: 'shippingId',
				type: 'string',
				readOnly: true,
				hidden: true,
			},
			{
				title: 'Shipping Status',
				name: 'shippingStatus',
				type: 'boolean',
				readOnly: true,
			},
			{
				title: 'Stripe Invoice Id',
				name: 'invoiceId',
				type: 'string',
				readOnly: true,
				hidden: true,
			},
		],
		components: {
			input: ConfirmOrderComp,
		},
	}

	/** Renewal-only fields — order type selector + conditional renewal/upgrade objects */
	const renewalFields = renewals ? [
		{
			title: 'Order Type',
			name: 'orderType',
			type: 'string',
			group: 'order',
			options: {
				list: [
					{ title: 'Regular Order',      value: 'regular' },
					{ title: 'Renewal Order',       value: 'renewal' },
					{ title: 'Tier Upgrade Order',  value: 'tier-upgrade' },
				],
			},
			initialValue: 'regular',
		},
		{
			title: 'Original Order Reference',
			name: 'originalOrderRef',
			type: 'reference',
			group: 'order',
			to: [{ type: 'order' }],
			hidden: ({ parent }: { parent?: { orderType?: string } }) => parent?.orderType !== 'renewal',
		},
		{
			title: 'Upgrade Information',
			name: 'upgradeInfo',
			type: 'object',
			group: 'order',
			hidden: ({ parent }: { parent?: { orderType?: string } }) => parent?.orderType !== 'tier-upgrade',
			options: { collapsible: true },
			fields: [
				{
					title: 'Original Order Reference',
					name: 'originalOrderRef',
					type: 'string',
					description: 'Order number this upgrade supersedes',
				},
				{
					title: 'Tier Changes',
					name: 'tierChanges',
					type: 'array',
					of: [{
						type: 'object',
						fields: [
							{ title: 'License Type',       name: 'licenseType', type: 'string' },
							{ title: 'From Tier',          name: 'fromTier',    type: 'number' },
							{ title: 'To Tier',            name: 'toTier',      type: 'number' },
							{ title: 'From Label',         name: 'fromLabel',   type: 'string' },
							{ title: 'To Label',           name: 'toLabel',     type: 'string' },
							{ title: 'Top-Up Amount (USD)', name: 'topUpAmount', type: 'number' },
						],
					}],
				},
			],
		},
		{
			title: 'Renewal Information',
			name: 'renewalInfo',
			type: 'object',
			group: 'order',
			hidden: ({ parent }: { parent?: { orderType?: string } }) => parent?.orderType !== 'renewal',
			options: { collapsible: true },
			fields: [
				{
					title: 'Unique Effective Date on Addendum (Optional)',
					name: 'effectiveDate',
					type: 'date',
					description: 'Leave blank to use default effective date',
				},
				{
					title: 'Superseded Document Number on EULA',
					name: 'supersededDocNumber',
					type: 'string',
				},
				{
					title: 'Per-License Effective Dates',
					name: 'licenseEffectiveDates',
					type: 'object',
					description: 'Override effective date per license type. Use original issue date for licenses not being billed in this renewal.',
					options: { collapsible: true, collapsed: true },
					fields: [
						{ title: 'Desktop (Basic EULA) — Perpetual', name: 'desktop', type: 'date' },
						{ title: 'Web Embedding',                    name: 'web',     type: 'date' },
						{ title: 'App Embedding',                    name: 'app',     type: 'date' },
						{ title: 'Fluid Interface',                  name: 'fluid',   type: 'date' },
					],
				},
			],
		},
	] : []

	/** Scripts support field — Sorkin / MCKL sites that sell custom OpenType scripts */
	const scriptsField = scripts ? [{
		title: 'Scripts',
		name: 'scripts',
		type: 'array',
		group: 'order',
		of: [{ type: 'string' }],
	}] : []

	/** Account reference — used when guestCheckout is disabled (Sorkin / MCKL) */
	const accountField = !guestCheckout ? [{
		title: 'Account',
		name: 'account',
		type: 'reference',
		group: 'customer',
		weak: true,
		to: [{ type: 'account' }],
	}] : []

	/** Merch fields — conditionally shown; shipping cluster gated on merch presence */
	const merchFields = merch ? [
		{
			title: 'Merch',
			name: 'merch',
			type: 'array',
			group: 'order',
			of: [{
				type: 'object',
				fields: [
					{
						title: 'Item',
						name: 'merchItem',
						type: 'reference',
						to: [{ type: 'merchItem' }],
					},
					{
						title: 'Amount',
						name: 'amount',
						type: 'number',
					},
				],
				preview: {
					select: { title: 'merchItem.title', subtitle: 'amount' },
					prepare({ title, subtitle }: { title?: string; subtitle?: number }) {
						return { title, subtitle: `amount: ${subtitle}` }
					},
				},
			}],
		},
	] : []

	/** Shipping cluster — only present when merch is enabled */
	const shippingFields = merch ? [
		{
			title: 'Total Shipping Cost',
			name: 'shippingCost',
			type: 'number',
			group: 'order',
			initialValue: 0,
			readOnly: true,
			hidden: ({ document }: { document?: { merch?: unknown[] } }) => !document?.merch?.length,
		},
		{
			title: 'Shipping ID',
			name: 'shippingId',
			type: 'array',
			group: 'order',
			readOnly: true,
			of: [{ type: 'string' }],
			initialValue: [],
			hidden: ({ document }: { document?: { merch?: unknown[] } }) => !document?.merch?.length,
		},
		{
			title: 'Shipping Tracking',
			name: 'shippingTracking',
			type: 'array',
			group: 'order',
			readOnly: true,
			of: [{ type: 'string' }],
			initialValue: [],
			hidden: ({ document }: { document?: { merch?: unknown[] } }) => !document?.merch?.length,
		},
		{
			title: 'Shipping Carrier',
			name: 'shippingCarrier',
			type: 'string',
			group: 'order',
			readOnly: true,
			hidden: ({ document }: { document?: { merch?: unknown[] } }) => !document?.merch?.length,
		},
		{
			title: 'Shipping Address',
			name: 'shippingAddress',
			type: 'object',
			group: 'customer',
			hidden: ({ document }: { document?: { merch?: unknown[] } }) => !document?.merch?.length,
			options: { collapsible: true, collapsed: true },
			fields: [
				{ title: 'Same as Licensee Address', name: 'sameAsLicensee', type: 'boolean', initialValue: false },
				{ title: 'Name',        name: 'name',        type: 'string', hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
				{ title: 'First Name',  name: 'firstName',   type: 'string', hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
				{ title: 'Last Name',   name: 'lastName',    type: 'string', hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
				{ title: 'Company',     name: 'company',     type: 'string', hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
				{ title: 'Phone',       name: 'phone',       type: 'string', hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
				{ title: 'Address',     name: 'address',     type: 'string', hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
				{ title: 'Address 2',   name: 'address2',    type: 'string', hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
				{ title: 'City',        name: 'city',        type: 'string', hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
				{ title: 'State/Province', name: 'state',    type: 'string', hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
				{ title: 'Postal Code', name: 'postalCode',  type: 'string', hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
				{ title: 'Country',     name: 'country',     type: 'string', hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
			],
		},
	] : []

	/** Stored value of one licence tier: an allowance plus an optional term */
	type LicenseTierValue = {
		value?: number
		label?: string
		yearsValue?: number
		yearsLabel?: string
	}

	/** License tier object — shared shape across desktop, web, app, fluid */
	const licenseTier = (title: string, name: string) => ({
		title,
		name,
		type: 'object',
		fields: [
			{ title: 'Value',       name: 'value',      type: 'number', initialValue: 0 },
			{ title: 'Label',       name: 'label',      type: 'string', initialValue: '' },
			{ title: 'Years',       name: 'yearsValue', type: 'number', initialValue: 1 },
			{ title: 'Years Label', name: 'yearsLabel', type: 'string', initialValue: '1 year' },
		],
	})

	return {
		name: 'order',
		title: 'Order',
		type: 'document',
		groups: [
			{ name: 'order',     title: 'Order',    default: true },
			{ name: 'customer',  title: 'Customer' },
			{ name: 'documents', title: 'Receipt' },
			{ name: 'system',    title: 'System' },
		],
		fields: [

			// ── ORDER TAB ──────────────────────────────────────────────────────

			orderStatusField,
			{
				title: 'File',
				name: 'file',
				type: 'file',
				group: 'order',
			},

			// Renewal / upgrade order types (env-gated)
			...renewalFields,

			{
				title: 'Order Number',
				name: 'orderNumber',
				type: 'string',
				group: 'order',
				validation: (Rule: { required: () => unknown }) => Rule.required(),
			},
			{
				title: 'Typefaces',
				name: 'typefaces',
				type: 'array',
				group: 'order',
				of: [{
					type: 'object',
					fields: [
						{
							title: 'Typeface',
							name: 'typeface',
							type: 'reference',
							weak: true,
							to: [{ type: 'typeface' }],
						},
						{
							title: 'Collections',
							name: 'collections',
							type: 'array',
							of: [{ type: 'reference', weak: true, to: [{ type: 'collection' }] }],
						},
						{
							title: 'Fonts',
							name: 'fonts',
							type: 'array',
							of: [{ type: 'reference', weak: true, to: [{ type: 'font' }] }],
						},
						licenseTier('License Desktop', 'licenseDesktop'),
						licenseTier('License Web',     'licenseWeb'),
						licenseTier('License App',     'licenseApp'),
						licenseTier('License Fluid',   'licenseFluid'),
						// Licence lifecycle — deliberately separate from orderStatus, which records a
						// payment fact. A licence can be revoked without a refund (breach) or refunded
						// without revocation (goodwill). Absent means active, so no existing order
						// needs backfilling.
						{
							title: 'Licence Status',
							name: 'licenseStatus',
							type: 'string',
							options: {
								list: [
									{ title: 'Active', value: 'active' },
									{ title: 'Revoked', value: 'revoked' },
									{ title: 'Superseded (replaced by another order)', value: 'superseded' },
								],
								layout: 'radio',
							},
							description: 'Leave unset for an active licence. Revoked and superseded lines are excluded from renewals.',
						},
						{
							title: 'Revoked / Superseded On',
							name: 'revokedAt',
							type: 'datetime',
							hidden: ({ parent }: { parent?: { licenseStatus?: string } }) =>
								!parent?.licenseStatus || parent.licenseStatus === 'active',
						},
						{
							title: 'Reason',
							name: 'revokedReason',
							type: 'string',
							options: {
								list: [
									{ title: 'Refunded', value: 'refunded' },
									{ title: 'Wrong licence selected', value: 'wrong-licence' },
									{ title: 'Replaced by another order', value: 'replaced' },
									{ title: 'Breach of licence', value: 'breach' },
									{ title: 'Other', value: 'other' },
								],
							},
							hidden: ({ parent }: { parent?: { licenseStatus?: string } }) =>
								!parent?.licenseStatus || parent.licenseStatus === 'active',
						},
						{
							title: 'Replaced By Order',
							name: 'replacedByOrder',
							type: 'reference',
							weak: true,
							to: [{ type: 'order' }],
							description: 'The order that carries the corrected licence.',
							hidden: ({ parent }: { parent?: { licenseStatus?: string } }) =>
								parent?.licenseStatus !== 'superseded',
						},
					],
					preview: {
						select: {
							typeface: 'typeface.title',
							allFonts: 'fonts',
							allCollections: 'collections',
							licenseDesktop: 'licenseDesktop',
							licenseWeb: 'licenseWeb',
							licenseApp: 'licenseApp',
							licenseFluid: 'licenseFluid',
							licenseStatus: 'licenseStatus',
						},
						prepare({ typeface, allFonts, allCollections, licenseDesktop, licenseWeb, licenseApp, licenseFluid, licenseStatus }: {
							typeface?: string
							allFonts?: unknown
							allCollections?: unknown
							licenseDesktop?: LicenseTierValue
							licenseWeb?: LicenseTierValue
							licenseApp?: LicenseTierValue
							licenseFluid?: LicenseTierValue
							licenseStatus?: string
						}) {
							// Counting with Object.keys() reported a single font as "4 styles" — it was
							// counting the properties of that one reference (_key, _ref, _type, _weak)
							// rather than the entries. Count entries, whatever shape select hands back.
							const countEntries = (v: unknown) => Array.isArray(v) ? v.length : (v ? 1 : 0)
							const numFonts = countEntries(allFonts)
							const numCollections = countEntries(allCollections)

							const parts: string[] = []
							if (numFonts) parts.push(`${numFonts} ${numFonts === 1 ? 'style' : 'styles'}`)
							if (numCollections) parts.push(`${numCollections} ${numCollections === 1 ? 'collection' : 'collections'}`)

							// The licences bought distinguish one line from another far more usefully
							// than repeating the style names.
							const licenses = ([
								['Desktop', licenseDesktop],
								['Web', licenseWeb],
								['App', licenseApp],
								['Fluid', licenseFluid],
							] as [string, LicenseTierValue | undefined][])
								.filter(([, tier]) => tier && Number(tier.value) > 0)
								.map(([name, tier]) => {
									const size = tier?.label || String(tier?.value ?? '')
									return tier?.yearsLabel ? `${name} ${size} / ${tier.yearsLabel}` : `${name} ${size}`
								})

							// An inactive licence is the most important thing about the line, so it
							// leads the title rather than hiding at the end of the subtitle.
							const inactive = !!licenseStatus && licenseStatus !== 'active'
							const statusPrefix = licenseStatus === 'revoked' ? '⊘ REVOKED — '
								: licenseStatus === 'superseded' ? '↪ SUPERSEDED — '
								: ''

							return {
								title: `${statusPrefix}${typeface}${parts.length ? ` (${parts.join(', ')})` : ''}`,
								subtitle: licenses.length
									? `${licenses.join('  ·  ')}${inactive ? '  —  not counted for renewals' : ''}`
									: 'No licence selected',
							}
						},
					},
				}],
			},

			// Merch (env-gated)
			...merchFields,

			// Scripts support (env-gated)
			...scriptsField,

			{
				title: 'Additional Line Items',
				name: 'additionalLineItems',
				type: 'array',
				group: 'order',
				of: [{
					type: 'object',
					fields: [
						{
							title: 'Title',
							name: 'title',
							type: 'string',
							validation: (Rule: { required: () => unknown }) => Rule.required(),
						},
						{ title: 'Description', name: 'description', type: 'text' },
						{
							title: 'Quantity',
							name: 'quantity',
							type: 'number',
							initialValue: 1,
							validation: (Rule: { required: () => { min: (n: number) => unknown } }) => Rule.required().min(1),
						},
						{
							title: 'Price (USD)',
							name: 'price',
							type: 'number',
							validation: (Rule: { required: () => { min: (n: number) => unknown } }) => Rule.required().min(0),
						},
					],
					preview: {
						select: { title: 'title', quantity: 'quantity', price: 'price' },
						prepare({ title, quantity, price }: { title?: string; quantity?: number; price?: number }) {
							return {
								title,
								subtitle: `Qty: ${quantity} × $${price} = $${((quantity ?? 0) * (price ?? 0)).toFixed(2)}`,
							}
						},
					},
				}],
			},
			{
				title: 'Cost',
				name: 'cost',
				type: 'number',
				group: 'order',
				initialValue: 0,
				description: 'Discount included, tax & shipping excluded — in dollars',
				readOnly: true,
			},
			{
				title: 'Tax',
				name: 'tax',
				type: 'number',
				group: 'order',
				initialValue: 0,
				readOnly: true,
				description: 'In cents',
			},

			// Shipping cluster (env-gated, merch only)
			...shippingFields.filter(f => ['shippingCost', 'shippingId', 'shippingTracking', 'shippingCarrier'].includes((f as { name: string }).name)),

			{
				title: 'Discount',
				name: 'discount',
				type: 'reference',
				group: 'order',
				weak: true,
				to: [{ type: 'discounts' }],
			},
			{
				title: 'Order Success',
				name: 'orderSuccess',
				type: 'boolean',
				group: 'system',
				readOnly: true,
				hidden: true,
			},

			// ── CUSTOMER TAB ──────────────────────────────────────────────────

			// Account reference (when guest checkout is disabled)
			...accountField,

			{
				title: 'Licensee Address',
				name: 'licenseeAddress',
				type: 'object',
				group: 'customer',
				options: { collapsible: true, collapsed: true },
				fields: [
					{ title: 'Same as Licensee Address', name: 'sameAsLicensee',     type: 'boolean', hidden: true },
					{ title: 'Name',                     name: 'name',               type: 'string' },
					{ title: 'First Name',               name: 'firstName',          type: 'string' },
					{ title: 'Last Name',                name: 'lastName',           type: 'string' },
					{ title: 'Company',                  name: 'company',            type: 'string' },
					{ title: 'Title',                    name: 'title',              type: 'string' },
					{ title: 'Application',              name: 'application',        type: 'string' },
					{ title: 'Behalf of company',        name: 'behalfOfCompany',    type: 'boolean' },
					{ title: 'Behalf of individual',     name: 'behalfOfIndividual', type: 'boolean' },
					{ title: 'Brand',                    name: 'brand',              type: 'string' },
					{ title: 'Website',                  name: 'website',            type: 'string' },
					{ title: 'Phone',                    name: 'phone',              type: 'string' },
					{ title: 'Email',                    name: 'email',              type: 'string' },
					{ title: 'Address',                  name: 'address',            type: 'string' },
					{ title: 'Address 2',                name: 'address2',           type: 'string' },
					{ title: 'City',                     name: 'city',               type: 'string' },
					{ title: 'State/Province',           name: 'state',              type: 'string' },
					{ title: 'Postal Code',              name: 'postalCode',         type: 'string' },
					{ title: 'Country',                  name: 'country',            type: 'string' },
				],
			},
			{
				title: 'Billing Address',
				name: 'billingAddress',
				type: 'object',
				group: 'customer',
				options: { collapsible: true, collapsed: true },
				fields: [
					{ title: 'Same as Licensee Address', name: 'sameAsLicensee',     type: 'boolean', initialValue: false },
					{ title: 'Name',                     name: 'name',               type: 'string',  hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
					{ title: 'First Name',               name: 'firstName',          type: 'string',  hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
					{ title: 'Last Name',                name: 'lastName',           type: 'string',  hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
					{ title: 'Title',                    name: 'title',              type: 'string',  hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
					{ title: 'Application',              name: 'application',        type: 'string',  hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
					{ title: 'Behalf of company',        name: 'behalfOfCompany',    type: 'boolean', hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
					{ title: 'Behalf of individual',     name: 'behalfOfIndividual', type: 'boolean', hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
					{ title: 'Brand',                    name: 'brand',              type: 'string',  hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
					{ title: 'Company',                  name: 'company',            type: 'string',  hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
					{ title: 'Email',                    name: 'email',              type: 'string',  hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
					{ title: 'Website',                  name: 'website',            type: 'string',  hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
					{ title: 'Phone',                    name: 'phone',              type: 'string',  hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
					{ title: 'Address',                  name: 'address',            type: 'string',  hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
					{ title: 'Address 2',                name: 'address2',           type: 'string',  hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
					{ title: 'City',                     name: 'city',               type: 'string',  hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
					{ title: 'State/Province',           name: 'state',              type: 'string',  hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
					{ title: 'Postal Code',              name: 'postalCode',         type: 'string',  hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
					{ title: 'Country',                  name: 'country',            type: 'string',  hidden: ({ parent }: { parent?: { sameAsLicensee?: boolean } }) => !!parent?.sameAsLicensee },
				],
			},

			// Shipping address (only present when merch is enabled)
			...shippingFields.filter(f => (f as { name: string }).name === 'shippingAddress'),

			{
				title: 'Card',
				name: 'card',
				type: 'object',
				group: 'customer',
				options: { collapsible: true, collapsed: true },
				fields: [
					{ title: 'Brand',            name: 'brand',     type: 'string' },
					{ title: 'Country',          name: 'country',   type: 'string' },
					{ title: 'Expiry Month',     name: 'exp_month', type: 'string' },
					{ title: 'Expiry Year',      name: 'exp_year',  type: 'string' },
					{ title: 'Funding',          name: 'funding',   type: 'string' },
					{ title: 'Last 4',           name: 'last4',     type: 'string' },
				],
			},

			// ── DOCUMENTS TAB ─────────────────────────────────────────────────

			{
				title: 'Invoice',
				name: 'invoice',
				type: 'string',
				group: 'documents',
			},

			// ── SYSTEM TAB ────────────────────────────────────────────────────

			{
				title: 'Title',
				name: 'title',
				type: 'string',
				group: 'system',
			},
			{
				title: 'Slug',
				name: 'slug',
				type: 'slug',
				group: 'system',
				options: { source: 'title', maxLength: 96 },
			},
			{
				title: 'Cart URL',
				name: 'cartUrl',
				type: 'slug',
				group: 'system',
				options: {
					source: '_id',
					maxLength: 200,
					slugify: (input: string) => {
						const id = input.startsWith('drafts.') ? input.slice(7) : input
						return `${process.env.SANITY_STUDIO_SITE_URL}/checkout/licenseeInfo?order=${id}`
					},
				},
			},
			{
				title: 'Fingerprint Hash',
				name: 'fingerprintHash',
				type: 'string',
				group: 'system',
				description: 'First 16 hex chars of SHA-256(fingerprint) — set at package build time for forensic lookup',
				readOnly: true,
				hidden: true,
			},
			{
				title: 'Receipt Description',
				name: 'receiptDescription',
				type: 'string',
				group: 'system',
				hidden: true,
			},
			{
				title: 'Shipping Data',
				name: 'shippingData',
				type: 'string',
				group: 'system',
				hidden: true,
			},
			{
				title: 'Download Name',
				name: 'downloadName',
				type: 'string',
				group: 'system',
				hidden: true,
			},
			{
				title: 'File Created',
				name: 'fileCreated',
				type: 'boolean',
				group: 'system',
				initialValue: false,
				hidden: true,
			},
		],

		preview: {
			select: {
				orderNumber: 'orderNumber',
				status:    'orderStatus.status',
				merch:     'merch.0.merchItem.title',
				typeface0: 'typefaces.0.typeface.title',
				typeface1: 'typefaces.1.typeface.title',
				typeface2: 'typefaces.2.typeface.title',
				typeface3: 'typefaces.3.typeface.title',
				title:     'title',
				web:       'typefaces.0.licenseWeb.value',
				app:       'typefaces.0.licenseApp.value',
				desktop:   'typefaces.0.licenseDesktop.value',
				fluid:     'typefaces.0.licenseFluid.value',
			},
			prepare({
				orderNumber, title, status, merch,
				typeface0, typeface1, typeface2, typeface3,
				web, app, desktop, fluid,
			}: {
				orderNumber?: string; title?: string; status?: string; merch?: string
				typeface0?: string; typeface1?: string; typeface2?: string; typeface3?: string
				web?: number; app?: number; desktop?: number; fluid?: number
			}) {
				const typefaces = [typeface0, typeface1, typeface2, typeface3].filter(Boolean).join(', ')

				const ICON: Record<string, string> = {
					verified: '✓', wireVerified: '✓',
					failed: '✗', wireFailed: '✗', wireFail: '✗',
					refunded: '↩', pending: '·', wirePending: '·',
				}
				const COLOR: Record<string, string> = {
					verified: '#22c55e', wireVerified: '#22c55e',
					failed: '#ef4444', wireFailed: '#ef4444', wireFail: '#ef4444',
					refunded: '#9ca3af', pending: '#f59e0b', wirePending: '#f59e0b',
				}

				const icon  = ICON[status ?? '']  || '·'
				const color = COLOR[status ?? ''] || '#f59e0b'

				const licenseIcons = [
					(web     ?? 0) > 0 ? '🌐' : null,
					(app     ?? 0) > 0 ? '📲' : null,
					(desktop ?? 0) > 0 ? '🖥'  : null,
					(fluid   ?? 0) > 0 ? '💧' : null,
				].filter(Boolean).join(' ')

				const iconTag = licenseIcons ? `  ${licenseIcons}` : ''

				const subtitle = merch
					? `#${orderNumber}${iconTag}  —  📦 ${typefaces ? `+ ${typefaces}` : ''}`
					: `#${orderNumber}${iconTag}  —  ${typeface3 ? `${typefaces}...` : typefaces}`

				return {
					title,
					subtitle,
					media: (
						<span style={{
							display: 'flex', alignItems: 'center', justifyContent: 'center',
							width: '1em', color, fontWeight: 700, fontSize: '1.1em', lineHeight: 1, flexShrink: 0,
						}}>
							{icon}
						</span>
					),
				}
			},
		},
	}
}

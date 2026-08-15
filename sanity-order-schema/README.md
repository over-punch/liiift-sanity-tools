# @liiift-studio/sanity-order-schema — RETIRED

**This package is retired. Do not use it, and do not publish it.**

The order schema now lives directly in Darden:

- `sites/darden/sanity/schemas/order.tsx`
- `sites/darden/sanity/schemas/components/confirmOrderComp.tsx`

## Why it was retired

It was extracted so the five foundry sites could share one order schema. They cannot:

- **Licence model.** This schema hardcodes four fixed tiers (`licenseDesktop/Web/App/Fluid`) in five
  separate places. TDF, MCKL, Sorkin and Positype all model licences as `typefaces[].licenses[]` —
  a different arity and query shape, not a feature toggle.
- **Reference type names.** It hardcodes `to: [{type: 'discounts'}]`. TDF has only `discount`; MCKL
  has `discount` and `discountCode`. An unresolvable reference target is a schema-validation error at
  Studio boot, so this schema could not load on either site at all.
- **Field shapes.** TDF/MCKL use `address1`/`address2` and `billingAddress.taxNumber`; TDF calls the
  merch array `good`; three sites nest `scripts` inside `typefaces[]` while this puts it at the top
  level.

With Darden as the only viable consumer, the package was indirection with no sharing benefit, plus a
version-skew surface and a published-artifact risk. Making it genuinely shareable would mean
parameterising the licence model, a reference-type name map, and per-site field modules — a real
project, and nobody is asking for it.

## Publication

`1.2.0` was published to the public npm registry on 2026-08-13 and has been unpublished. It should
not be republished. Findings from the review that prompted this are tracked in
`Liiift-Studio/liiift-sanity-tools` and `Liiift-Studio/Darden-Studio` under the `deep-review` label.

The source is kept here for history only.

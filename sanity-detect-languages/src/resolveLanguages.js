// Pure language resolution for a typeface — turns its fonts' stored character sets into a language list.

import { detectLanguages, intersectCodepoints } from './detect.js';

/**
 * Reduces draft/published pairs of the same font to one document, preferring the draft — that is what
 * the editor is looking at. Without this the same style is counted twice.
 * @param {object[]} fontDocs - documents carrying `_id`
 * @returns {object[]} one document per underlying font
 */
export function dedupeFontDocs(fontDocs = []) {
	const byBaseId = new Map();
	for (const doc of fontDocs) {
		if (!doc) continue;
		if (!doc._id) { byBaseId.set(Symbol('no-id'), doc); continue; }
		const isDraft = doc._id.startsWith('drafts.');
		const baseId = isDraft ? doc._id.slice('drafts.'.length) : doc._id;
		if (isDraft || !byBaseId.has(baseId)) byBaseId.set(baseId, doc);
	}
	return [...byBaseId.values()];
}

/**
 * Works out which languages a family supports.
 *
 * Uses the INTERSECTION of the styles' character sets: a language is only claimed if every style can
 * set it, which is the defensible claim for a family sold as a whole.
 *
 * Styles with no stored character set are excluded and reported rather than silently ignored — one
 * unprocessed style would otherwise narrow the result with no visible cause.
 *
 * @param {object[]} fontDocs - font documents projected with `_id` and `characterSet.chars`
 * @returns {{languages: string[], stylesUsed: number, stylesMissing: string[], total: number}}
 */
export function resolveLanguages(fontDocs = []) {
	const docs = dedupeFontDocs(fontDocs);
	const withChars = [];
	const stylesMissing = [];

	for (const doc of docs) {
		const chars = doc?.characterSet?.chars;
		if (Array.isArray(chars) && chars.length) withChars.push(chars);
		else stylesMissing.push(doc?.title || doc?._id || 'unknown');
	}

	if (!withChars.length) {
		return { languages: [], stylesUsed: 0, stylesMissing, total: docs.length };
	}

	const covered = intersectCodepoints(withChars);
	const languages = detectLanguages(covered).map((l) => l.name);
	return { languages, stylesUsed: withChars.length, stylesMissing, total: docs.length };
}

/**
 * Builds the Sanity patch for a resolved language list, in whichever shape the studio stores it.
 *
 * `field` writes an array of names — the preferred shape, countable and diffable.
 * `string` writes a comma-separated string, for studios still on a plain text field.
 * `metadataRow` upserts a row in an existing `metadata` array, leaving every other row untouched —
 * for studios that keep languages alongside credits.
 *
 * @param {string[]} languages
 * @param {{type?: 'field'|'string'|'metadataRow', name?: string, key?: string}} write
 * @param {object} currentDoc - the document being patched, needed to preserve other metadata rows
 * @returns {object} a patch object to pass to `patch.execute([{ set: … }])`
 */
export function buildLanguagePatch(languages, write = {}, currentDoc = {}) {
	const { type = 'field', name = 'languages', key = 'Languages' } = write;

	if (type === 'string') return { [name]: languages.join(', ') };

	if (type === 'metadataRow') {
		const rows = Array.isArray(currentDoc.metadata) ? currentDoc.metadata : [];
		const idx = rows.findIndex((r) => String(r?.key || '').trim().toLowerCase() === key.toLowerCase());
		const row = { _key: `lang-${key.toLowerCase()}`, key, value: languages.join(', ') };
		const next = [...rows];
		if (idx === -1) next.unshift(row);
		else next[idx] = { ...rows[idx], ...row, _key: rows[idx]._key || row._key };
		return { metadata: next };
	}

	return { [name]: languages };
}

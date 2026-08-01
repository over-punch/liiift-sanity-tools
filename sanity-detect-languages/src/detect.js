// detect.js — language-support detection from a font's codepoints, using vendored Hyperglot data.
//
// Pure, dependency-free (imports only the vendored JSON). Given the set of codepoints a font/typeface
// covers, returns the languages it supports at the "base" level (all required base characters present).
//
// Data: Hyperglot (github.com/rosettatype/hyperglot, Apache-2.0) — see ./data/orthographies.json + NOTICE.
import orthographyData from './data/orthographies.json';

/** Hyperglot version + counts the data was generated from. */
export const hyperglotMeta = orthographyData._meta;

/**
 * Orthographies whose required base characters are all present in `codepoints`.
 * @param {Set<number>|number[]} codepoints - codepoints the font covers
 * @param {{requireMarks?: boolean}} [opts] - also require the orthography's combining marks
 * @returns {Array} matching orthography records
 */
export function detectOrthographies(codepoints, opts = {}) {
	const { requireMarks = false } = opts;
	const have = codepoints instanceof Set ? codepoints : new Set(codepoints);
	const results = [];
	for (const o of orthographyData.orthographies) {
		if (!o.base.every((cp) => have.has(cp))) continue;
		if (requireMarks && o.marks.length && !o.marks.every((cp) => have.has(cp))) continue;
		results.push(o);
	}
	return results;
}

/**
 * Deduped list of supported languages (one per language name; primary orthography preferred).
 * @param {Set<number>|number[]} codepoints
 * @param {{requireMarks?: boolean, onlyPrimary?: boolean}} [opts]
 * @returns {Array<{iso:string,name:string,script:string,status:string,autonym:string|null}>}
 */
export function detectLanguages(codepoints, opts = {}) {
	const { onlyPrimary = false } = opts;
	const orths = detectOrthographies(codepoints, opts).filter((o) => !onlyPrimary || o.status === 'primary');
	const byName = new Map();
	for (const o of orths) {
		const prev = byName.get(o.name);
		if (!prev || (o.status === 'primary' && prev.status !== 'primary')) byName.set(o.name, o);
	}
	return [...byName.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

/** Intersection of several codepoint arrays — languages EVERY style must support. */
export function intersectCodepoints(arrays) {
	const nonEmpty = (arrays || []).filter((a) => Array.isArray(a) && a.length);
	if (!nonEmpty.length) return new Set();
	let inter = new Set(nonEmpty[0]);
	for (let i = 1; i < nonEmpty.length; i++) {
		const s = new Set(nonEmpty[i]);
		inter = new Set([...inter].filter((cp) => s.has(cp)));
	}
	return inter;
}

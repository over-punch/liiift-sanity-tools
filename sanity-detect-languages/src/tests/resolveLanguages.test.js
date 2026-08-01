// Tests for resolveLanguages / buildLanguagePatch — intersection semantics, missing-charset reporting, patch shapes
import { describe, it, expect } from 'vitest';

import { resolveLanguages, buildLanguagePatch, dedupeFontDocs } from '../resolveLanguages.js';

/** Codepoints for a string, as stored on font.characterSet.chars */
const cps = (s) => [...s].map((c) => c.codePointAt(0));
/** Plain ASCII — enough for a handful of orthographies (Afar, Ainu, …), not for accented ones */
const ASCII = cps('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,;:!?\'"-');
/** Full Latin-1 — detects 233 languages, including Spanish. Note it does NOT satisfy English, whose
 *  Hyperglot orthography needs characters beyond this range; a useful reminder that these are real
 *  orthography requirements, not a guess at "looks Latin". */
const LATIN1 = Array.from({ length: 0xff - 0x20 + 1 }, (_, i) => i + 0x20);
const LATIN = LATIN1;
/** Builds a font document with a character set */
const font = (id, chars = LATIN, over = {}) => ({ _id: id, title: id, characterSet: { chars }, ...over });

describe('dedupeFontDocs', () => {
	it('prefers the draft over its published copy', () => {
		const out = dedupeFontDocs([font('a'), { ...font('drafts.a'), title: 'draft' }]);
		expect(out).toHaveLength(1);
		expect(out[0]._id).toBe('drafts.a');
	});

	it('keeps distinct fonts and drops nullish entries', () => {
		expect(dedupeFontDocs([font('a'), font('b'), null, undefined])).toHaveLength(2);
	});
});

describe('resolveLanguages', () => {
	it('detects languages from a Latin-1 character set', () => {
		const { languages, stylesUsed } = resolveLanguages([font('a')]);
		expect(stylesUsed).toBe(1);
		expect(languages.length).toBeGreaterThan(100);
		expect(languages).toContain('Spanish');
	});

	it('intersects across styles — a language only counts if every style covers it', () => {
		// The accented style supports Spanish; the ASCII-only style does not, so the family cannot claim it.
		const both = resolveLanguages([font('rich', LATIN1), font('plain', ASCII)]).languages;
		const richOnly = resolveLanguages([font('rich', LATIN1)]).languages;
		expect(richOnly.length).toBeGreaterThan(both.length);
		expect(richOnly).toContain('Spanish');
		expect(both).not.toContain('Spanish');
	});

	it('reports styles with no character set instead of silently narrowing', () => {
		const { stylesUsed, stylesMissing, total } = resolveLanguages([
			font('a'),
			{ _id: 'b', title: 'Broken Style' },
			{ _id: 'c', title: 'Empty', characterSet: { chars: [] } },
		]);
		expect(stylesUsed).toBe(1);
		expect(total).toBe(3);
		expect(stylesMissing).toEqual(['Broken Style', 'Empty']);
	});

	it('returns nothing when no style has a character set', () => {
		const out = resolveLanguages([{ _id: 'a', title: 'a' }]);
		expect(out).toMatchObject({ languages: [], stylesUsed: 0 });
	});

	it('handles no fonts at all', () => {
		expect(resolveLanguages([])).toMatchObject({ languages: [], stylesUsed: 0, total: 0 });
	});
});

describe('buildLanguagePatch', () => {
	const langs = ['English', 'French'];

	it('writes an array to the named field by default', () => {
		expect(buildLanguagePatch(langs, {}, {})).toEqual({ languages: ['English', 'French'] });
		expect(buildLanguagePatch(langs, { type: 'field', name: 'supported' }, {})).toEqual({ supported: langs });
	});

	it('writes a comma-separated string when asked', () => {
		expect(buildLanguagePatch(langs, { type: 'string', name: 'languages' }, {})).toEqual({ languages: 'English, French' });
	});

	it('upserts a metadata row without disturbing the others', () => {
		const doc = { metadata: [
			{ _key: 'a', key: 'Designers', value: 'Someone' },
			{ _key: 'b', key: 'Languages', value: 'stale' },
		] };
		const patch = buildLanguagePatch(langs, { type: 'metadataRow', key: 'Languages' }, doc);
		expect(patch.metadata).toHaveLength(2);
		expect(patch.metadata[0]).toMatchObject({ key: 'Designers', value: 'Someone' });
		expect(patch.metadata[1]).toMatchObject({ key: 'Languages', value: 'English, French', _key: 'b' });
	});

	it('adds the metadata row when absent, keeping existing rows', () => {
		const doc = { metadata: [{ _key: 'a', key: 'Designers', value: 'Someone' }] };
		const patch = buildLanguagePatch(langs, { type: 'metadataRow' }, doc);
		expect(patch.metadata).toHaveLength(2);
		expect(patch.metadata.find((r) => r.key === 'Designers')).toBeTruthy();
	});

	it('copes with a document that has no metadata array', () => {
		expect(buildLanguagePatch(langs, { type: 'metadataRow' }, {}).metadata).toHaveLength(1);
	});
});

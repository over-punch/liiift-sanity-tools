// Studio document action that fills a typeface's supported-languages list from its fonts' character sets.

import { useState } from 'react';
import { useClient, useDocumentOperation } from 'sanity';
import { useToast } from '@sanity/ui';
import { resolveLanguages, buildLanguagePatch } from './resolveLanguages.js';
import { hyperglotMeta } from './detect.js';

/**
 * Builds the "Detect languages" document action for a studio.
 *
 * Reads the codepoints already stored on each linked font (`characterSet.chars`) — no font parsing —
 * and intersects them, so a language is only claimed if every style can set it.
 *
 * @param {object} [options]
 * @param {string} [options.documentType] - document type to attach to (default 'typeface')
 * @param {string} [options.fontsPath] - dot path to the font reference array (default 'styles.fonts')
 * @param {{type?: 'field'|'string'|'metadataRow', name?: string, key?: string}} [options.write]
 *   Where to store the result. `field` (default) writes an array of names to `options.write.name`;
 *   `string` writes a comma-separated string; `metadataRow` upserts a row in the `metadata` array.
 *   Point this at the field the SITE renders — writing to a notes field would overwrite editorial copy.
 * @returns {function} a Sanity document action
 */
export function createDetectLanguagesAction({
	documentType = 'typeface',
	fontsPath = 'styles.fonts',
	write = { type: 'field', name: 'languages' },
} = {}) {
	return function DetectLanguagesAction(props) {
		const { id, type, draft, published, onComplete } = props;
		const client = useClient({ apiVersion: '2023-03-12' });
		const { patch } = useDocumentOperation(id, type);
		const toast = useToast();
		const [running, setRunning] = useState(false);

		if (type !== documentType) return null;

		return {
			label: running ? 'Detecting languages…' : `Detect languages (Hyperglot ${hyperglotMeta?.hyperglotVersion || ''})`.trim(),
			disabled: running,
			onHandle: async () => {
				setRunning(true);
				try {
					const doc = draft || published;
					const refs = fontsPath.split('.').reduce((acc, key) => acc?.[key], doc) || [];
					const fontIds = refs.map((r) => r?._ref).filter(Boolean);

					if (!fontIds.length) {
						toast.push({ status: 'warning', title: 'No fonts', description: `This ${documentType} has no fonts in ${fontsPath}.` });
						return;
					}

					// Unpublished styles only exist as drafts, so look for both ids.
					const draftIds = fontIds.map((fid) => (fid.startsWith('drafts.') ? fid : `drafts.${fid}`));
					const fontDocs = await client.fetch(
						'*[_type == "font" && (_id in $ids || _id in $draftIds)]{ _id, title, characterSet }',
						{ ids: fontIds, draftIds }
					);

					const { languages, stylesUsed, stylesMissing, total } = resolveLanguages(fontDocs);

					if (!languages.length) {
						toast.push({
							status: 'warning',
							title: 'No languages detected',
							description: stylesUsed
								? 'The styles share no complete orthography.'
								: 'None of the styles have a stored character set yet — re-save the fonts to generate it.',
						});
						return;
					}

					patch.execute([{ set: buildLanguagePatch(languages, write, doc) }]);

					toast.push({
						status: 'success',
						title: `Detected ${languages.length} languages`,
						description: [
							`From ${stylesUsed} of ${total} styles · Hyperglot ${hyperglotMeta?.hyperglotVersion || '—'}.`,
							// Surfaced rather than silently narrowing the result.
							stylesMissing.length ? `Skipped ${stylesMissing.length} style(s) with no character set: ${stylesMissing.slice(0, 3).join(', ')}${stylesMissing.length > 3 ? '…' : ''}.` : '',
							'Review, then Publish.',
						].filter(Boolean).join(' '),
					});
				} catch (e) {
					toast.push({ status: 'error', title: 'Detection failed', description: (e && e.message) || String(e) });
				} finally {
					setRunning(false);
					onComplete();
				}
			},
		};
	};
}

// @liiift-studio/sanity-detect-languages — shared language detection for typeface documents.

export { createDetectLanguagesAction } from './createDetectLanguagesAction.jsx';
export { resolveLanguages, buildLanguagePatch, dedupeFontDocs } from './resolveLanguages.js';
export { detectLanguages, detectOrthographies, intersectCodepoints, hyperglotMeta } from './detect.js';

/* ═══════════════════════════════════════════════════════════════════════════
   PRUDENT REDACT - tools-catalog.js
   Single source of truth for the Document Operations toolkit. The home page
   and the tool workspace both read from here, so a tool cannot appear in the
   directory without a workspace behind it.
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

const TOOL_ICONS = {
  split    : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 00-2 2v4M16 3h3a2 2 0 012 2v4M8 21H5a2 2 0 01-2-2v-4M16 21h3a2 2 0 002-2v-4M3 12h18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  merge    : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M8 6H5a2 2 0 00-2 2v8a2 2 0 002 2h3M16 6h3a2 2 0 012 2v8a2 2 0 01-2 2h-3M12 3v18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  organize : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.7"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.7"/><path d="M14 17.5h7M17.5 14v7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  extract  : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 3v5h5M12 17v-6M9.5 13.5L12 11l2.5 2.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  remove   : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 3v5h5M9 14h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  rotate   : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-3.2-6.9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M21 3v5h-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  validate : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.7"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  metadata : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.7"/><path d="M20 20l-3.5-3.5M11 8v3.5M11 14.5v.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  compare  : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M12 2v20" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
};

const TOOLS = {
  split: {
    id: 'split', name: 'Split PDF', icon: TOOL_ICONS.split,
    title: 'Split PDF',
    intro: 'Create controlled PDF outputs using page ranges, fixed page groups, or named document sections.',
    what: 'Create controlled outputs using page ranges, fixed page groups, or named document sections.',
    when: ['Large case packs', 'Invoice batches', 'Employee document packages'],
    inputs: 1,
  },
  merge: {
    id: 'merge', name: 'Merge PDF', icon: TOOL_ICONS.merge,
    title: 'Merge PDF',
    intro: 'Combine several source documents into a single ordered output document.',
    what: 'Combine several source documents into a single ordered output document.',
    when: ['Case file assembly', 'Evidence bundles', 'Board packs'],
    inputs: 'many',
  },
  organize: {
    id: 'organize', name: 'Page Organizer', icon: TOOL_ICONS.organize,
    title: 'Page Organizer',
    intro: 'Reorder, rotate, and remove pages in a single workspace, then produce one revised document.',
    what: 'Reorder, rotate, and remove pages in one place, then produce a single revised document.',
    when: ['Scanned document cleanup', 'Submission preparation', 'Pack correction'],
    inputs: 1,
  },
  extract: {
    id: 'extract', name: 'Extract Pages', icon: TOOL_ICONS.extract,
    title: 'Extract Pages',
    intro: 'Produce a new document containing only the pages you select, in source order or in an order you define.',
    what: 'Produce a new document containing only the pages you select, in source or custom order.',
    when: ['Disclosure sets', 'Selected exhibits', 'Single-document extracts'],
    inputs: 1,
  },
  remove: {
    id: 'remove', name: 'Remove Pages', icon: TOOL_ICONS.remove,
    title: 'Remove Pages',
    intro: 'Produce a revised document with selected pages excluded. The source document is never modified.',
    what: 'Produce a revised document with selected pages excluded, leaving the source unchanged.',
    when: ['Removing blank pages', 'Excluding out-of-scope content', 'Separator page cleanup'],
    inputs: 1,
  },
  rotate: {
    id: 'rotate', name: 'Rotate Pages', icon: TOOL_ICONS.rotate,
    title: 'Rotate Pages',
    intro: 'Correct page orientation across the whole document, odd or even pages, or a specific page range.',
    what: 'Correct orientation across all pages, odd or even pages, or a specific page range.',
    when: ['Scanned document orientation', 'Mixed landscape pages', 'Fax and intake corrections'],
    inputs: 1,
  },
  validate: {
    id: 'validate', name: 'PDF Validation', icon: TOOL_ICONS.validate,
    title: 'PDF Validation',
    intro: 'Check a document before it enters a process: file signature, structure, encryption, page count, and fingerprint.',
    what: 'Check file signature, structure, encryption, page count, and fingerprint before processing.',
    when: ['Document handoff validation', 'Intake quality checks', 'Batch pre-flight'],
    inputs: 'many',
  },
  metadata: {
    id: 'metadata', name: 'Metadata Inspector', icon: TOOL_ICONS.metadata,
    title: 'Metadata Inspector',
    intro: 'Inspect the document properties a PDF carries, and produce a metadata-cleaned copy.',
    what: 'Inspect the document properties a PDF carries, and produce a metadata-cleaned copy.',
    when: ['Pre-release checks', 'Author and producer removal', 'Document handoff'],
    inputs: 1,
  },
  compare: {
    id: 'compare', name: 'Document Compare', icon: TOOL_ICONS.compare,
    title: 'Document Compare',
    intro: 'Compare a base document against a revised document on structure, size, metadata, and fingerprint.',
    what: 'Compare a base and a revised document on structure, size, metadata, and fingerprint.',
    when: ['Output verification', 'Version checks', 'Redaction confirmation'],
    inputs: 2,
  },
};

const TOOL_BANDS = [
  {
    name : 'Prepare',
    desc : 'Assemble and restructure source material before it enters a controlled process.',
    tools: ['split', 'merge', 'organize'],
  },
  {
    name : 'Transform',
    desc : 'Produce a revised document from a source document. The source is never modified.',
    tools: ['extract', 'remove', 'rotate'],
  },
  {
    name : 'Validate',
    desc : 'Confirm what a document actually is, what it carries, and how it differs from another.',
    tools: ['validate', 'metadata', 'compare'],
  },
];

/* Presets configure a tool. They never bypass validation and never assume
   anything about the content of a document. */
const TOOL_PRESETS = {
  split: [
    { id: 'invoice-batch', name: 'Invoice batch split',
      desc: 'Split a batched scan into fixed page groups, one document per invoice.',
      apply: { strategy: 'everyN', n: 5 } },
    { id: 'case-sections', name: 'Legal case sections',
      desc: 'Split a case pack into named sections using explicit page ranges.',
      apply: { strategy: 'groups' } },
  ],
  extract: [
    { id: 'employee-pack', name: 'Employee pack extraction',
      desc: 'Extract a defined range of pages into a single document, in source order.',
      apply: { order: 'source' } },
  ],
  rotate: [
    { id: 'scan-orientation', name: 'Scanned document orientation',
      desc: 'Rotate a selected page range 90 degrees clockwise to correct sideways scans.',
      apply: { scope: 'selection', degrees: 90 } },
  ],
  validate: [
    { id: 'handoff', name: 'Document handoff validation',
      desc: 'Validate every selected document and export the validation report as JSON.',
      apply: {} },
  ],
};

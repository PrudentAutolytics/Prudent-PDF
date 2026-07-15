/* ═══════════════════════════════════════════════════════════════════════════
   PRUDENT REDACT - pdfops.js
   Document Operations engine.

   PROCESSING MODEL
   All operations in this module run entirely inside the browser using the
   locally vendored pdf-lib build (/vendor/pdf-lib.min.js). Source documents
   are never uploaded, never sent to a third-party viewer or conversion
   service, and never leave the user's machine during a document operation.
   This is a deliberate control, not an implementation shortcut.

   IMMUTABLE SOURCE
   No operation modifies the file the user selected. Every operation produces
   a new output document with a deterministic, readable name.

   HONEST CAPABILITY
   Where a capability cannot be delivered reliably (for example, text-level
   comparison on a scanned document with no text layer), the module reports
   that it is unavailable rather than returning a fabricated result.
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

const PDFOps = (() => {

  const LIMITS = Object.freeze({
    MAX_FILE_BYTES   : 100 * 1024 * 1024,  // 100 MB per document
    MAX_BATCH_FILES  : 20,                  // batch operation ceiling
    MAX_BATCH_BYTES  : 250 * 1024 * 1024,  // combined batch ceiling
    MAX_MERGE_FILES  : 20,
    MAX_OP_RECORDS   : 100,
  });

  const RECORD_KEY = 'prudent.opRecords';

  /* ── pdf-lib accessor ─────────────────────────────────────────────────── */
  function lib() {
    if (!window.PDFLib) {
      throw new Error('The document engine did not load. Refresh the page and try again.');
    }
    return window.PDFLib;
  }

  /* ── Formatting ───────────────────────────────────────────────────────── */
  function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  /* Strip the extension so outputs can be named from the source. */
  function baseName(fileName) {
    return String(fileName || 'document').replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80);
  }

  /* ── Integrity ────────────────────────────────────────────────────────── */

  /**
   * SHA-256 fingerprint of a byte array, using the browser's native
   * SubtleCrypto. Requires a secure context (https or localhost). If the
   * platform does not expose it, we say so rather than substituting a
   * weaker hash and calling it a fingerprint.
   */
  async function sha256(bytes) {
    if (!window.crypto?.subtle) return null;
    const digest = await crypto.subtle.digest('SHA-256', bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function shortHash(hash) {
    if (!hash) return 'Unavailable';
    return hash.slice(0, 8) + '...' + hash.slice(-8);
  }

  /* ── Source document loading and validation ───────────────────────────── */

  /**
   * Read a File into a validated source document object.
   * Never throws for a bad document: returns a source with valid=false and a
   * populated validation report, so the calling workspace can explain the
   * problem rather than showing a stack trace.
   */
  async function loadSource(file) {
    const src = {
      file,
      name       : file.name,
      size       : file.size,
      sizeLabel  : formatBytes(file.size),
      bytes      : null,
      sha256     : null,
      pageCount  : null,
      pdfVersion : null,
      encrypted  : false,
      valid      : false,
      validation : null,
      doc        : null,
    };

    const checks = [];
    const fail = (label, detail) => { checks.push({ label, status: 'INVALID', detail }); };
    const pass = (label, detail) => { checks.push({ label, status: 'PASS', detail }); };
    const warn = (label, detail) => { checks.push({ label, status: 'ATTENTION', detail }); };

    /* Size gate first: reading a 2 GB file into memory helps nobody. */
    if (file.size > LIMITS.MAX_FILE_BYTES) {
      fail('File size', `${formatBytes(file.size)} exceeds the ${formatBytes(LIMITS.MAX_FILE_BYTES)} document operation limit.`);
      src.validation = buildReport(src, checks, 'INVALID');
      return src;
    }
    if (file.size === 0) {
      fail('File size', 'The file is empty (0 bytes).');
      src.validation = buildReport(src, checks, 'INVALID');
      return src;
    }
    pass('File size', formatBytes(file.size));

    /* Read bytes. */
    try {
      src.bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      fail('File readable', 'The file could not be read from disk.');
      src.validation = buildReport(src, checks, 'INVALID');
      return src;
    }

    /* PDF signature: the first five bytes must be %PDF-. A .pdf extension
       proves nothing, so we check the actual content. */
    const header = new TextDecoder('latin1').decode(src.bytes.slice(0, 1024));
    if (!header.startsWith('%PDF-')) {
      fail('PDF file signature', 'The file does not begin with the %PDF- signature and is not a PDF document.');
      src.validation = buildReport(src, checks, 'INVALID');
      return src;
    }
    const versionMatch = header.match(/^%PDF-(\d+\.\d+)/);
    src.pdfVersion = versionMatch ? versionMatch[1] : null;
    pass('PDF file signature', src.pdfVersion ? `Valid, PDF ${src.pdfVersion}` : 'Valid');

    /* MIME cross-check: report a mismatch, do not fail on it. Browsers and
       operating systems disagree about PDF MIME types often enough that a
       hard failure here would produce false negatives. */
    if (file.type && file.type !== 'application/pdf') {
      warn('Content type', `The browser reported "${file.type}" rather than application/pdf. The file signature is valid, so the document is being treated as a PDF.`);
    } else {
      pass('Content type', 'application/pdf');
    }

    /* Structural parse. */
    const { PDFDocument } = lib();
    try {
      src.doc = await PDFDocument.load(src.bytes, { ignoreEncryption: true, updateMetadata: false });
      src.pageCount = src.doc.getPageCount();
      pass('Document structure', 'The document parsed without structural errors.');
    } catch (err) {
      fail('Document structure', normaliseParseError(err));
      src.validation = buildReport(src, checks, 'INVALID');
      return src;
    }

    /* Encryption. pdf-lib exposes this after a load with ignoreEncryption.
       An encrypted document can be inspected but cannot be reliably
       transformed, so it is ATTENTION rather than PASS. */
    src.encrypted = !!src.doc.isEncrypted;
    if (src.encrypted) {
      warn('Encryption', 'The document is encrypted or password protected. Page operations may fail or produce an unusable output.');
    } else {
      pass('Encryption', 'Not detected');
    }

    /* Page count. */
    if (src.pageCount === 0) {
      fail('Page count', 'The document contains zero pages.');
      src.validation = buildReport(src, checks, 'INVALID');
      return src;
    }
    pass('Page count', `${src.pageCount} page${src.pageCount === 1 ? '' : 's'}`);

    src.sha256 = await sha256(src.bytes);
    if (src.sha256) pass('Document fingerprint', shortHash(src.sha256));
    else warn('Document fingerprint', 'SHA-256 is unavailable in this browser context. Integrity comparison is disabled.');

    const overall = checks.some(c => c.status === 'INVALID') ? 'INVALID'
                  : checks.some(c => c.status === 'ATTENTION') ? 'ATTENTION'
                  : 'VALID';
    src.valid = overall !== 'INVALID';
    src.validation = buildReport(src, checks, overall);
    return src;
  }

  /* pdf-lib parse errors are developer-facing. Translate the ones a user can
     actually act on, and pass the rest through in a contained form. */
  function normaliseParseError(err) {
    const m = String(err?.message || err);
    if (/encrypt/i.test(m))            return 'The document is encrypted and cannot be parsed without the password.';
    if (/Failed to parse|Expected/i.test(m)) return 'The document structure is malformed and could not be parsed.';
    if (/trailer|xref/i.test(m))       return 'The document cross-reference table is damaged. The file may be truncated or corrupted.';
    return 'The document could not be parsed. It may be corrupted or use an unsupported structure.';
  }

  function buildReport(src, checks, overall) {
    return {
      schema     : 'prudent.pdf.validation/1',
      generatedAt: new Date().toISOString(),
      document   : {
        name       : src.name,
        size       : src.size,
        sizeLabel  : formatBytes(src.size),
        pageCount  : src.pageCount,
        pdfVersion : src.pdfVersion,
        sha256     : src.sha256,
      },
      checks,
      overall,
    };
  }

  /* ── Page selection parsing ───────────────────────────────────────────── */

  /**
   * Parse a page selection such as "1,3-7,10" against a document of
   * totalPages. Returns the resolved pages plus every problem found, so the
   * workspace can show precise validation instead of a single vague error.
   *
   * preserveOrder=true  returns pages in ascending document order.
   * preserveOrder=false returns pages in the order the user entered them,
   *                     which is what makes "10,1,5" a meaningful selection.
   */
  function parsePageSelection(input, totalPages, preserveOrder = true) {
    const result = {
      pages       : [],        // 1-based, resolved
      invalid     : [],        // tokens that are not page references
      outOfRange  : [],        // numbers outside 1..totalPages
      duplicates  : [],        // pages referenced more than once
      valid       : false,
      summary     : '',
    };

    const raw = String(input || '').trim();
    if (!raw) { result.summary = 'No pages selected.'; return result; }

    const seen = new Set();
    const ordered = [];

    for (const token of raw.split(',').map(t => t.trim()).filter(Boolean)) {
      const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
      const single = token.match(/^(\d+)$/);

      if (range) {
        let a = parseInt(range[1], 10);
        let b = parseInt(range[2], 10);
        if (a > b) [a, b] = [b, a];   // tolerate "9-3", the intent is obvious
        for (let p = a; p <= b; p++) {
          if (p < 1 || p > totalPages) { if (!result.outOfRange.includes(p)) result.outOfRange.push(p); continue; }
          if (seen.has(p)) { if (!result.duplicates.includes(p)) result.duplicates.push(p); continue; }
          seen.add(p); ordered.push(p);
        }
      } else if (single) {
        const p = parseInt(single[1], 10);
        if (p < 1 || p > totalPages) { if (!result.outOfRange.includes(p)) result.outOfRange.push(p); continue; }
        if (seen.has(p)) { if (!result.duplicates.includes(p)) result.duplicates.push(p); continue; }
        seen.add(p); ordered.push(p);
      } else {
        result.invalid.push(token);
      }
    }

    result.pages = preserveOrder ? [...ordered].sort((a, b) => a - b) : ordered;
    result.valid = result.pages.length > 0 && result.invalid.length === 0 && result.outOfRange.length === 0;

    const parts = [];
    if (result.pages.length)      parts.push(`${result.pages.length} page${result.pages.length === 1 ? '' : 's'} selected`);
    if (result.duplicates.length) parts.push(`${result.duplicates.length} duplicate reference${result.duplicates.length === 1 ? '' : 's'} ignored`);
    if (result.outOfRange.length) parts.push(`${result.outOfRange.length} page reference${result.outOfRange.length === 1 ? '' : 's'} outside the document`);
    if (result.invalid.length)    parts.push(`${result.invalid.length} entr${result.invalid.length === 1 ? 'y is' : 'ies are'} not a valid page reference`);
    result.summary = parts.join('. ') + '.';

    return result;
  }

  /* Compact "1-3, 7, 10-12" label from a page array. */
  function describePages(pages) {
    if (!pages.length) return 'None';
    const sorted = [...pages].sort((a, b) => a - b);
    const runs = [];
    let start = sorted[0], prev = sorted[0];
    for (let i = 1; i <= sorted.length; i++) {
      const p = sorted[i];
      if (p !== prev + 1) {
        runs.push(start === prev ? `${start}` : `${start}-${prev}`);
        start = p;
      }
      prev = p;
    }
    return runs.join(', ');
  }

  /* ── Output construction ──────────────────────────────────────────────── */

  /**
   * Every operation funnels through here. Copying pages into a brand new
   * PDFDocument (rather than mutating the source) is what guarantees the
   * immutable-source promise structurally, not just by convention.
   */
  async function buildOutput(sourceDoc, pageIndices, fileName) {
    const { PDFDocument } = lib();
    const out = await PDFDocument.create();
    const copied = await out.copyPages(sourceDoc, pageIndices);
    copied.forEach(p => out.addPage(p));
    return finalise(out, fileName);
  }

  async function finalise(pdfDoc, fileName) {
    const bytes = await pdfDoc.save({ useObjectStreams: true });
    const hash  = await sha256(bytes);
    return {
      name      : fileName,
      bytes,
      size      : bytes.length,
      sizeLabel : formatBytes(bytes.length),
      pageCount : pdfDoc.getPageCount(),
      sha256    : hash,
    };
  }

  /* ── SPLIT ────────────────────────────────────────────────────────────── */

  /**
   * strategy:
   *   { type: 'ranges',   ranges: '1-5, 6-10, 11-20' }
   *   { type: 'everyN',   n: 5 }
   *   { type: 'individual', pages: '1,4,8' }
   *   { type: 'groups',   groups: [{ label: 'Invoice 001', range: '1-3' }, ...] }
   *
   * Returns { plan, errors } from planSplit so the workspace can show the
   * expected output count BEFORE anything is processed, then execute().
   */
  function planSplit(src, strategy) {
    const total = src.pageCount;
    const plan  = [];
    const errors = [];
    const base  = baseName(src.name);

    if (strategy.type === 'ranges') {
      const tokens = String(strategy.ranges || '').split(',').map(t => t.trim()).filter(Boolean);
      if (!tokens.length) errors.push('Enter at least one page range, for example 1-5, 6-10.');
      tokens.forEach((token, i) => {
        const sel = parsePageSelection(token, total, true);
        if (!sel.valid) { errors.push(`"${token}" is not a valid page range for this document.`); return; }
        plan.push({
          label : `Pages ${describePages(sel.pages)}`,
          pages : sel.pages,
          name  : `${base}-part-${String(i + 1).padStart(2, '0')}.pdf`,
        });
      });

    } else if (strategy.type === 'everyN') {
      const n = parseInt(strategy.n, 10);
      if (!n || n < 1)      errors.push('Enter how many pages each output document should contain.');
      else if (n >= total)  errors.push(`The document has ${total} pages. Enter a group size smaller than ${total}.`);
      else {
        for (let start = 1; start <= total; start += n) {
          const end = Math.min(start + n - 1, total);
          const pages = [];
          for (let p = start; p <= end; p++) pages.push(p);
          const idx = plan.length + 1;
          plan.push({
            label : `Pages ${start}-${end}`,
            pages,
            name  : `${base}-part-${String(idx).padStart(2, '0')}.pdf`,
          });
        }
      }

    } else if (strategy.type === 'individual') {
      const sel = parsePageSelection(strategy.pages, total, true);
      if (!sel.valid) errors.push(sel.summary);
      else sel.pages.forEach(p => plan.push({
        label : `Page ${p}`,
        pages : [p],
        name  : `${base}-page-${String(p).padStart(2, '0')}.pdf`,
      }));

    } else if (strategy.type === 'groups') {
      const groups = (strategy.groups || []).filter(g => (g.label || '').trim() || (g.range || '').trim());
      if (!groups.length) errors.push('Define at least one document group.');
      groups.forEach((g, i) => {
        const label = (g.label || '').trim();
        const sel   = parsePageSelection(g.range, total, true);
        if (!label)     { errors.push(`Group ${i + 1} needs a name.`); return; }
        if (!sel.valid) { errors.push(`Group "${label}" has an invalid page range: ${sel.summary}`); return; }
        plan.push({
          label : `${label} (pages ${describePages(sel.pages)})`,
          pages : sel.pages,
          name  : `${base}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`,
        });
      });
    } else {
      errors.push('Select a split strategy.');
    }

    /* Deterministic names must also be unique. Two groups called "Invoice"
       would otherwise silently overwrite each other on download. */
    const used = new Map();
    plan.forEach(item => {
      const count = (used.get(item.name) || 0) + 1;
      used.set(item.name, count);
      if (count > 1) item.name = item.name.replace(/\.pdf$/i, `-${count}.pdf`);
    });

    return { plan, errors };
  }

  async function executeSplit(src, plan) {
    const outputs = [];
    for (const item of plan) {
      const out = await buildOutput(src.doc, item.pages.map(p => p - 1), item.name);
      out.label = item.label;
      outputs.push(out);
    }
    await recordOperation({
      operation   : 'PDF_SPLIT',
      source      : src,
      outputs,
      parameters  : { outputs: plan.length, groups: plan.map(p => p.label) },
      pagesBefore : src.pageCount,
      pagesAfter  : outputs.reduce((s, o) => s + o.pageCount, 0),
    });
    return outputs;
  }

  /* ── MERGE ────────────────────────────────────────────────────────────── */

  async function executeMerge(sources, outputName) {
    const { PDFDocument } = lib();
    const out = await PDFDocument.create();
    for (const src of sources) {
      const copied = await out.copyPages(src.doc, src.doc.getPageIndices());
      copied.forEach(p => out.addPage(p));
    }
    const name = ensurePdfExt(outputName || 'merged-document');
    const result = await finalise(out, name);
    await recordOperation({
      operation   : 'PDF_MERGE',
      sources,
      outputs     : [result],
      parameters  : { order: sources.map(s => s.name), documents: sources.length },
      pagesBefore : sources.reduce((s, x) => s + x.pageCount, 0),
      pagesAfter  : result.pageCount,
    });
    return result;
  }

  /* ── EXTRACT ──────────────────────────────────────────────────────────── */

  async function executeExtract(src, pages, { customOrder = false } = {}) {
    const base = baseName(src.name);
    /* When the user chose a custom page order, the filename must reflect the
       order they entered. Naming a 10,1,5 extraction "pages-1_5_10" would
       misdescribe its own contents. */
    const label = customOrder
      ? pages.join('_')
      : describePages(pages).replace(/[,\s]+/g, '_');
    const name = `${base}-pages-${label}.pdf`.slice(0, 120);
    const out  = await buildOutput(src.doc, pages.map(p => p - 1), name);
    await recordOperation({
      operation   : 'PAGE_EXTRACTION',
      source      : src,
      outputs     : [out],
      parameters  : { pages, order: customOrder ? 'as entered' : 'source order' },
      pagesBefore : src.pageCount,
      pagesAfter  : out.pageCount,
    });
    return out;
  }

  /* ── REMOVE ───────────────────────────────────────────────────────────── */

  async function executeRemove(src, pagesToRemove) {
    const removeSet = new Set(pagesToRemove);
    const keep = [];
    for (let p = 1; p <= src.pageCount; p++) if (!removeSet.has(p)) keep.push(p);
    if (!keep.length) throw new Error('This selection removes every page. The output document would contain no pages.');

    const name = `${baseName(src.name)}-revised.pdf`;
    const out  = await buildOutput(src.doc, keep.map(p => p - 1), name);
    await recordOperation({
      operation   : 'PAGE_REMOVAL',
      source      : src,
      outputs     : [out],
      parameters  : { removed: pagesToRemove, removedCount: pagesToRemove.length },
      pagesBefore : src.pageCount,
      pagesAfter  : out.pageCount,
    });
    return out;
  }

  /* ── ROTATE ───────────────────────────────────────────────────────────── */

  /**
   * scope: { type: 'all' | 'odd' | 'even' | 'selection', selection: '2-12' }
   * degrees: 90 | -90 | 180  (clockwise positive)
   *
   * Rotation is applied relative to each page's existing rotation, so a page
   * already at 90 degrees rotated by 90 lands at 180 rather than being reset.
   */
  function resolveRotationScope(scope, totalPages) {
    if (scope.type === 'all')  { const a = []; for (let p = 1; p <= totalPages; p++) a.push(p); return { pages: a, valid: true, summary: `All ${totalPages} pages` }; }
    if (scope.type === 'odd')  { const a = []; for (let p = 1; p <= totalPages; p += 2) a.push(p); return { pages: a, valid: true, summary: `${a.length} odd pages` }; }
    if (scope.type === 'even') { const a = []; for (let p = 2; p <= totalPages; p += 2) a.push(p); return { pages: a, valid: true, summary: `${a.length} even pages` }; }
    const sel = parsePageSelection(scope.selection, totalPages, true);
    return { pages: sel.pages, valid: sel.valid, summary: sel.valid ? `Pages ${describePages(sel.pages)}` : sel.summary, detail: sel };
  }

  async function executeRotate(src, pages, degrees) {
    const { PDFDocument, degrees: deg } = lib();
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src.doc, src.doc.getPageIndices());
    copied.forEach(p => out.addPage(p));

    const targets = new Set(pages);
    out.getPages().forEach((page, i) => {
      if (!targets.has(i + 1)) return;
      const current = page.getRotation().angle || 0;
      page.setRotation(deg(((current + degrees) % 360 + 360) % 360));
    });

    const name = `${baseName(src.name)}-rotated.pdf`;
    const result = await finalise(out, name);
    await recordOperation({
      operation   : 'PAGE_ROTATION',
      source      : src,
      outputs     : [result],
      parameters  : { pages, degrees, pageCount: pages.length },
      pagesBefore : src.pageCount,
      pagesAfter  : result.pageCount,
    });
    return result;
  }

  /* ── ORGANIZE ─────────────────────────────────────────────────────────── */

  /**
   * The organizer works on a page model, not on the document, so that undo
   * and reset are exact and the source is never touched:
   *   [{ srcPage: 1, rotation: 0 }, ...]
   */
  function initPageModel(src) {
    const model = [];
    const pages = src.doc.getPages();
    for (let i = 0; i < src.pageCount; i++) {
      model.push({ srcPage: i + 1, rotation: pages[i].getRotation().angle || 0 });
    }
    return model;
  }

  async function executeOrganize(src, model) {
    if (!model.length) throw new Error('The revised document would contain no pages.');
    const { PDFDocument, degrees: deg } = lib();
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src.doc, model.map(m => m.srcPage - 1));
    copied.forEach((p, i) => {
      p.setRotation(deg(((model[i].rotation % 360) + 360) % 360));
      out.addPage(p);
    });

    const name = `${baseName(src.name)}-organized.pdf`;
    const result = await finalise(out, name);

    const baseline = initPageModel(src);
    const original = new Set(Array.from({ length: src.pageCount }, (_, i) => i + 1));
    const kept     = new Set(model.map(m => m.srcPage));
    const removed  = [...original].filter(p => !kept.has(p));
    const rotated  = model.filter(m => m.rotation !== (baseline[m.srcPage - 1]?.rotation ?? 0)).map(m => m.srcPage);

    await recordOperation({
      operation   : 'PAGE_ORGANIZATION',
      source      : src,
      outputs     : [result],
      parameters  : { order: model.map(m => m.srcPage), removed, rotated },
      pagesBefore : src.pageCount,
      pagesAfter  : result.pageCount,
    });
    return result;
  }

  /* ── METADATA ─────────────────────────────────────────────────────────── */

  const META_FIELDS = [
    { key: 'title',        label: 'Title',             get: d => d.getTitle() },
    { key: 'author',       label: 'Author',            get: d => d.getAuthor() },
    { key: 'subject',      label: 'Subject',           get: d => d.getSubject() },
    { key: 'keywords',     label: 'Keywords',          get: d => d.getKeywords() },
    { key: 'creator',      label: 'Creator',           get: d => d.getCreator() },
    { key: 'producer',     label: 'Producer',          get: d => d.getProducer() },
    { key: 'creationDate', label: 'Creation date',     get: d => d.getCreationDate() },
    { key: 'modDate',      label: 'Modification date', get: d => d.getModificationDate() },
  ];

  function readMetadata(src) {
    const fields = META_FIELDS.map(f => {
      let value = null;
      try { value = f.get(src.doc); } catch { value = null; }
      if (value instanceof Date) value = isNaN(value) ? null : value.toISOString();
      if (Array.isArray(value)) value = value.join(', ');
      const str = (value === null || value === undefined || value === '') ? null : String(value);
      return { key: f.key, label: f.label, value: str, present: !!str };
    });
    return {
      fields,
      populated  : fields.filter(f => f.present),
      pdfVersion : src.pdfVersion,
      pageCount  : src.pageCount,
      size       : src.size,
      sha256     : src.sha256,
    };
  }

  /**
   * Produce a metadata-cleaned copy. Document properties are a routine leak
   * path: a redacted page is worthless if Author still reads
   * "j.smith@clientfirm.com". This also drops the XMP metadata stream, which
   * many tools leave behind after clearing the document information
   * dictionary.
   */
  async function executeMetadataClean(src) {
    const { PDFDocument, PDFName } = lib();
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src.doc, src.doc.getPageIndices());
    copied.forEach(p => out.addPage(p));

    out.setTitle('');
    out.setAuthor('');
    out.setSubject('');
    out.setKeywords([]);
    out.setCreator('Prudent Redact');
    out.setProducer('Prudent Redact');
    const now = new Date();
    out.setCreationDate(now);
    out.setModificationDate(now);
    try { out.catalog.delete(PDFName.of('Metadata')); } catch { /* XMP stream absent */ }

    const name = `${baseName(src.name)}-metadata-clean.pdf`;
    const result = await finalise(out, name);
    const before = readMetadata(src);
    await recordOperation({
      operation   : 'METADATA_CLEAN',
      source      : src,
      outputs     : [result],
      parameters  : { fieldsCleared: before.populated.map(f => f.label) },
      pagesBefore : src.pageCount,
      pagesAfter  : result.pageCount,
    });
    return result;
  }

  /* ── COMPARE ──────────────────────────────────────────────────────────── */

  /**
   * Compares only what can actually be computed from the two documents.
   * There is no text or visual comparison here, and the report says so
   * explicitly rather than implying a capability the engine does not have.
   */
  function compareDocuments(base, revised) {
    const identical = !!(base.sha256 && revised.sha256 && base.sha256 === revised.sha256);
    const metaBase  = readMetadata(base);
    const metaRev   = readMetadata(revised);

    const metadataDiffs = META_FIELDS.map(f => {
      const a = metaBase.fields.find(x => x.key === f.key)?.value || null;
      const b = metaRev.fields.find(x => x.key === f.key)?.value  || null;
      return { label: f.label, base: a, revised: b, changed: a !== b };
    }).filter(d => d.changed);

    return {
      schema      : 'prudent.pdf.compare/1',
      generatedAt : new Date().toISOString(),
      base    : { name: base.name,    pageCount: base.pageCount,    size: base.size,    sizeLabel: base.sizeLabel,    sha256: base.sha256 },
      revised : { name: revised.name, pageCount: revised.pageCount, size: revised.size, sizeLabel: revised.sizeLabel, sha256: revised.sha256 },
      pageCountDelta : revised.pageCount - base.pageCount,
      sizeDelta      : revised.size - base.size,
      fingerprintMatch : identical,
      metadataDiffs,
      textComparison : {
        available : false,
        note      : 'Text-level comparison is not available in this workspace. The engine reports document structure, size, metadata, and fingerprint differences only.',
      },
    };
  }

  /* ── OPERATION RECORDS ────────────────────────────────────────────────── */

  /**
   * These are LOCAL OPERATION RECORDS held in this browser. They are not
   * server-side audit events and are not immutable. The UI must label them
   * honestly: a record a user can clear from their own devtools is evidence
   * of convenience, not of control.
   */
  async function recordOperation({ operation, source, sources, outputs, parameters, pagesBefore, pagesAfter }) {
    try {
      const srcList = sources || (source ? [source] : []);
      const record = {
        id          : (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
        operation,
        timestamp   : new Date().toISOString(),
        sources     : srcList.map(s => ({ name: s.name, sha256: s.sha256, pageCount: s.pageCount, size: s.size })),
        outputs     : (outputs || []).map(o => ({ name: o.name, sha256: o.sha256, pageCount: o.pageCount, size: o.size })),
        parameters  : parameters || {},
        pagesBefore : pagesBefore ?? null,
        pagesAfter  : pagesAfter  ?? null,
        scope       : 'local',
      };
      const all = getOperationRecords();
      all.unshift(record);
      if (sessionStorage.getItem('pr_privacy_mode') !== '1') localStorage.setItem(RECORD_KEY, JSON.stringify(all.slice(0, LIMITS.MAX_OP_RECORDS)));
      return record;
    } catch {
      return null;  // a full or blocked localStorage must never fail the operation itself
    }
  }

  function getOperationRecords() {
    try { return sessionStorage.getItem('pr_privacy_mode') === '1' ? [] : JSON.parse(localStorage.getItem(RECORD_KEY) || '[]'); } catch { return []; }
  }

  function clearOperationRecords() {
    try { localStorage.removeItem(RECORD_KEY); } catch {}
  }

  const OPERATION_LABELS = {
    PDF_SPLIT          : 'PDF split',
    PDF_MERGE          : 'PDF merge',
    PAGE_EXTRACTION    : 'Page extraction',
    PAGE_REMOVAL       : 'Page removal',
    PAGE_ROTATION      : 'Page rotation',
    PAGE_ORGANIZATION  : 'Page organization',
    METADATA_CLEAN     : 'Metadata cleaning',
    PDF_VALIDATION     : 'PDF validation',
  };

  /* ── DELIVERY ─────────────────────────────────────────────────────────── */

  function ensurePdfExt(name) {
    const clean = String(name || 'document').trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 100);
    return /\.pdf$/i.test(clean) ? clean : clean + '.pdf';
  }

  /* Object URLs are revoked on the next tick. Holding them open would keep
     document bytes reachable from the page for the rest of the session. */
  function downloadBytes(bytes, fileName, mime = 'application/pdf') {
    const blob = new Blob([bytes], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function downloadJson(obj, fileName) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj, null, 2));
    downloadBytes(bytes, fileName, 'application/json');
  }

  async function downloadZip(outputs, zipName) {
    if (!window.JSZip) throw new Error('The archive engine did not load. Download the documents individually.');
    const zip = new window.JSZip();
    outputs.forEach(o => zip.file(o.name, o.bytes));
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = ensureZipExt(zipName);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function ensureZipExt(name) {
    const clean = String(name || 'documents').trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 100);
    return /\.zip$/i.test(clean) ? clean : clean + '.zip';
  }

  /* Preview uses a same-origin blob URL, never a remote document URL. */
  function previewUrl(bytes) {
    return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  }

  return {
    LIMITS,
    OPERATION_LABELS,
    formatBytes, baseName, ensurePdfExt,
    sha256, shortHash,
    loadSource,
    parsePageSelection, describePages,
    planSplit, executeSplit,
    executeMerge,
    executeExtract,
    executeRemove,
    resolveRotationScope, executeRotate,
    initPageModel, executeOrganize,
    readMetadata, executeMetadataClean,
    compareDocuments,
    recordOperation, getOperationRecords, clearOperationRecords,
    downloadBytes, downloadJson, downloadZip, previewUrl,
  };
})();

window.PDFOps = PDFOps;

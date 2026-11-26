import { h, Component } from '../../vendor/preact.module.js';
import htm from '../../vendor/htm.module.js';
import { Icon } from '../icons.js';
import { Busy, Field, InstitutionField, Notice, Sheet } from '../components.js';
import {
  BULK_HARD_LIMIT,
  BULK_OCR_TIMEOUT_MS,
  BULK_SOFT_LIMIT,
  MAX_FILE_BYTES,
} from '../constants.js';
import {
  VALID_EXAM_TYPES,
  createBulkStore,
  normaliseBulkCourseCode,
  runBulkOcr,
  startBulkUpload,
} from '../bulk.js';
import { extractMetadata } from '../metadataExtract.js';
import { initScribe, ocrFirstPages } from '../ocr.js';
import { loadRaw, saveRaw } from '../store.js';

const html = htm.bind(h);

const DESKTOP_BANNER_KEY = 'quarchive.bulk.desktop-banner-dismissed';
const CURRENT_YEAR = new Date().getFullYear();

const YEARS = Array.from({ length: CURRENT_YEAR - 1980 + 2 }, (_, i) => String(CURRENT_YEAR + 1 - i));

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SEMESTERS = ['1', '2', '3', '4', '5', '6', '7', '8', 'annual'].map((value) => ({
  value,
  label: value === 'annual' ? 'Annual' : `S${value}`,
}));

const LANGUAGES = [
  ['en', 'English'], ['ml', 'Malayalam'], ['hi', 'Hindi'],
  ['ta', 'Tamil'], ['te', 'Telugu'], ['kn', 'Kannada'],
].map(([value, label]) => ({ value, label }));

const EXAM_TYPE_LABELS = {
  main: 'Main',
  supplementary: 'Supplementary',
  model: 'Model',
  improvement: 'Improvement',
  'end-semester': 'End Semester',
  midsemester: 'Midsemester',
  'make-up': 'Make Up',
  're-exam': 'Re-Exam',
  'save-a-year': 'Save A Year',
};

function isMobile() {
  return typeof window !== 'undefined' && window.innerWidth < 768;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function wrapStore(store, onChange) {
  const wrapped = { getState: store.getState };
  for (const method of [
    'setState', 'updateFile', 'addFiles', 'removeFile', 'clearAll',
    'setFileMetadata', 'setOcrSuggestions', 'acceptOcrField',
    'dismissOcrField', 'setThumbnail', 'setThumbnailLoading',
    'setInstitutionAndRevalidate', 'setDefaultLanguage',
    'setUploadStarted', 'setIsUploading', 'reset',
  ]) {
    wrapped[method] = (...args) => {
      const result = store[method](...args);
      onChange();
      return result;
    };
  }
  return wrapped;
}

async function validateFiles(fileList) {
  const valid = [];
  const rejected = [];
  for (const file of Array.from(fileList || [])) {
    if (file.type !== 'application/pdf') {
      rejected.push({ id: `${Date.now()}-${rejected.length}`, file, reason: 'Not a PDF file' });
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      rejected.push({ id: `${Date.now()}-${rejected.length}`, file, reason: 'File too large (max 50 MB)' });
      continue;
    }
    try {
      const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
      if (!isPdf) {
        rejected.push({ id: `${Date.now()}-${rejected.length}`, file, reason: 'File does not appear to be a valid PDF' });
        continue;
      }
    } catch {
      rejected.push({ id: `${Date.now()}-${rejected.length}`, file, reason: 'Could not read file' });
      continue;
    }
    valid.push(file);
  }
  return { valid, rejected };
}

function showPill(record, field) {
  const value = record?.ocrSuggestions?.[field];
  if (!value) return false;
  if (record.ocrDismissed?.[field] || record.ocrAccepted?.[field]) return false;
  return !record.metadata?.[field] || record.metadata[field] === value;
}

function OcrPill({ label, value, onAccept, onDismiss }) {
  return html`<div class="ls-callout ls-callout--info" role="status">
    <${Icon} name="star" small=${true} />
    <div>
      <p><b>Suggested ${label}:</b> ${value}</p>
      <div class="ls-links">
        <button type="button" class="ls-btn ls-btn--small" aria-label=${`Accept suggestion: ${value}`} onClick=${onAccept}>Use</button>
        <button type="button" class="ls-btn ls-btn--small" aria-label=${`Dismiss suggestion ${label}`} onClick=${onDismiss}>Dismiss</button>
      </div>
    </div>
  </div>`;
}

function StatusBadge({ record }) {
  let label = 'Scanning';
  let icon = 'clock';
  let tone = 'ls-chip--unverified';
  const status = record.uploadStatus;
  if (status === 'done') { label = 'Done'; icon = 'check'; tone = 'ls-chip--fresh'; }
  else if (status === 'uploading') { label = 'Uploading'; icon = 'clock'; tone = 'ls-chip--unverified'; }
  else if (status === 'failed') { label = 'Failed'; icon = 'alert'; tone = 'ls-chip--stale'; }
  else if (status === 'skipped') { label = 'Duplicate'; icon = 'info'; tone = 'ls-chip--stale'; }
  else if (status === 'pending') { label = 'Pending'; icon = 'clock'; tone = 'ls-chip--unverified'; }
  else if (record.isReady) { label = 'Ready'; icon = 'check'; tone = 'ls-chip--fresh'; }
  else if (record.ocrStatus === 'done' || record.ocrStatus === 'skipped' || record.ocrStatus === 'failed') {
    label = 'Review needed'; icon = 'alert'; tone = 'ls-chip--unverified';
  }
  return html`<span class=${`ls-chip ${tone}`}><${Icon} name=${icon} small=${true} /> ${label}</span>`;
}

function MetadataFields({ record, setField, acceptField, dismissField }) {
  const meta = record.metadata;
  const errors = record.validationErrors || {};
  const set = (field, value) => setField(record.id, field, value);
  const pill = (field, label) => showPill(record, field)
    ? html`<${OcrPill} label=${label} value=${record.ocrSuggestions[field]}
        onAccept=${() => acceptField(record.id, field, record.ocrSuggestions[field])}
        onDismiss=${() => dismissField(record.id, field)} />`
    : null;

  return html`<div>
    <${Field} id=${`bulk-${record.id}-course-code`} label="Course Code *" error=${errors.courseCode}>
      ${pill('courseCode', 'course code')}
      <input id=${`bulk-${record.id}-course-code`} class="ls-input" type="text" autocapitalize="characters"
        value=${meta.courseCode} placeholder="e.g. CS301"
        onInput=${(e) => set('courseCode', e.target.value)}
        onBlur=${(e) => set('courseCode', normaliseBulkCourseCode(e.target.value))} />
    <//>

    <${Field} id=${`bulk-${record.id}-course-name`} label="Course Name" optional=${true}>
      ${pill('courseName', 'course name')}
      <input id=${`bulk-${record.id}-course-name`} class="ls-input" type="text"
        value=${meta.courseName} placeholder="e.g. Data Structures"
        onInput=${(e) => set('courseName', e.target.value)} />
    <//>

    <${Field} id=${`bulk-${record.id}-year`} label="Year *" error=${errors.year}>
      ${pill('year', 'year')}
      <select id=${`bulk-${record.id}-year`} class="ls-select" value=${meta.year} onInput=${(e) => set('year', e.target.value)}>
        <option value="">Select year…</option>
        ${YEARS.map((year) => html`<option key=${year} value=${year}>${year}</option>`)}
      </select>
    <//>

    <fieldset class="ls-field">
      <legend>Exam Type *</legend>
      ${pill('examType', 'exam type')}
      <div class="ls-links">
        ${VALID_EXAM_TYPES.map((type) => html`<label key=${type} class="ls-check">
          <input type="radio" name=${`bulk-${record.id}-exam-type`} value=${type}
            checked=${meta.examType === type} onInput=${() => set('examType', type)} />
          ${EXAM_TYPE_LABELS[type] || type}
        </label>`)}
      </div>
      ${errors.examType ? html`<p class="ls-callout ls-callout--error" role="alert">${errors.examType}</p>` : null}
    </fieldset>

    <${Field} id=${`bulk-${record.id}-semester`} label="Semester" optional=${true}>
      <select id=${`bulk-${record.id}-semester`} class="ls-select" value=${meta.semester} onInput=${(e) => set('semester', e.target.value)}>
        <option value="">Select semester…</option>
        ${SEMESTERS.map((item) => html`<option key=${item.value} value=${item.value}>${item.label}</option>`)}
      </select>
    <//>

    <${Field} id=${`bulk-${record.id}-month`} label="Month" optional=${true}>
      ${pill('month', 'month')}
      <select id=${`bulk-${record.id}-month`} class="ls-select" value=${meta.month} onInput=${(e) => set('month', e.target.value)}>
        <option value="">Select month…</option>
        ${MONTHS.map((month) => html`<option key=${month} value=${month}>${month}</option>`)}
      </select>
    <//>

    <${Field} id=${`bulk-${record.id}-program`} label="Program" optional=${true}>
      <input id=${`bulk-${record.id}-program`} class="ls-input" type="text"
        value=${meta.program} placeholder="e.g. B.Tech Computer Science"
        onInput=${(e) => set('program', e.target.value)} />
    <//>

    <${Field} id=${`bulk-${record.id}-language`} label="Language">
      <select id=${`bulk-${record.id}-language`} class="ls-select" value=${meta.language} onInput=${(e) => set('language', e.target.value)}>
        ${LANGUAGES.map((item) => html`<option key=${item.value} value=${item.value}>${item.label}</option>`)}
      </select>
    <//>
  </div>`;
}

/** One queue row, with a lazy first-page thumbnail drawn straight to canvas. */
class BulkRow extends Component {
  constructor(props) {
    super(props);
    this.state = { rendered: false };
    this.alive = true;
    this.canvas = null;
    this.row = null;
    this.observer = null;
    this.rendering = false;
    this.pdfTask = null;
    this.pdfDoc = null;
  }

  componentDidMount() {
    if (typeof IntersectionObserver === 'undefined') {
      this.renderThumbnail();
      return;
    }
    this.observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        this.observer.disconnect();
        this.observer = null;
        this.renderThumbnail();
      }
    }, { threshold: 0.1 });
    if (this.row) this.observer.observe(this.row);
  }

  componentWillUnmount() {
    this.alive = false;
    if (this.observer) this.observer.disconnect();
    try { if (this.pdfTask) this.pdfTask.destroy(); } catch { /* already done */ }
    try { if (this.pdfDoc) this.pdfDoc.destroy(); } catch { /* already done */ }
  }

  async renderThumbnail() {
    if (this.rendering || this.state.rendered) return;
    const { record, onThumbnail } = this.props;
    if (!record?.file || !this.canvas) return;
    this.rendering = true;
    try {
      const pdfjs = await import('../../vendor/pdfjs/pdf.mjs');
      if (!this.alive) return;
      pdfjs.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.mjs';
      this.pdfTask = pdfjs.getDocument({ data: await record.file.arrayBuffer() });
      const doc = await this.pdfTask.promise;
      if (!this.alive) { doc.destroy(); return; }
      this.pdfDoc = doc;
      const page = await doc.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 72 / base.width });
      this.canvas.width = 72;
      this.canvas.height = Math.round(viewport.height);
      const ctx = this.canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (this.alive) {
        this.setState({ rendered: true });
        onThumbnail(record.id, true);
      }
    } catch {
      if (this.alive) onThumbnail(record.id, false);
    } finally {
      this.rendering = false;
    }
  }

  render(props, state) {
    const { record, setField, acceptField, dismissField, remove, openSheet, isMobile } = props;
    const done = record.uploadStatus === 'done';
    const skipped = record.uploadStatus === 'skipped';
    const failed = record.uploadStatus === 'failed';
    const uploading = record.uploadStatus === 'uploading';
    return html`<article class="ls-card" ref=${(el) => { this.row = el; }}>
      <div class="ls-links">
        <canvas ref=${(el) => { this.canvas = el; }} width="72" height="102"
          hidden=${!state.rendered} aria-label=${`First page of ${record.name}`}></canvas>
        ${!state.rendered ? html`<${Busy} small=${true} label="Rendering preview…" />` : null}
        <div>
          <p><b>${record.name}</b></p>
          <p class="ls-hint">${formatBytes(record.size)}</p>
        </div>
        <${StatusBadge} record=${record} />
        ${record.uploadStatus === null ? html`<button type="button" class="ls-btn ls-btn--small" aria-label=${`Remove ${record.name}`} onClick=${() => remove(record.id)}><${Icon} name="trash" small=${true} /> Remove</button>` : null}
      </div>

      ${isMobile && record.uploadStatus === null
        ? html`<p><button type="button" class="ls-btn ls-btn--small" onClick=${() => openSheet(record.id)}>Edit details</button></p>`
        : null}
      ${!isMobile ? html`<${MetadataFields} record=${record} setField=${setField} acceptField=${acceptField} dismissField=${dismissField} />` : null}

      ${done && record.archiveUrl ? html`<p><a class="ls-out" href=${record.archiveUrl} target="_blank" rel="noopener noreferrer">View on Archive.org</a></p>` : null}
      ${skipped ? html`<p class="ls-hint">${record.duplicateUrl === 'duplicate-in-batch'
        ? 'Duplicate of another file in this batch'
        : record.duplicateUrl
          ? html`<a class="ls-out" href=${record.duplicateUrl} target="_blank" rel="noopener noreferrer">Already on Archive.org</a>`
          : 'Duplicate'}</p>` : null}
      ${failed && record.uploadError ? html`<p class="ls-callout ls-callout--error" role="alert">${record.uploadError === 'session_expired' ? 'Session expired — please sign in again' : `Upload failed: ${record.uploadError}`}</p>` : null}
      ${uploading ? html`<progress value=${record.uploadProgress} max="1" aria-label=${`Upload progress for ${record.name}`}></progress>` : null}
    </article>`;
  }
}

function StatusChip({ count, label, tone }) {
  return html`<span class=${`ls-chip ${tone || ''}`}><b>${count}</b> ${label}</span>`;
}

function BulkUploadBar({ files, isUploading, onUpload }) {
  const count = (test) => files.filter(test).length;
  const ready = count((file) => file.isReady && file.uploadStatus === null);
  const review = count((file) => !file.isReady && file.uploadStatus === null && file.ocrStatus !== 'idle' && file.ocrStatus !== 'running');
  const scanning = count((file) => file.ocrStatus === 'running' || file.ocrStatus === 'queued' || file.thumbnailLoading);
  const uploading = count((file) => file.uploadStatus === 'uploading');
  const pending = count((file) => file.uploadStatus === 'pending');
  const done = count((file) => file.uploadStatus === 'done');
  const duplicate = count((file) => file.uploadStatus === 'skipped');
  const failed = count((file) => file.uploadStatus === 'failed');
  const total = uploading + pending + done + failed + duplicate;

  return html`<div class="ls-card">
    <div class="ls-links" aria-label="Upload summary">
      <${StatusChip} count=${ready} label="ready" tone=${ready ? 'ls-chip--fresh' : 'ls-chip--stale'} />
      <${StatusChip} count=${review} label="review needed" tone=${review ? 'ls-chip--unverified' : 'ls-chip--stale'} />
      ${scanning ? html`<${StatusChip} count=${scanning} label="scanning" />` : null}
      ${uploading ? html`<${StatusChip} count=${uploading} label="uploading" />` : null}
      ${pending ? html`<${StatusChip} count=${pending} label="pending" />` : null}
      ${done ? html`<${StatusChip} count=${done} label="done" tone="ls-chip--fresh" />` : null}
      ${duplicate ? html`<${StatusChip} count=${duplicate} label="duplicate" />` : null}
      ${failed ? html`<${StatusChip} count=${failed} label="failed" tone="ls-chip--stale" />` : null}
    </div>
    ${isUploading
      ? html`<${Busy} label=${`Uploading ${done} / ${total} ${total === 1 ? 'file' : 'files'}…`} />`
      : html`<p><button type="button" class="ls-btn ls-btn--primary" disabled=${ready === 0} onClick=${onUpload}>
          <${Icon} name="upload" small=${true} /> Upload ${ready} Ready ${ready === 1 ? 'file' : 'files'}
        </button></p>`}
  </div>`;
}

function AuthGate({ openAuth }) {
  return html`<div class="ls-card">
    <p><${Icon} name="lock" /> <b>Sign in to continue</b></p>
    <p>You need an Internet Archive account to upload papers.</p>
    <button type="button" class="ls-btn ls-btn--primary" onClick=${openAuth}>Sign In</button>
    <p class="ls-hint">Don't have an account? <a class="ls-out" href="https://archive.org/account/signup" target="_blank" rel="noopener noreferrer">Sign up at archive.org</a></p>
  </div>`;
}

/** Bulk upload: validate → queue → per-file metadata → bounded-concurrency upload. */
export class Bulk extends Component {
  constructor(props) {
    super(props);
    this.store = createBulkStore();
    this.viewStore = wrapStore(this.store, () => this.sync());
    this.state = {
      snapshot: this.store.getState(),
      sheetFileId: null,
      bannerDismissed: loadRaw(DESKTOP_BANNER_KEY) === '1',
      isMobile: isMobile(),
      checking: false,
      dragOver: false,
      rejections: [],
      error: '',
    };
    this.alive = true;
    this.ocrRunning = false;
    this.fileInput = null;
    this.dragCounter = 0;
    this.onKeyDown = this.onKeyDown.bind(this);
    this.sync = this.sync.bind(this);
    this.setField = this.setField.bind(this);
    this.acceptField = this.acceptField.bind(this);
    this.dismissField = this.dismissField.bind(this);
  }

  componentDidMount() {
    document.addEventListener('keydown', this.onKeyDown);
  }

  componentWillUnmount() {
    this.alive = false;
    document.removeEventListener('keydown', this.onKeyDown);
  }

  onKeyDown(event) {
    if (event?.key === 'Escape' && this.state.sheetFileId) {
      this.setState({ sheetFileId: null });
    }
  }

  sync() {
    if (this.alive) this.setState({ snapshot: this.viewStore.getState() });
  }

  async handleFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    this.setState({ checking: true, error: '' });
    try {
      const { valid, rejected } = await validateFiles(fileList);
      if (!this.alive) return;
      if (rejected.length) {
        this.setState((state) => ({ rejections: [...state.rejections, ...rejected] }));
      }
      if (valid.length) this.addFiles(valid);
    } catch {
      if (this.alive) this.setState({ error: 'Could not read file' });
    } finally {
      if (this.fileInput) this.fileInput.value = '';
      if (this.alive) this.setState({ checking: false });
    }
  }

  addFiles(files) {
    const { added } = this.viewStore.addFiles(files);
    if (!added) {
      this.props.notify?.('50-file limit reached. Remove some files before adding more.', 'warning');
      return;
    }
    this.maybeStartOcr();
    if (this.viewStore.getState().files.length >= BULK_HARD_LIMIT) {
      this.props.notify?.('50-file limit reached. Remove some files before adding more.', 'warning');
    }
  }

  maybeStartOcr() {
    if (this.ocrRunning) return;
    if (!this.viewStore.getState().files.some((file) => file.ocrStatus === 'idle')) return;
    this.ocrRunning = true;
    runBulkOcr({
      store: this.viewStore,
      init: () => initScribe({ vendorPath: '/vendor/scribe/' }),
      ocr: ocrFirstPages,
      extract: extractMetadata,
      timeoutMs: BULK_OCR_TIMEOUT_MS,
      isActive: () => this.alive,
    }).catch(() => { /* runBulkOcr marks each file as skipped */ })
      .then(() => {
        this.ocrRunning = false;
        if (this.alive) this.maybeStartOcr();
      });
  }

  async startUpload() {
    try {
      const result = await startBulkUpload({ store: this.viewStore, auth: this.props.auth || {} });
      if (!this.alive) return;
      if (result.aborted || this.viewStore.getState().files.some((file) => file.uploadError === 'session_expired')) {
        this.props.notify?.('Session expired — please sign in again', 'error');
        this.props.openAuth?.();
      } else if (result.failed) {
        this.props.notify?.(`${result.failed} ${result.failed === 1 ? 'file' : 'files'} failed to upload.`, 'warning');
      } else if (result.uploaded) {
        this.props.notify?.(`${result.uploaded} ${result.uploaded === 1 ? 'file' : 'files'} uploaded.`, 'success');
      }
    } catch {
      if (this.alive) this.props.notify?.('Connection failed. Check your internet and try again.', 'error');
    }
  }

  dismissBanner() {
    saveRaw(DESKTOP_BANNER_KEY, '1');
    this.setState({ bannerDismissed: true });
  }

  dismissRejection(id) {
    this.setState((state) => ({ rejections: state.rejections.filter((item) => item.id !== id) }));
  }

  setInstitution(label, qid) {
    this.viewStore.setInstitutionAndRevalidate({ label, qid });
  }

  setField(id, field, value) {
    this.viewStore.setFileMetadata(id, field, value);
  }

  acceptField(id, field, value) {
    this.viewStore.acceptOcrField(id, field, value);
  }

  dismissField(id, field) {
    this.viewStore.dismissOcrField(id, field);
  }

  setThumbnail(id, ok) {
    if (ok) this.viewStore.setThumbnail(id, '');
    else this.viewStore.setThumbnailLoading(id, false);
  }

  renderPicker() {
    const { checking, dragOver } = this.state;
    return html`<div>
      <div class="ls-slot" role="group" aria-label="Drop PDF files here"
        onDragEnter=${(e) => { e.preventDefault(); this.dragCounter += 1; this.setState({ dragOver: true }); }}
        onDragOver=${(e) => e.preventDefault()}
        onDragLeave=${(e) => { e.preventDefault(); this.dragCounter = Math.max(0, this.dragCounter - 1); if (this.dragCounter === 0) this.setState({ dragOver: false }); }}
        onDrop=${(e) => {
          e.preventDefault();
          this.dragCounter = 0;
          this.setState({ dragOver: false });
          this.handleFiles(e.dataTransfer?.files);
        }}>
        <${Icon} name="folder" />
        <p>${checking ? 'Checking files…' : dragOver ? 'Drop PDFs here' : 'Drop PDFs here or click to select'}</p>
        <p class="ls-hint">PDF files only · max 50 MB each</p>
        <button type="button" class="ls-btn ls-btn--primary" disabled=${checking}
          onClick=${() => this.fileInput?.click()}>Select PDFs</button>
      </div>
      ${this.state.rejections.length ? html`<div>
        <h2>Rejected files</h2>
        ${this.state.rejections.map((item) => html`<${Notice} key=${item.id} kind="warning" icon="alert"
          action=${{ label: 'Dismiss', onClick: () => this.dismissRejection(item.id) }}>
          <b>${item.file.name}</b> — ${item.reason}
        <//>`)}
      </div>` : null}
    </div>`;
  }

  renderSheet() {
    const id = this.state.sheetFileId;
    const record = this.state.snapshot.files.find((file) => file.id === id);
    if (!record) return null;
    const footer = html`<button type="button" class="ls-btn ls-btn--primary" onClick=${() => this.setState({ sheetFileId: null })}>Done</button>`;
    return html`<${Sheet} title="Edit Paper Details" onClose=${() => this.setState({ sheetFileId: null })} footer=${footer}>
      <p class="ls-hint">${record.name}</p>
      <${MetadataFields} record=${record} setField=${this.setField} acceptField=${this.acceptField} dismissField=${this.dismissField} />
    <//>`;
  }

  render(props, state) {
    if (!props.auth) {
      return html`<section>
        <div class="ls-links"><button type="button" class="ls-btn ls-btn--small" onClick=${() => props.navigate('upload')}><${Icon} name="back" small=${true} /> Back</button></div>
        <h1>Bulk Upload</h1>
        <${AuthGate} openAuth=${props.openAuth} />
      </section>`;
    }

    const files = state.snapshot.files;
    const institution = state.snapshot.institution;
    const overSoftLimit = files.length > BULK_SOFT_LIMIT;
    const atHardLimit = files.length >= BULK_HARD_LIMIT;
    const rowProps = {
      setField: this.setField,
      acceptField: this.acceptField,
      dismissField: this.dismissField,
      remove: (id) => this.viewStore.removeFile(id),
      openSheet: (id) => this.setState({ sheetFileId: id }),
      onThumbnail: (id, ok) => this.setThumbnail(id, ok),
      isMobile: state.isMobile,
    };

    return html`<section>
      <div class="ls-links"><button type="button" class="ls-btn ls-btn--small" onClick=${() => props.navigate('upload')}><${Icon} name="back" small=${true} /> Back</button></div>
      <h1>Bulk Upload</h1>
      <p class="ls-hint">Upload multiple PDFs at once. OCR will suggest metadata for each file.</p>

      ${state.isMobile && !state.bannerDismissed ? html`<${Notice} kind="warning" icon="info"
        action=${{ label: 'Dismiss', onClick: () => this.dismissBanner() }}>
        <b>Works best on a computer</b>
        <p class="ls-hint">Bulk upload is designed for desktop. You can still proceed on mobile.</p>
      <//>` : null}

      ${overSoftLimit && !atHardLimit ? html`<${Notice} kind="warning" icon="alert">
        <b>Large batch:</b> ${files.length} files selected. Upload may take a while.
      <//>` : null}
      ${atHardLimit ? html`<${Notice} kind="error" icon="alert">
        <b>50-file limit reached.</b> Remove some files before adding more.
      <//>` : null}
      ${state.error ? html`<${Notice} kind="error" icon="alert">${state.error}<//>` : null}

      ${files.length ? html`<div class="ls-card">
        <${Field} id="bulk-institution" label="Institution *" hint="Shared for all files. Search powered by Wikidata.">
          <${InstitutionField} id="bulk-institution" value=${institution.label || ''} qid=${institution.qid || ''}
            onChange=${(label, qid) => this.setInstitution(label, qid)} />
        <//>
      </div>` : null}

      ${files.length === 0
        ? this.renderPicker()
        : html`<div>
            <div class="ls-links">
              <p><b>${files.length} ${files.length === 1 ? 'file' : 'files'} selected</b></p>
              ${!state.snapshot.isUploading ? html`<button type="button" class="ls-btn ls-btn--small" onClick=${() => this.fileInput?.click()}><${Icon} name="plus" small=${true} /> Add more</button>` : null}
              ${!state.snapshot.isUploading ? html`<button type="button" class="ls-btn ls-btn--small" onClick=${() => this.viewStore.clearAll()}><${Icon} name="trash" small=${true} /> Clear all</button>` : null}
            </div>
            ${files.map((record) => html`<${BulkRow} key=${record.id} record=${record} ...${rowProps} />`)}
            <${BulkUploadBar} files=${files} isUploading=${state.snapshot.isUploading} onUpload=${() => this.startUpload()} />
          </div>`}

      ${this.renderSheet()}

      <input ref=${(el) => { this.fileInput = el; }} type="file" multiple accept=".pdf,application/pdf" hidden
        aria-label="Select PDF files" onChange=${(e) => this.handleFiles(e.target.files)} />
    </section>`;
  }
}

export default Bulk;

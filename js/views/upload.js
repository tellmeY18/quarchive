import { h, Component } from '../../vendor/preact.module.js';
import htm from '../../vendor/htm.module.js';
import { Icon } from '../icons.js';
import { Busy, Field, InstitutionField, Notice } from '../components.js';
import {
  EXAM_TYPES,
  MAX_FILE_BYTES,
  OCR_TIMEOUT_MS,
} from '../constants.js';
import {
  buildIdentifier,
  validateMetadata,
  validatePdfMagic,
} from '../metadata.js';
import { normaliseCourseCodeForSlug, extractFromOcr } from '../metadataExtract.js';
import { hashFile, layer1HashCheck, layer2IdentifierCheck } from '../dedup.js';
import { paperItemUrl, paperThumbnail } from '../archive.js';
import { uploadPaper } from '../upload.js';
import { initScribe, ocrFirstPages } from '../ocr.js';
import Camera from './camera.js';

const html = htm.bind(h);

const STEPS = [
  { number: 1, label: 'Metadata' },
  { number: 2, label: 'Check' },
  { number: 3, label: 'Upload' },
];

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

const SEMESTERS = ['1', '2', '3', '4', '5', '6', '7', '8', 'annual'].map((value) => ({
  value,
  label: value === 'annual' ? 'Annual' : `Semester ${value}`,
}));

const LANGUAGES = [
  ['en', 'English'], ['ml', 'Malayalam'], ['hi', 'Hindi'],
  ['ta', 'Tamil'], ['te', 'Telugu'], ['kn', 'Kannada'],
].map(([value, label]) => ({ value, label }));

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ERROR_MESSAGES = {
  session_expired: {
    title: 'Session Expired',
    message: 'Your Archive.org session expired. Please sign in again.',
    icon: 'lock',
  },
  slow_down: {
    title: 'Server Busy',
    message: 'Archive.org is busy. Please wait a moment and try again.',
    icon: 'clock',
  },
  network: {
    title: 'Connection Failed',
    message: 'Connection failed. Check your internet and try again.',
    icon: 'wifi',
  },
  rejected: {
    title: 'File Rejected',
    message: 'Archive.org rejected this file. Ensure it is a valid PDF and try again.',
    icon: 'alert',
  },
};

function nowParts() {
  const date = new Date();
  return { year: String(date.getFullYear()), month: MONTHS[date.getMonth()] };
}

function emptySuggestions() {
  return { courseName: null, courseCode: null, examType: null, year: null, month: null };
}

function hasCamera() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

function isMobile() {
  return typeof window !== 'undefined' && window.innerWidth < 768;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StepIndicator({ step }) {
  return html`<ol class="ls-links" aria-label="Upload progress">
    ${STEPS.map((item) => {
      const state = step > item.number ? 'done' : step === item.number ? 'current' : 'future';
      return html`<li key=${item.number}>
        <span class=${`ls-chip ${state === 'done' ? 'ls-chip--fresh' : state === 'future' ? 'ls-chip--stale' : 'ls-chip--unverified'}`}
          aria-current=${state === 'current' ? 'step' : null}>
          ${state === 'done' ? '✓' : item.number} ${item.label}
        </span>
      </li>`;
    })}
  </ol>`;
}

function OcrPill({ field, value, onUse, onDismiss }) {
  return html`<ul class="ls-tags" aria-label=${`${field} suggestion`}>
    <li><span class="ls-chip ls-chip--unverified">Suggested: ${value}</span></li>
    <li><button type="button" class="ls-btn ls-btn--small" aria-label=${`Use suggested ${field}`} onClick=${onUse}>Use</button></li>
    <li><button type="button" class="ls-btn ls-btn--small" aria-label=${`Dismiss suggested ${field}`} onClick=${onDismiss}>Dismiss</button></li>
  </ul>`;
}

function ChecklistItem({ label, status }) {
  return html`<p class="ls-callout ls-callout--info" role="status">
    <${Icon} name=${status === 'done' ? 'check' : status === 'running' ? 'clock' : 'info'} small=${true} />
    <span>${label}</span>
  </p>`;
}

function DuplicateCard({ item }) {
  const identifier = item?.identifier || '';
  const title = item?.title || item?.description || identifier || 'Existing paper';
  const details = [item?.creator, item?.date, item?.['exam-type'] || item?.examType]
    .filter(Boolean)
    .join(' \u00b7 ');
  return html`<div class="ls-card">
    ${identifier ? html`<img class="camera-frame" src=${paperThumbnail(identifier)} alt="" loading="lazy" />` : null}
    <h3>${title}</h3>
    ${details ? html`<p class="ls-hint">${details}</p>` : null}
    ${identifier ? html`<p><a class="ls-out" href=${paperItemUrl(identifier)} target="_blank" rel="noopener noreferrer">View on Archive.org <${Icon} name="external" small=${true} /></a></p>` : null}
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

function SourcePicker({ openCamera, cameraAvailable, openPdf, openBulk }) {
  return html`<div>
    <h2>Add a Question Paper</h2>
    <p class="ls-hint">Choose how you want to add your question paper.</p>
    <p>
      <button type="button" class="ls-btn ls-btn--primary" onClick=${openCamera} disabled=${!cameraAvailable}>
        <${Icon} name="camera" small=${true} /> Scan with Camera
      </button>
    </p>
    ${!cameraAvailable ? html`<p class="ls-hint">Camera capture is not available in this browser. Upload a PDF instead.</p>` : null}
    <p class="ls-hint">or</p>
    <p><button type="button" class="ls-btn" onClick=${openPdf}><${Icon} name="file" small=${true} /> Upload existing PDF</button></p>
    <p class="ls-hint">or</p>
    <p><button type="button" class="ls-btn" onClick=${openBulk}><${Icon} name="folder" small=${true} /> Bulk upload PDFs</button></p>
    <p class="ls-hint">Upload multiple PDFs at once</p>
  </div>`;
}

/** Upload wizard: source → metadata → duplicate check → upload. */
export class Upload extends Component {
  constructor(props) {
    super(props);
    const { year, month } = nowParts();
    this.state = {
      showCamera: !!(props.auth && hasCamera() && isMobile()),
      step: 1,
      source: null,
      file: null,
      pdfBlob: null,
      fileHash: '',
      identifier: '',
      metadata: {
        institution: { label: 'National Institute of Technology Calicut', qid: 'Q6973731' },
        program: 'B.Tech',
        courseName: '',
        courseCode: '',
        year,
        month,
        examType: '',
        semester: '',
        language: 'en',
      },
      ocrStatus: 'idle',
      ocrSuggestions: emptySuggestions(),
      ocrDismissed: {},
      ocrAccepted: {},
      errors: [],
      fileError: '',
      dragOver: false,
      submitting: false,
      hashStatus: 'pending',
      layer1Status: 'pending',
      layer2Status: 'pending',
      dedupStatus: null,
      checkState: 'running',
      duplicateData: null,
      uploadStatus: null,
      uploadError: null,
    };
    this.alive = true;
    this.fileInput = null;
    this.dedupRunFor = null;
    this.uploadRunFor = null;
    this.ocrRunFor = null;
    this.onBeforeUnload = this.onBeforeUnload.bind(this);
  }

  componentDidMount() {
    window.addEventListener('beforeunload', this.onBeforeUnload);
  }

  componentDidUpdate(previousProps) {
    if (!previousProps.auth && this.props.auth && !this.state.source && !this.state.file && hasCamera() && isMobile()) {
      this.setState({ showCamera: true });
    }
    if (this.state.step === 1 && this.state.source && this.state.file) this.maybeRunPdfOcr();
    if (this.state.step === 2) this.runDedupCheck();
    if (this.state.step === 3) this.runUpload();
  }

  componentWillUnmount() {
    this.alive = false;
    window.removeEventListener('beforeunload', this.onBeforeUnload);
  }

  onBeforeUnload(event) {
    if (this.state.step > 1 && this.state.uploadStatus !== 'success') {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  update(patch) {
    if (this.alive) this.setState(patch);
  }

  setMetadata(field, value) {
    this.setState((state) => ({ metadata: { ...state.metadata, [field]: value } }));
  }

  setStep(step) {
    if (step === 2) this.dedupRunFor = null;
    if (step < 3) this.uploadRunFor = null;
    this.setState({ step });
  }

  resetWizard() {
    const { year, month } = nowParts();
    this.dedupRunFor = null;
    this.uploadRunFor = null;
    this.ocrRunFor = null;
    this.setState({
      step: 1,
      source: null,
      file: null,
      pdfBlob: null,
      fileHash: '',
      identifier: '',
      metadata: {
        institution: { label: 'National Institute of Technology Calicut', qid: 'Q6973731' },
        program: 'B.Tech',
        courseName: '',
        courseCode: '',
        year,
        month,
        examType: '',
        semester: '',
        language: 'en',
      },
      ocrStatus: 'idle',
      ocrSuggestions: emptySuggestions(),
      ocrDismissed: {},
      ocrAccepted: {},
      errors: [],
      fileError: '',
      dragOver: false,
      submitting: false,
      hashStatus: 'pending',
      layer1Status: 'pending',
      layer2Status: 'pending',
      dedupStatus: null,
      checkState: 'running',
      duplicateData: null,
      uploadStatus: null,
      uploadError: null,
    });
  }

  openCamera() {
    this.setState({ showCamera: true });
  }

  closeCamera() {
    this.setState({ showCamera: false });
  }

  handleCameraComplete(pdfBlob, ocrStatus = 'idle') {
    const file = new File([pdfBlob], 'scanned-paper.pdf', { type: 'application/pdf' });
    if (ocrStatus === 'done') this.ocrRunFor = pdfBlob;
    if (ocrStatus === 'idle') this.ocrRunFor = null;
    this.setState({
      file,
      pdfBlob,
      source: 'camera',
      showCamera: false,
      step: 1,
      ocrStatus,
      fileError: '',
      errors: [],
    });
  }

  handleCameraOcr(suggestions, status) {
    if (!this.alive) return;
    this.setState({ ocrStatus: status, ocrSuggestions: suggestions || emptySuggestions() });
  }

  async selectFile(file) {
    this.update({ fileError: '' });
    if (!file) return;
    if (file.type !== 'application/pdf') {
      this.update({ fileError: 'Only PDF files are accepted.' });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      this.update({
        fileError: `File size must be under 50MB. Current size: ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
      });
      return;
    }
    try {
      const valid = await validatePdfMagic(file);
      if (!this.alive) return;
      if (!valid) {
        this.update({ fileError: 'This file does not appear to be a valid PDF.' });
        return;
      }
      this.setState({ file, pdfBlob: file, fileError: '' });
    } catch {
      this.update({ fileError: 'This file does not appear to be a valid PDF.' });
    }
  }

  removeFile() {
    this.ocrRunFor = null;
    if (this.fileInput) this.fileInput.value = '';
    this.setState({ file: null, pdfBlob: null, fileError: '', ocrStatus: 'idle', ocrSuggestions: emptySuggestions() });
  }

  async maybeRunPdfOcr() {
    const { pdfBlob, ocrStatus } = this.state;
    if (!pdfBlob || this.ocrRunFor === pdfBlob) return;
    if (ocrStatus === 'done' || ocrStatus === 'running') return;
    this.ocrRunFor = pdfBlob;
    this.update({ ocrStatus: 'running' });
    try {
      await initScribe({ vendorPath: '/vendor/scribe/' });
      const { text } = await ocrFirstPages(pdfBlob, {
        maxPages: 2,
        language: 'eng',
        timeout: OCR_TIMEOUT_MS,
      });
      const { suggestions } = extractFromOcr(text || '');
      this.update({ ocrSuggestions: suggestions, ocrStatus: 'done' });
    } catch {
      // OCR is an aid, never a gate: suggestions stay empty and the user can type.
      this.update({ ocrStatus: 'failed' });
    }
  }

  identifierPreview() {
    const { metadata } = this.state;
    if (!metadata.institution?.qid || !metadata.year || !metadata.examType) return '';
    const code = normaliseCourseCodeForSlug(metadata.courseCode) || metadata.courseName || 'paper';
    return buildIdentifier({
      wikidataQid: metadata.institution.qid,
      courseCode: code,
      year: metadata.year,
      examType: metadata.examType,
    });
  }

  async submitMetadata(event) {
    preventDefault(event);
    const { metadata, file } = this.state;
    this.setState({ submitting: true, errors: [] });

    const result = validateMetadata(metadata, file);
    if (!result.valid) {
      this.setState({ errors: result.errors, submitting: false });
      return;
    }
    try {
      if (file && !(await validatePdfMagic(file))) {
        this.setState({ errors: ['The selected file is not a valid PDF.'], submitting: false });
        return;
      }
    } catch {
      this.setState({ errors: ['The selected file is not a valid PDF.'], submitting: false });
      return;
    }

    const code = normaliseCourseCodeForSlug(metadata.courseCode) || metadata.courseName || 'paper';
    const identifier = buildIdentifier({
      wikidataQid: metadata.institution.qid,
      courseCode: code,
      year: metadata.year,
      examType: metadata.examType,
    });
    this.setState({ identifier, submitting: false, step: 2 });
  }

  useSuggestion(field) {
    const value = this.state.ocrSuggestions[field];
    if (!value) return;
    this.setState((state) => ({
      metadata: { ...state.metadata, [field]: value },
      ocrAccepted: { ...state.ocrAccepted, [field]: true },
    }));
  }

  dismissSuggestion(field) {
    this.setState((state) => ({ ocrDismissed: { ...state.ocrDismissed, [field]: true } }));
  }

  async runDedupCheck() {
    const { file, identifier } = this.state;
    if (!file || !identifier || this.dedupRunFor === `${identifier}:${file.name}`) return;
    this.dedupRunFor = `${identifier}:${file.name}`;
    this.update({ dedupStatus: 'checking', checkState: 'running' });

    let hash = this.state.fileHash;
    try {
      if (!hash) {
        this.update({ hashStatus: 'running' });
        hash = await hashFile(file);
        if (!this.alive) return;
        this.update({ fileHash: hash });
      }
      this.update({ hashStatus: 'done', layer1Status: 'running' });
      const first = await layer1HashCheck(hash);
      if (!this.alive) return;
      this.update({ layer1Status: 'done' });
      if (first.isDuplicate) {
        this.update({ checkState: 'duplicate', duplicateData: first.item, dedupStatus: 'duplicate', layer2Status: 'done' });
        return;
      }
      this.update({ layer2Status: 'running' });
      const second = await layer2IdentifierCheck(identifier);
      if (!this.alive) return;
      this.update({ layer2Status: 'done' });
      if (second.isDuplicate) {
        this.update({ checkState: 'duplicate', duplicateData: second.item, dedupStatus: 'duplicate' });
        return;
      }
      this.update({ checkState: 'clear', dedupStatus: 'clear' });
    } catch {
      if (!this.alive) return;
      this.update({
        hashStatus: 'done',
        layer1Status: 'done',
        layer2Status: 'done',
        checkState: 'clear',
        dedupStatus: 'clear',
      });
    }
  }

  async runUpload() {
    const { file, identifier, fileHash, metadata, source, ocrAccepted } = this.state;
    const auth = this.props.auth || {};
    if (!file || !identifier || this.uploadRunFor === identifier) return;
    this.uploadRunFor = identifier;
    this.update({ uploadStatus: 'uploading', uploadError: null });

    const uploadSource = source === 'camera' ? 'camera-scan' : 'pdf-upload';
    try {
      const result = await uploadPaper({
        file,
        fields: { identifier, metadata, fileHash, source: uploadSource, ocrAccepted },
        auth,
      });
      if (!this.alive) return;
      if (result.ok) {
        this.update({ uploadStatus: 'success', uploadError: null });
      } else {
        this.update({ uploadStatus: 'error', uploadError: result.error || 'rejected' });
      }
    } catch {
      this.update({ uploadStatus: 'error', uploadError: 'network' });
    }
  }

  renderMetadata() {
    const { metadata, ocrSuggestions, ocrDismissed, file, fileError, errors, submitting, ocrStatus } = this.state;
    const years = Array.from({ length: new Date().getFullYear() - 2000 + 1 }, (_, i) => String(new Date().getFullYear() - i));
    const suggestion = (field, label) => {
      const value = ocrSuggestions[field];
      if (!value || ocrDismissed[field] || metadata[field]) return null;
      return html`<${OcrPill} field=${label} value=${value}
        onUse=${() => this.useSuggestion(field)}
        onDismiss=${() => this.dismissSuggestion(field)} />`;
    };

    return html`<form onSubmit=${(e) => this.submitMetadata(e)}>
      <h2>Upload a Question Paper</h2>
      <p class="ls-hint">Fill in the paper details below. Fields marked with * are required.</p>

      <${Field} id="meta-institution" label="University / Institution *" hint="Search powered by Wikidata. Start typing to find your university.">
        <${InstitutionField} id="meta-institution"
          value=${metadata.institution.label || ''}
          qid=${metadata.institution.qid || ''}
          onChange=${(value, qid) => this.setMetadata('institution', { label: value, qid })} />
      <//>

      <${Field} id="meta-program" label="Program / Degree" optional=${true}>
        <input id="meta-program" class="ls-input" type="text" value=${metadata.program}
          placeholder="e.g. B.Sc Computer Science" onInput=${(e) => this.setMetadata('program', e.target.value)} />
      <//>

      <${Field} id="meta-course-name" label="Course Name" optional=${true}>
        ${ocrStatus === 'running' ? html`<p class="ls-hint" role="status"><${Icon} name="clock" small=${true} /> Reading paper…</p>` : null}
        ${suggestion('courseName', 'course name')}
        <input id="meta-course-name" class="ls-input" type="text" value=${metadata.courseName}
          placeholder="e.g. Data Structures" onInput=${(e) => this.setMetadata('courseName', e.target.value)} />
      <//>

      <${Field} id="meta-course-code" label="Course Code" optional=${true}>
        ${suggestion('courseCode', 'course code')}
        <input id="meta-course-code" class="ls-input" type="text" value=${metadata.courseCode}
          placeholder="e.g. CS301" onInput=${(e) => this.setMetadata('courseCode', e.target.value)} />
      <//>

      <${Field} id="meta-language" label="Language">
        <select id="meta-language" class="ls-select" value=${metadata.language}
          onInput=${(e) => this.setMetadata('language', e.target.value)}>
          ${LANGUAGES.map((lang) => html`<option key=${lang.value} value=${lang.value}>${lang.label} (${lang.value})</option>`)}
        </select>
      <//>

      <${Field} id="meta-year" label="Exam Year *">
        <select id="meta-year" class="ls-select" value=${metadata.year}
          onInput=${(e) => this.setMetadata('year', e.target.value)}>
          <option value="">Select year</option>
          ${years.map((year) => html`<option key=${year} value=${year}>${year}</option>`)}
        </select>
      <//>

      <${Field} id="meta-month" label="Month / Session" optional=${true}>
        <select id="meta-month" class="ls-select" value=${metadata.month}
          onInput=${(e) => this.setMetadata('month', e.target.value)}>
          <option value="">Select month</option>
          ${MONTHS.map((month) => html`<option key=${month} value=${month}>${month}</option>`)}
        </select>
      <//>

      <${Field} id="meta-semester" label="Semester" optional=${true}>
        <select id="meta-semester" class="ls-select" value=${metadata.semester}
          onInput=${(e) => this.setMetadata('semester', e.target.value)}>
          <option value="">Select semester</option>
          ${SEMESTERS.map((semester) => html`<option key=${semester.value} value=${semester.value}>${semester.label}</option>`)}
        </select>
      <//>

      <fieldset class="ls-field">
        <legend>Exam Type *</legend>
        ${suggestion('examType', 'exam type')}
        <div class="ls-links">
          ${EXAM_TYPES.map((type) => html`<label key=${type} class="ls-check">
            <input type="radio" name="examType" value=${type}
              checked=${metadata.examType === type}
              onInput=${() => this.setMetadata('examType', type)} />
            ${EXAM_TYPE_LABELS[type]}
          </label>`)}
        </div>
      </fieldset>

      <${Field} id="meta-file" label="PDF File *" error=${fileError}>
        ${file
          ? html`<div class="ls-card">
              <p><${Icon} name="file" small=${true} /> ${file.name}</p>
              <p class="ls-hint">${formatSize(file.size)}</p>
              <button type="button" class="ls-btn ls-btn--small" aria-label="Remove file" onClick=${() => this.removeFile()}>
                <${Icon} name="close" small=${true} /> Remove file
              </button>
            </div>`
          : html`<div class="ls-slot"
              onDragOver=${(e) => { e.preventDefault(); this.setState({ dragOver: true }); }}
              onDragLeave=${() => this.setState({ dragOver: false })}
              onDrop=${(e) => {
                preventDefault(e);
                this.setState({ dragOver: false });
                const dropped = e.dataTransfer?.files?.[0];
                if (dropped) this.selectFile(dropped);
              }}>
              <p><${Icon} name="upload" /> Drop PDF here or click to browse</p>
              <p>Max 50MB · PDF only</p>
              <button type="button" class="ls-btn ls-btn--small" onClick=${() => this.fileInput?.click()}>Browse files</button>
            </div>`}
        <input id="meta-file" ref=${(el) => { this.fileInput = el; }} type="file" accept=".pdf,application/pdf" hidden
          onChange=${(e) => {
            const selected = e.target.files?.[0];
            if (selected) this.selectFile(selected);
          }} />
      <//>

      ${this.identifierPreview() ? html`<details class="ls-card">
        <summary>Identifier preview</summary>
        <p class="ls-hint">${this.identifierPreview()}</p>
      </details>` : null}

      ${errors.length ? html`<${Notice} kind="error" icon="alert">${errors.join(' ')}<//>` : null}

      <p><button type="submit" class="ls-btn ls-btn--primary" disabled=${submitting}>
        ${submitting ? 'Validating...' : 'Check for Duplicates'}
      </button></p>
    </form>`;
  }

  renderDedup() {
    const { hashStatus, layer1Status, layer2Status, checkState, duplicateData } = this.state;
    return html`<div>
      <h2>Checking for duplicates</h2>
      <p class="ls-hint">Making sure this paper hasn't already been archived.</p>
      <div class="ls-card">
        <${ChecklistItem} label="Computing file fingerprint..." status=${hashStatus} />
        <${ChecklistItem} label="Searching for matching files..." status=${layer1Status} />
        <${ChecklistItem} label="Checking for matching entry..." status=${layer2Status} />
      </div>
      ${checkState === 'running' ? html`<${Busy} label="Checking for duplicates" />` : null}
      ${checkState === 'clear' ? html`<${Notice} kind="success" icon="check">This paper is new. Ready to upload.<//>` : null}
      ${checkState === 'duplicate' ? html`<${Notice} kind="warning" icon="alert">This paper is already archived.<//>` : null}
      ${checkState === 'duplicate' && duplicateData ? html`<${DuplicateCard} item=${duplicateData} />` : null}
      ${checkState !== 'running' ? html`<div class="ls-links">
        <button type="button" class="ls-btn" onClick=${() => this.setStep(1)}>Edit Details</button>
        ${checkState === 'clear' ? html`<button type="button" class="ls-btn ls-btn--primary" onClick=${() => this.setStep(3)}>Upload Paper</button>` : null}
        ${checkState === 'duplicate' ? html`<span class="ls-hint">Thanks for trying to contribute!</span>` : null}
      </div>` : null}
    </div>`;
  }

  renderUpload() {
    const { uploadStatus, uploadError, file, identifier } = this.state;
    if (uploadStatus === 'uploading') {
      return html`<div>
        <h2>Uploading to Internet Archive...</h2>
        <div class="ls-card">
          <p><${Icon} name="file" small=${true} /> ${file?.name || 'document.pdf'} ${file ? `(${formatSize(file.size)})` : ''}</p>
          <${Busy} label="This may take a moment depending on file size." />
        </div>
      </div>`;
    }
    if (uploadStatus === 'success') {
      const url = paperItemUrl(identifier);
      return html`<div>
        <${Notice} kind="success" icon="check">
          <b>Paper archived successfully!</b>
          <p>Permanently available at: <a class="ls-out" href=${url} target="_blank" rel="noopener noreferrer">${url}</a></p>
        <//>
        <div class="ls-links">
          <a class="ls-btn ls-btn--primary" href=${url} target="_blank" rel="noopener noreferrer">View Paper</a>
          <button type="button" class="ls-btn" onClick=${() => this.resetWizard()}>Upload Another</button>
        </div>
        <p class="ls-hint">Archive.org will process the PDF for full-text search and page-by-page preview within a few hours.</p>
      </div>`;
    }
    if (uploadStatus === 'error') {
      const info = ERROR_MESSAGES[uploadError] || ERROR_MESSAGES.rejected;
      const retry = uploadError === 'slow_down' || uploadError === 'network';
      return html`<div>
        <${Notice} kind="error" icon=${info.icon}>
          <b>${info.title}</b>
          <p>${info.message}</p>
        <//>
        <div class="ls-links">
          ${retry ? html`<button type="button" class="ls-btn ls-btn--primary" onClick=${() => { this.uploadRunFor = null; this.runUpload(); }}><${Icon} name="retry" small=${true} /> Retry</button>` : null}
          ${uploadError === 'rejected' ? html`<button type="button" class="ls-btn" onClick=${() => this.setStep(1)}>Edit Details</button>` : null}
          ${uploadError === 'session_expired' ? html`<button type="button" class="ls-btn" onClick=${this.props.openAuth}>Sign in again</button>` : null}
        </div>
      </div>`;
    }
    return null;
  }

  render(props) {
    if (!props.auth) {
      return html`<section>
        <h1>Upload a Question Paper</h1>
        <p>Contribute to the archive by uploading previous year exam papers.</p>
        <${AuthGate} openAuth=${props.openAuth} />
      </section>`;
    }

    if (this.state.showCamera) {
      return html`<${Camera}
        notify=${props.notify}
        onCancel=${() => this.closeCamera()}
        onOcr=${(suggestions, status) => this.handleCameraOcr(suggestions, status)}
        onComplete=${(blob, status) => this.handleCameraComplete(blob, status)} />`;
    }

    const { step, source, file } = this.state;
    const showPicker = !file && !source;

    return html`<section>
      <h1>Upload a Question Paper</h1>
      <p>Contribute to the archive by uploading previous year exam papers.</p>
      ${showPicker
        ? html`<${SourcePicker}
            cameraAvailable=${hasCamera()}
            openCamera=${() => this.openCamera()}
            openPdf=${() => this.setState({ source: 'pdf_upload', step: 1 })}
            openBulk=${() => props.navigate('upload/bulk')} />`
        : html`<div>
            <${StepIndicator} step=${step} />
            ${step === 1 ? this.renderMetadata() : null}
            ${step === 2 ? this.renderDedup() : null}
            ${step === 3 ? this.renderUpload() : null}
          </div>`}
    </section>`;
  }
}

export default Upload;

function preventDefault(event) {
  if (event && event.preventDefault) event.preventDefault();
}

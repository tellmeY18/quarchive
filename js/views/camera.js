import { h, Component } from '../../vendor/preact.module.js';
import htm from '../../vendor/htm.module.js';
import { Icon } from '../icons.js';
import { Busy, Notice, Sheet, prevent } from '../components.js';
import { OCR_TIMEOUT_MS } from '../constants.js';
import { extractFromOcr } from '../metadataExtract.js';
import {
  blobToBitmap,
  detectQuad,
  processFrame,
  reprocessPage,
  reprocessWithCorners,
  warpToRect,
} from '../capture.js';
import { imagesToPdf } from '../imageToPdf.js';
import { initScribe, ocrFirstImage } from '../ocr.js';

const html = htm.bind(h);

const MODE_LABELS = {
  fast: 'Fast',
  auto: 'Auto',
  bw: 'B&W',
  colour: 'Colour',
};

const MODES = ['fast', 'auto', 'bw', 'colour'];

const CAMERA_CONSTRAINTS = {
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    advanced: [{ focusMode: 'continuous' }],
  },
  audio: false,
};

function emptySuggestions() {
  return { courseName: null, courseCode: null, examType: null, year: null, month: null };
}

function pageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function revokeUrl(url) {
  try {
    if (url && url.startsWith('blob:') && typeof URL !== 'undefined') URL.revokeObjectURL(url);
  } catch { /* object URLs are best-effort */ }
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function fullCorners(width, height) {
  return [[0, 0], [width, 0], [width, height], [0, height]];
}

function copyCorners(corners) {
  return (corners || []).map((point) => [point[0], point[1]]);
}

/** Camera → page review → PDF preview, using the framework-free capture modules. */
export class Camera extends Component {
  constructor(props) {
    super(props);
    this.state = {
      phase: 'capture',
      pages: [],
      currentIndex: 0,
      cameraError: null,
      cameraReady: false,
      capturing: false,
      focused: false,
      torchOn: false,
      torchAvailable: null,
      enhanceMode: 'fast',
      reprocessing: {},
      cropPageId: null,
      cropBitmap: null,
      cropCorners: null,
      cropBusy: false,
      converting: false,
      progress: 0,
      pdfBlob: null,
      ocrStatus: 'idle',
      ocrSuggestions: emptySuggestions(),
      error: '',
    };
    this.alive = true;
    this.video = null;
    this.stream = null;
    this.track = null;
    this.focusTimer = null;
    this.previewTimer = null;
    this.previewSeq = 0;
    this.sourceCanvas = null;
    this.previewCanvas = null;
    this.draggingCorner = null;
    this.ocrRunFor = null;
    this.onKeyDown = this.onKeyDown.bind(this);
    this.setVideo = this.setVideo.bind(this);
  }

  componentDidMount() {
    this.alive = true;
    document.addEventListener('keydown', this.onKeyDown);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.setState({ cameraError: 'not_supported' });
      return;
    }
    this.startCamera();
  }

  componentDidUpdate(previousProps, previousState) {
    const cropChanged = previousState.cropBitmap !== this.state.cropBitmap
      || previousState.cropCorners !== this.state.cropCorners;
    if (cropChanged && this.state.cropBitmap && this.state.cropCorners) {
      this.drawCropSource();
      this.scheduleCropPreview();
    }
  }

  componentWillUnmount() {
    this.alive = false;
    document.removeEventListener('keydown', this.onKeyDown);
    if (this.focusTimer) clearTimeout(this.focusTimer);
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewSeq += 1;
    this.stopCamera();
    this.releasePages();
    try {
      if (this.state.cropBitmap && typeof this.state.cropBitmap.close === 'function') {
        this.state.cropBitmap.close();
      }
    } catch { /* bitmap already closed */ }
    this.cropBitmap = null;
  }

  onKeyDown(event) {
    if (event?.key !== 'Escape' || !this.state.cropPageId) return;
    prevent(event);
    this.closeCropEditor();
  }

  setVideo(element) {
    this.video = element;
    // A new ref callback on every render would make Preact reattach the same
    // stream, resetting the video and dropping the preview. Only set it when
    // the element actually changes streams.
    if (element && this.stream && element.srcObject !== this.stream) {
      element.srcObject = this.stream;
    }
  }

  releasePages() {
    for (const page of this.state.pages) revokeUrl(page.dataUrl);
  }

  async startCamera() {
    if (this.stream || this.state.cameraError) return;
    this.setState({ cameraError: null, cameraReady: false });
    try {
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      if (!this.alive) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      this.track = stream.getVideoTracks()[0] || null;
      if (this.video) this.video.srcObject = stream;
      const caps = this.track?.getCapabilities?.();
      if (caps && Object.prototype.hasOwnProperty.call(caps, 'torch')) {
        this.setState({ torchAvailable: !!caps.torch });
      }
    } catch (error) {
      const denied = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError';
      if (this.alive) {
        this.setState({
          cameraError: denied ? 'permission_denied' : 'not_supported',
          cameraReady: false,
        });
      }
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.track = null;
    if (this.video) this.video.srcObject = null;
    if (this.alive) this.setState({ cameraReady: false, torchOn: false });
  }

  onVideoReady() {
    if (this.alive) this.setState({ cameraReady: true });
  }

  captureFrame() {
    const video = this.video;
    if (!video || video.readyState < 2) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    // Mirror object-fit: cover so the saved frame matches the viewfinder.
    const cw = video.clientWidth || vw;
    const ch = video.clientHeight || vh;
    const scale = Math.max(cw / vw, ch / vh);
    const sw = Math.min(vw, Math.round(cw / scale));
    const sh = Math.min(vh, Math.round(ch / scale));
    const sx = Math.max(0, Math.round((vw - sw) / 2));
    const sy = Math.max(0, Math.round((vh - sh) / 2));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
    });
  }

  visibleCropRect() {
    const video = this.video;
    if (!video) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    const cw = video.clientWidth || vw;
    const ch = video.clientHeight || vh;
    const scale = Math.max(cw / vw, ch / vh);
    const sw = Math.min(vw, Math.round(cw / scale));
    const sh = Math.min(vh, Math.round(ch / scale));
    return {
      sx: Math.max(0, Math.round((vw - sw) / 2)),
      sy: Math.max(0, Math.round((vh - sh) / 2)),
      sw,
      sh,
      vw,
      vh,
    };
  }

  async focusAt(clientX, clientY) {
    const track = this.track;
    const video = this.video;
    if (!track || !video) return false;
    const rect = video.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) return false;
    const visible = this.visibleCropRect();
    if (!visible) return false;

    const x = (visible.sx + (localX / rect.width) * visible.sw) / visible.vw;
    const y = (visible.sy + (localY / rect.height) * visible.sh) / visible.vh;
    const pointsOfInterest = [{ x: clamp(x, 0, 1), y: clamp(y, 0, 1) }];
    try {
      await track.applyConstraints({ advanced: [{ focusMode: 'single-shot', pointsOfInterest }] });
      return true;
    } catch {
      try {
        await track.applyConstraints({ advanced: [{ pointsOfInterest }] });
        return true;
      } catch {
        return false;
      }
    }
  }

  handleTap(event) {
    if (!this.state.cameraReady) return;
    if (event?.clientX == null || event?.clientY == null) return;
    this.setState({ focused: true });
    if (this.focusTimer) clearTimeout(this.focusTimer);
    this.focusTimer = setTimeout(() => {
      if (this.alive) this.setState({ focused: false });
    }, 800);
    Promise.resolve(this.focusAt(event.clientX, event.clientY)).catch(() => { /* visual is the feedback */ });
  }

  async toggleTorch() {
    const next = !this.state.torchOn;
    const track = this.track;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      if (!this.alive) return;
      this.setState({ torchOn: next, torchAvailable: true });
    } catch {
      if (!this.alive) return;
      this.setState({ torchAvailable: false });
      this.props.notify?.("Flash isn't available on this camera. Try a brighter spot instead.", 'warning');
    }
  }

  async handleCapture() {
    if (this.state.capturing || !this.state.cameraReady) return;
    this.setState({ capturing: true, error: '' });
    const isFirstPage = this.state.pages.length === 0;
    let rawBlob = null;
    try {
      rawBlob = await this.captureFrame();
    } catch { /* handled below */ }
    if (!this.alive) return;
    if (!rawBlob) {
      this.setState({ capturing: false, error: "Couldn't grab frame — try again" });
      this.props.notify?.("Couldn't grab frame — try again", 'error');
      return;
    }

    const dataUrl = URL.createObjectURL(rawBlob);
    const page = {
      id: pageId(),
      blob: rawBlob,
      dataUrl,
      timestamp: Date.now(),
      baseBlob: rawBlob,
      rawBlob,
      crop: { corners: null, mode: 'none', confidence: null },
      enhanceMode: this.state.enhanceMode,
      width: 0,
      height: 0,
    };
    this.setState((state) => ({ pages: [...state.pages, page], capturing: false }));
    this.processPage(page);
    if (isFirstPage) this.startOcr(rawBlob);
  }

  async processPage(page) {
    try {
      const result = await processFrame(page.rawBlob, { enhanceMode: this.state.enhanceMode });
      if (!this.alive) return;
      this.updatePage(page.id, {
        blob: result.blob,
        dataUrl: result.dataUrl,
        baseBlob: result.baseBlob || page.rawBlob,
        crop: result.crop,
        width: result.width,
        height: result.height,
      });
      revokeUrl(page.dataUrl);
    } catch {
      if (this.alive) this.setState({ error: 'Processing failed — kept the original page.' });
    }
  }

  async startOcr(blob) {
    if (this.ocrRunFor === blob) return;
    this.ocrRunFor = blob;
    this.setState({ ocrStatus: 'running', error: '' });
    this.props.onOcr?.(emptySuggestions(), 'running');
    try {
      await initScribe({ vendorPath: '/vendor/scribe/' });
      const { text } = await ocrFirstImage(blob, {
        maxPages: 1,
        language: 'eng',
        timeout: OCR_TIMEOUT_MS,
      });
      if (!this.alive) return;
      const { suggestions } = extractFromOcr(text || '');
      this.setState({ ocrStatus: 'done', ocrSuggestions: suggestions });
      this.props.onOcr?.(suggestions, 'done');
    } catch {
      if (!this.alive) return;
      this.setState({ ocrStatus: 'failed' });
      this.props.onOcr?.(emptySuggestions(), 'failed');
    }
  }

  updatePage(id, patch) {
    this.setState((state) => ({
      pages: state.pages.map((page) => (page.id === id ? { ...page, ...patch } : page)),
    }));
  }

  currentPage() {
    return this.state.pages[this.state.currentIndex] || null;
  }

  handleDone() {
    if (this.state.pages.length === 0) {
      this.props.onCancel?.();
      return;
    }
    this.stopCamera();
    this.setState({ phase: 'review', currentIndex: 0 });
  }

  backToCapture() {
    this.setState({ phase: 'capture' });
    this.startCamera();
  }

  handleReviewRetake() {
    this.backToCapture();
  }

  handlePreviewRetake() {
    this.releasePages();
    this.setState({
      phase: 'capture',
      pages: [],
      currentIndex: 0,
      pdfBlob: null,
      progress: 0,
      ocrStatus: 'idle',
      ocrSuggestions: emptySuggestions(),
    });
    this.ocrRunFor = null;
    this.backToCapture();
  }

  removePage() {
    const page = this.currentPage();
    if (!page) return;
    revokeUrl(page.dataUrl);
    this.setState((state) => {
      const pages = state.pages.filter((item) => item.id !== page.id);
      return {
        pages,
        currentIndex: Math.min(state.currentIndex, Math.max(0, pages.length - 1)),
      };
    });
  }

  movePage(delta) {
    const index = this.state.currentIndex;
    const next = index + delta;
    const pages = this.state.pages;
    if (next < 0 || next >= pages.length) return;
    const reordered = pages.slice();
    [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    this.setState({ pages: reordered, currentIndex: next });
  }

  goToPage(index) {
    this.setState({ currentIndex: clamp(index, 0, this.state.pages.length - 1) });
  }

  async changeEnhanceMode(mode) {
    const page = this.currentPage();
    if (!page || page.enhanceMode === mode || this.state.reprocessing[page.id]) return;
    if (!page.baseBlob) {
      this.updatePage(page.id, { enhanceMode: mode });
      this.setState({ enhanceMode: mode });
      this.props.notify?.(`${MODE_LABELS[mode] || mode} will apply to new captures`);
      return;
    }
    this.setState((state) => ({ reprocessing: { ...state.reprocessing, [page.id]: true }, error: '' }));
    this.props.notify?.(`Applying ${MODE_LABELS[mode] || mode}…`, 'info', 0);
    try {
      const result = await reprocessPage(page.baseBlob, mode);
      if (!this.alive) return;
      revokeUrl(page.dataUrl);
      this.updatePage(page.id, {
        blob: result.blob,
        dataUrl: result.dataUrl,
        width: result.width,
        height: result.height,
        enhanceMode: mode,
      });
      this.setState({ enhanceMode: mode });
    } catch {
      if (!this.alive) return;
      this.updatePage(page.id, { enhanceMode: mode });
      this.setState({ error: "Couldn't re-enhance that page — kept the previous version" });
    } finally {
      if (this.alive) {
        this.setState((state) => {
          const reprocessing = { ...state.reprocessing };
          delete reprocessing[page.id];
          return { reprocessing };
        });
      }
    }
  }

  async openCropEditor() {
    const page = this.currentPage();
    const source = page?.rawBlob || page?.baseBlob || page?.blob;
    if (!page || !source) return;
    this.setState({ error: '' });
    try {
      const bitmap = await blobToBitmap(source);
      if (!this.alive) {
        if (typeof bitmap.close === 'function') bitmap.close();
        return;
      }
      const corners = copyCorners(page.crop?.corners);
      this.setState({
        cropPageId: page.id,
        cropBitmap: bitmap,
        cropCorners: corners.length === 4 ? corners : fullCorners(bitmap.width, bitmap.height),
        cropBusy: false,
      });
    } catch {
      if (this.alive) this.setState({ error: "Couldn't open the crop editor for this page" });
    }
  }

  closeCropEditor() {
    const bitmap = this.state.cropBitmap;
    try {
      if (bitmap && typeof bitmap.close === 'function') bitmap.close();
    } catch { /* already closed */ }
    this.draggingCorner = null;
    this.setState({ cropPageId: null, cropBitmap: null, cropCorners: null, cropBusy: false });
  }

  pointerToSource(event) {
    const canvas = this.sourceCanvas;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const clientX = event?.clientX ?? event?.touches?.[0]?.clientX;
    const clientY = event?.clientY ?? event?.touches?.[0]?.clientY;
    if (clientX == null || clientY == null) return null;
    return [
      ((clientX - rect.left) / rect.width) * canvas.width,
      ((clientY - rect.top) / rect.height) * canvas.height,
    ];
  }

  handleCropPointerDown(event) {
    prevent(event);
    const point = this.pointerToSource(event);
    const corners = this.state.cropCorners;
    const bitmap = this.state.cropBitmap;
    if (!point || !corners || !bitmap) return;
    const scale = this.sourceCanvas ? this.sourceCanvas.width / Math.max(1, this.sourceCanvas.getBoundingClientRect().width) : 1;
    const hit = Math.max(22, 44 * scale * 1.2);
    let best = -1;
    let bestDistance = Infinity;
    corners.forEach((corner, index) => {
      const distance = Math.hypot(point[0] - corner[0], point[1] - corner[1]);
      if (distance < hit && distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    if (best < 0) return;
    this.draggingCorner = best;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch { /* synthetic pointers may reject capture */ }
  }

  handleCropPointerMove(event) {
    if (this.draggingCorner == null) return;
    prevent(event);
    const point = this.pointerToSource(event);
    const bitmap = this.state.cropBitmap;
    if (!point || !bitmap) return;
    const scale = this.sourceCanvas ? this.sourceCanvas.width / Math.max(1, this.sourceCanvas.getBoundingClientRect().width) : 1;
    const snap = Math.max(6, 20 * scale);
    const next = point.map((value, axis) => {
      const size = axis === 0 ? bitmap.width : bitmap.height;
      if (value < snap) return 0;
      if (size - value < snap) return size - 1;
      return clamp(value, 0, size - 1);
    });
    this.setState((state) => ({
      cropCorners: state.cropCorners.map((corner, index) => (index === this.draggingCorner ? next : corner)),
    }));
  }

  handleCropPointerUp(event) {
    if (this.draggingCorner == null) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch { /* already released */ }
    this.draggingCorner = null;
  }

  nudgeCorner(index, dx, dy) {
    const bitmap = this.state.cropBitmap;
    if (!bitmap || !this.state.cropCorners) return;
    const step = Math.max(4, Math.round(bitmap.width * 0.01));
    this.setState((state) => ({
      cropCorners: state.cropCorners.map((corner, i) => (i === index
        ? [clamp(corner[0] + dx * step, 0, bitmap.width - 1), clamp(corner[1] + dy * step, 0, bitmap.height - 1)]
        : corner)),
    }));
  }

  drawCropSource() {
    const canvas = this.sourceCanvas;
    const bitmap = this.state.cropBitmap;
    const corners = this.state.cropCorners;
    if (!canvas || !bitmap || !corners || corners.length !== 4) return;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    ctx.strokeStyle = 'currentColor';
    ctx.fillStyle = 'currentColor';
    ctx.lineWidth = Math.max(2, Math.round(bitmap.width / 400));
    ctx.beginPath();
    ctx.moveTo(corners[0][0], corners[0][1]);
    for (let i = 1; i < 4; i += 1) ctx.lineTo(corners[i][0], corners[i][1]);
    ctx.closePath();
    ctx.stroke();
    const half = Math.max(22, Math.round(bitmap.width / 80));
    corners.forEach((corner, index) => {
      ctx.globalAlpha = index === this.draggingCorner ? 1 : 0.8;
      ctx.fillRect(corner[0] - half, corner[1] - half, half * 2, half * 2);
      ctx.globalAlpha = 1;
      ctx.strokeRect(corner[0] - half, corner[1] - half, half * 2, half * 2);
    });
    ctx.restore();
  }

  scheduleCropPreview() {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    const seq = ++this.previewSeq;
    this.previewTimer = setTimeout(() => this.renderCropPreview(seq), 80);
  }

  async renderCropPreview(seq) {
    const bitmap = this.state.cropBitmap;
    const corners = this.state.cropCorners;
    const canvas = this.previewCanvas;
    if (!bitmap || !corners || !canvas) return;
    try {
      const warped = await warpToRect(bitmap, corners);
      if (!this.alive || seq !== this.previewSeq || this.state.cropBitmap !== bitmap) {
        if (warped !== bitmap && typeof warped.close === 'function') warped.close();
        return;
      }
      canvas.width = warped.width;
      canvas.height = warped.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(warped, 0, 0);
      }
      if (warped !== bitmap && typeof warped.close === 'function') warped.close();
    } catch {
      if (this.alive && seq === this.previewSeq) {
        this.setState({ error: 'Crop preview unavailable — Save Crop still works.' });
      }
    }
  }

  resetCropFull() {
    const bitmap = this.state.cropBitmap;
    if (!bitmap) return;
    this.setState({ cropCorners: fullCorners(bitmap.width, bitmap.height), error: '' });
  }

  resetCropAuto() {
    const bitmap = this.state.cropBitmap;
    if (!bitmap) return;
    try {
      const detected = detectQuad(bitmap);
      if (detected && detected.corners?.length === 4 && detected.confidence >= 0.6) {
        this.setState({ cropCorners: copyCorners(detected.corners), error: '' });
      } else {
        this.setState({
          cropCorners: fullCorners(bitmap.width, bitmap.height),
          error: 'Auto detection found no paper edges — using the full frame.',
        });
      }
    } catch {
      this.setState({
        cropCorners: fullCorners(bitmap.width, bitmap.height),
        error: 'Auto detection failed — using the full frame.',
      });
    }
  }

  async saveCrop() {
    const page = this.currentPage();
    const corners = this.state.cropCorners;
    const source = page?.rawBlob || page?.baseBlob;
    if (!page || !corners || !source) {
      this.closeCropEditor();
      return;
    }
    this.setState({ cropBusy: true, error: '' });
    try {
      const result = await reprocessWithCorners(source, corners, page.enhanceMode || this.state.enhanceMode || 'fast');
      if (!this.alive) return;
      revokeUrl(page.dataUrl);
      this.updatePage(page.id, {
        blob: result.blob,
        dataUrl: result.dataUrl,
        baseBlob: result.baseBlob || source,
        crop: result.crop,
        width: result.width,
        height: result.height,
      });
      this.props.notify?.('Crop saved', 'success', 1500);
    } catch {
      if (this.alive) this.setState({ error: "Couldn't save the crop — kept the previous version" });
    } finally {
      if (this.alive) this.closeCropEditor();
    }
  }

  async assemblePdf() {
    const pages = this.state.pages;
    if (!pages.length) return;
    this.setState({ phase: 'preview', converting: true, progress: 0, error: '' });
    this.props.notify?.(pages.length > 1 ? `Creating PDF from ${pages.length} pages…` : 'Creating PDF…', 'info', 0);
    try {
      const pdfBlob = await imagesToPdf(pages.map((page) => page.blob), (progress) => {
        if (this.alive) this.setState({ progress });
      });
      if (!this.alive) return;
      this.setState({ pdfBlob, converting: false, progress: 1 });
      this.props.notify?.('PDF ready', 'success', 1500);
    } catch {
      if (!this.alive) return;
      this.setState({ phase: 'review', converting: false, error: "Couldn't create the PDF — please try again" });
      this.props.notify?.("Couldn't create the PDF — please try again", 'error', 4000);
    }
  }

  renderPermissionError(title, message) {
    return html`<section>
      <div class="ls-card ls-callout ls-callout--error" role="alert">
        <${Icon} name="lock" />
        <div>
          <h2>${title}</h2>
          <p>${message}</p>
          <button type="button" class="ls-btn ls-btn--primary" onClick=${() => this.props.onCancel?.()}>Upload PDF instead</button>
        </div>
      </div>
    </section>`;
  }

  renderCapture() {
    const { pages, cameraReady, capturing, focused, torchOn, torchAvailable, cameraError, ocrStatus, error } = this.state;
    if (cameraError === 'permission_denied') {
      return this.renderPermissionError(
        'Camera Permission Denied',
        'Please enable camera access in your browser settings to scan papers, or fallback to PDF upload.',
      );
    }
    if (cameraError === 'not_supported') {
      return this.renderPermissionError(
        'Camera Not Supported',
        'Your device doesnt support camera access. Please upload a PDF.',
      );
    }
    return html`<section aria-label="Scan question paper">
      <h1>Scan Question Paper</h1>
      <div class="ls-card">
        <div class="ls-slot">
          <video
            ref=${this.setVideo}
            autoPlay
            playsInline
            muted
            aria-label="Live camera view"
            onClick=${(event) => this.handleTap(event)}
            onLoadedData=${() => this.onVideoReady()}
            onPlaying=${() => this.onVideoReady()}
            onCanPlay=${() => this.onVideoReady()}
          ></video>
          ${!cameraReady ? html`<${Busy} label="Starting camera…" />` : null}
          ${cameraReady ? html`<p class="ls-hint">Position paper in frame</p>` : null}
          ${cameraReady && pages.length === 0 && !focused ? html`<p class="ls-hint">Tap to focus</p>` : null}
          ${focused ? html`<p role="status">Focusing…</p>` : null}
        </div>
        ${pages.length ? html`<ul class="ls-tags" aria-label="Captured pages">
          ${pages.map((page, index) => html`<li key=${page.id}>
            <img src=${page.dataUrl} alt=${`Page ${index + 1}`} width="48" height="64" />
          </li>`)}
          <li><span class="ls-chip">${pages.length} ${pages.length === 1 ? 'page' : 'pages'}</span></li>
        </ul>` : null}
        <div class="ls-links">
          <button
            type="button"
            class="ls-btn ls-btn--small"
            disabled=${!cameraReady || torchAvailable === false}
            aria-pressed=${torchOn}
            aria-label=${torchAvailable === false
              ? 'Flash not available on this camera'
              : torchOn ? 'Turn off flash' : 'Turn on flash'}
            onClick=${() => this.toggleTorch()}
          >
            <${Icon} name="sun" small=${true} /> Flash ${torchOn ? 'on' : 'off'}
          </button>
          <button
            type="button"
            class="ls-btn ls-btn--primary"
            disabled=${capturing || !cameraReady}
            aria-busy=${capturing}
            aria-label=${capturing ? 'Processing page' : cameraReady ? 'Capture page' : 'Camera starting'}
            onClick=${() => this.handleCapture()}
          >
            <${Icon} name="camera" small=${true} /> ${capturing ? 'Processing page…' : 'Capture page'}
          </button>
          ${pages.length ? html`<button type="button" class="ls-btn" disabled=${capturing} onClick=${() => this.handleDone()}>Done (${pages.length})</button>` : null}
        </div>
        ${ocrStatus === 'running' ? html`<${Busy} label="Reading first page…" />` : null}
        ${ocrStatus === 'failed' ? html`<${Notice} kind="warning" icon="info">Reading the page failed — you can enter the details by hand.<//>` : null}
        ${error ? html`<${Notice} kind="error" icon="alert">${error}<//>` : null}
      </div>
    </section>`;
  }

  renderReview() {
    const { pages, currentIndex, reprocessing, ocrStatus, error } = this.state;
    const page = this.currentPage();
    const total = pages.length;
    if (total === 0) {
      return html`<section>
        <${Notice} kind="info" icon="info">No pages captured.<//>
        <p><button type="button" class="ls-btn ls-btn--primary" onClick=${() => this.backToCapture()}>Open Camera</button></p>
      </section>`;
    }
    const busy = !!page && !!reprocessing[page.id];
    const canAdjust = !!(page && (page.rawBlob || page.baseBlob));
    const enhanceMode = page?.enhanceMode || 'fast';
    return html`<section>
      <h1>Review Pages</h1>
      <p class="ls-hint" role="status" aria-live="polite">Page ${currentIndex + 1} of ${total}</p>
      <div class="ls-card">
        ${page ? html`<img src=${page.dataUrl} alt=${`Page ${currentIndex + 1}`} />` : null}
        ${busy ? html`<${Busy} label="Processing…" />` : null}
        <div class="ls-links">
          <button type="button" class="ls-btn ls-btn--small" onClick=${() => this.handleReviewRetake()}><${Icon} name="back" small=${true} /> Retake</button>
          <button type="button" class="ls-btn ls-btn--small" disabled=${currentIndex <= 0} aria-label="Move page up" onClick=${() => this.movePage(-1)}><${Icon} name="prev" small=${true} /> Move up</button>
          <button type="button" class="ls-btn ls-btn--small" disabled=${currentIndex >= total - 1} aria-label="Move page down" onClick=${() => this.movePage(1)}><${Icon} name="next" small=${true} /> Move down</button>
          <button type="button" class="ls-btn ls-btn--small" disabled=${currentIndex <= 0} aria-label="Previous page" onClick=${() => this.goToPage(currentIndex - 1)}>Previous</button>
          <button type="button" class="ls-btn ls-btn--small" disabled=${currentIndex >= total - 1} aria-label="Next page" onClick=${() => this.goToPage(currentIndex + 1)}>Next</button>
        </div>
        ${total > 1 ? html`<ul class="ls-tags" aria-label="Pages">
          ${pages.map((item, index) => html`<li key=${item.id}>
            <button type="button" class="ls-btn ls-btn--small" aria-current=${index === currentIndex ? 'true' : null} aria-label=${`Go to page ${index + 1}`} onClick=${() => this.goToPage(index)}>${index + 1}</button>
          </li>`)}
        </ul>` : null}
        <div class="ls-links">
          <button type="button" class="ls-btn" disabled=${!canAdjust || busy} onClick=${() => this.openCropEditor()}><${Icon} name="search" small=${true} /> Adjust edges</button>
          <button type="button" class="ls-btn ls-btn--danger" onClick=${() => this.removePage()}><${Icon} name="trash" small=${true} /> Delete</button>
        </div>
        <fieldset class="ls-field">
          <legend>Enhancement mode</legend>
          <div class="ls-links">
            ${MODES.map((mode) => html`<button key=${mode} type="button" class="ls-btn ls-btn--small" disabled=${busy} aria-pressed=${enhanceMode === mode} onClick=${() => this.changeEnhanceMode(mode)}>${MODE_LABELS[mode]}</button>`)}
          </div>
        </fieldset>
        ${ocrStatus === 'running' ? html`<${Busy} label="Reading first page…" />` : null}
        ${ocrStatus === 'failed' ? html`<${Notice} kind="warning" icon="info">Reading the page failed — you can enter the details by hand.<//>` : null}
        ${error ? html`<${Notice} kind="error" icon="alert">${error}<//>` : null}
      </div>
      <p><button type="button" class="ls-btn ls-btn--primary" disabled=${busy || total === 0} onClick=${() => this.assemblePdf()}>Use These Pages</button></p>
    </section>`;
  }

  renderCropEditor() {
    if (!this.state.cropPageId || !this.state.cropBitmap) return null;
    const cornerNames = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
    const footer = html`<div class="ls-links">
      <button type="button" class="ls-btn" disabled=${this.state.cropBusy} onClick=${() => this.closeCropEditor()}>Cancel</button>
      <button type="button" class="ls-btn ls-btn--primary" aria-busy=${this.state.cropBusy} disabled=${this.state.cropBusy} onClick=${() => this.saveCrop()}>Save Crop</button>
    </div>`;
    return html`<${Sheet} title="Adjust edges" onClose=${() => this.closeCropEditor()} footer=${footer}>
      <p class="ls-hint">Drag the corners to fit the paper edges. Preview updates live.</p>
      <div class="ls-card">
        <canvas
          ref=${(element) => { this.sourceCanvas = element; }}
          role="img"
          aria-label="Paper corner handles"
          onPointerDown=${(event) => this.handleCropPointerDown(event)}
          onPointerMove=${(event) => this.handleCropPointerMove(event)}
          onPointerUp=${(event) => this.handleCropPointerUp(event)}
          onPointerCancel=${(event) => this.handleCropPointerUp(event)}
        ></canvas>
        <canvas ref=${(element) => { this.previewCanvas = element; }} role="img" aria-label="Cropped paper preview"></canvas>
      </div>
      <fieldset class="ls-field">
        <legend>Move corners with the keyboard</legend>
        ${cornerNames.map((name, index) => html`<div key=${name} class="ls-links">
          <span class="ls-chip">${name}</span>
          <button type="button" class="ls-btn ls-btn--small" aria-label=${`Move ${name} corner left`} onClick=${() => this.nudgeCorner(index, -1, 0)}>←</button>
          <button type="button" class="ls-btn ls-btn--small" aria-label=${`Move ${name} corner up`} onClick=${() => this.nudgeCorner(index, 0, -1)}>↑</button>
          <button type="button" class="ls-btn ls-btn--small" aria-label=${`Move ${name} corner down`} onClick=${() => this.nudgeCorner(index, 0, 1)}>↓</button>
          <button type="button" class="ls-btn ls-btn--small" aria-label=${`Move ${name} corner right`} onClick=${() => this.nudgeCorner(index, 1, 0)}>→</button>
        </div>`)}
      </fieldset>
      <div class="ls-links">
        <button type="button" class="ls-btn" onClick=${() => this.resetCropAuto()}>Reset to Auto</button>
        <button type="button" class="ls-btn" onClick=${() => this.resetCropFull()}>Full Frame</button>
      </div>
      ${this.state.cropBusy ? html`<${Busy} label="Saving crop…" />` : null}
      ${this.state.error ? html`<${Notice} kind="error" icon="alert">${this.state.error}<//>` : null}
    <//>`;
  }

  renderPreview() {
    const { converting, progress, pdfBlob, pages, ocrStatus, error } = this.state;
    if (converting) {
      return html`<section>
        <h2>Creating PDF...</h2>
        <div class="ls-card">
          <${Busy} label="Assembling your scanned pages." />
          <progress value=${progress} max="1" aria-label="PDF progress">${Math.round(progress * 100)}%</progress>
          <p class="ls-hint" role="status">${Math.round(progress * 100)}%</p>
        </div>
      </section>`;
    }
    if (!pdfBlob) {
      return html`<section>
        <${Notice} kind="error" icon="alert">No PDF generated yet.<//>
        <p><button type="button" class="ls-btn" onClick=${() => this.handlePreviewRetake()}>Retake</button></p>
      </section>`;
    }
    return html`<section>
      <div class="ls-card">
        <h2>PDF Ready</h2>
        <${Notice} kind="success" icon="check">${pages.length} ${pages.length === 1 ? 'page' : 'pages'} · ${formatSize(pdfBlob.size)}<//>
        <ul class="ls-tags" aria-label="Scanned pages">
          ${pages.map((page, index) => html`<li key=${page.id}>
            <img src=${page.dataUrl} alt=${`Page ${index + 1}`} width="96" height="128" />
          </li>`)}
        </ul>
        ${ocrStatus === 'running' ? html`<${Busy} label="Reading first page…" />` : null}
        ${ocrStatus === 'failed' ? html`<${Notice} kind="warning" icon="info">Reading the page failed — you can enter the details by hand.<//>` : null}
        ${error ? html`<${Notice} kind="error" icon="alert">${error}<//>` : null}
        <div class="ls-links">
          <button type="button" class="ls-btn" onClick=${() => this.handlePreviewRetake()}><${Icon} name="back" small=${true} /> Retake</button>
          <button type="button" class="ls-btn ls-btn--primary" onClick=${() => this.props.onComplete?.(pdfBlob, ocrStatus)}>Looks Good <${Icon} name="check" small=${true} /></button>
        </div>
      </div>
    </section>`;
  }

  render() {
    const { phase } = this.state;
    return html`<div>
      ${phase === 'capture' ? this.renderCapture() : null}
      ${phase === 'review' ? this.renderReview() : null}
      ${phase === 'preview' ? this.renderPreview() : null}
      ${this.renderCropEditor()}
    </div>`;
  }
}

export default Camera;

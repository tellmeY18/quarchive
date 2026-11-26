import { h, Component } from '../vendor/preact.module.js';
import htm from '../vendor/htm.module.js';
import { Icon } from './icons.js';
import { Busy, Notice } from './components.js';

const html = htm.bind(h);

/** Proxy Archive.org PDFs through the same-origin /api/pdf worker. */
export function proxyPdfUrl(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.hostname === 'archive.org' || parsed.hostname.endsWith('.archive.org')) {
      return `/api/pdf?url=${encodeURIComponent(url)}`;
    }
  } catch { /* let pdf.js try the original URL */ }
  return url;
}

/**
 * Minimal canvas PDF viewer. pdf.js is imported only when a paper is opened,
 * so the rest of the app never pays for it.
 */
export class PdfViewer extends Component {
  constructor(props) {
    super(props);
    this.state = { loading: true, error: '', numPages: 0, page: 1 };
    this.mounted = false;
    this.doc = null;
    this.task = null;
    this.renderTask = null;
    this.resizeTimer = null;
    this.onResize = this.onResize.bind(this);
    this.prev = this.prev.bind(this);
    this.next = this.next.bind(this);
    this.retry = this.retry.bind(this);
  }

  componentDidMount() {
    this.mounted = true;
    window.addEventListener('resize', this.onResize);
    this.load();
  }

  componentDidUpdate(prevProps, prevState) {
    const becameReady = prevState.loading && !this.state.loading && !this.state.error;
    const pageChanged = this.state.page !== prevState.page;
    if ((becameReady || pageChanged) && !this.state.loading && !this.state.error) {
      this.renderPage(this.state.page);
    }
  }

  componentWillUnmount() {
    this.mounted = false;
    window.removeEventListener('resize', this.onResize);
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    try { if (this.renderTask) this.renderTask.cancel(); } catch { /* already done */ }
    try { if (this.task) this.task.destroy(); } catch { /* already done */ }
    try { if (this.doc) this.doc.destroy(); } catch { /* already done */ }
    this.doc = null;
  }

  load() {
    this.setState({ loading: true, error: '' });
    import('../vendor/pdfjs/pdf.mjs')
      .then((pdfjs) => {
        if (!this.mounted) return null;
        pdfjs.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.mjs';
        this.task = pdfjs.getDocument({ url: proxyPdfUrl(this.props.url) });
        return this.task.promise;
      })
      .then((doc) => {
        if (!doc) return;
        if (!this.mounted) { doc.destroy(); return; }
        this.doc = doc;
        this.setState({ numPages: doc.numPages, page: 1, loading: false });
      })
      .catch((error) => {
        if (!this.mounted || error?.name === 'AbortException') return;
        this.setState({ loading: false, error: error?.message || 'Could not load PDF preview' });
      });
  }

  renderPage(pageNum) {
    const doc = this.doc;
    const canvas = this.canvas;
    const container = this.container;
    if (!doc || !canvas || !container) return;
    if (this.renderTask) {
      try { this.renderTask.cancel(); } catch { /* already finished */ }
      this.renderTask = null;
    }
    doc.getPage(pageNum)
      .then((page) => {
        if (!this.mounted) return null;
        const width = Math.max(container.clientWidth, 240);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width / base.width });
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.renderTask = page.render({ canvasContext: ctx, viewport });
        return this.renderTask.promise;
      })
      .then(() => { this.renderTask = null; })
      .catch((error) => {
        this.renderTask = null;
        if (this.mounted && error?.name !== 'RenderingCancelledException') {
          this.setState({ error: error?.message || 'Could not render this page' });
        }
      });
  }

  onResize() {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      if (!this.state.loading && !this.state.error) this.renderPage(this.state.page);
    }, 150);
  }

  prev() {
    this.setState((state) => ({ page: Math.max(1, state.page - 1) }));
  }

  next() {
    this.setState((state) => ({ page: Math.min(state.numPages, state.page + 1) }));
  }

  retry() {
    this.load();
  }

  render(props, state) {
    if (!props.url) {
      return html`<${Notice} kind="info" icon="info">No PDF URL provided.</${Notice}>`;
    }
    if (state.loading) {
      return html`<${Busy} label="Loading PDF preview…" />`;
    }
    if (state.error) {
      return html`<${Notice} kind="danger" icon="alert" action=${{ label: 'Retry', onClick: this.retry }}>
        Could not load PDF preview — ${state.error}
      </${Notice}>`;
    }
    return html`<div>
      <div class="ls-btn-group">
        <button type="button" class="ls-btn ls-btn--small" disabled=${state.page <= 1} aria-label="Previous page" onClick=${this.prev}>
          <${Icon} name="prev" small=${true} /> Prev
        </button>
        <span role="status">Page ${state.page} of ${state.numPages}</span>
        <button type="button" class="ls-btn ls-btn--small" disabled=${state.page >= state.numPages} aria-label="Next page" onClick=${this.next}>
          Next <${Icon} name="next" small=${true} />
        </button>
      </div>
      <div class="pdf-viewer" ref=${(el) => { this.container = el; }}>
        <canvas class="pdf-canvas" ref=${(el) => { this.canvas = el; }} aria-label=${`PDF page ${state.page}`}></canvas>
      </div>
    </div>`;
  }
}

export default PdfViewer;

import { h, Component } from '../../vendor/preact.module.js';
import htm from '../../vendor/htm.module.js';
import { Icon } from '../icons.js';
import { apiGet } from '../fetch.js';
import { buildMetadataUrl, paperItemUrl, paperDownloadUrl, paperThumbnail } from '../archive.js';
import { Busy, Notice, TagList, Empty } from '../components.js';
import PdfViewer from '../pdfViewer.js';

const html = htm.bind(h);

const LANGUAGES = {
  en: 'English', ml: 'Malayalam', hi: 'Hindi', ta: 'Tamil', te: 'Telugu',
  kn: 'Kannada', bn: 'Bengali', mr: 'Marathi', gu: 'Gujarati', pa: 'Punjabi',
  or: 'Odia', ur: 'Urdu',
};

function scalar(value) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function findPdf(files) {
  if (!Array.isArray(files)) return null;
  return files.find((file) => file.format === 'Text PDF')
    || files.find((file) => String(file.name || '').toLowerCase().endsWith('.pdf'))
    || null;
}

function languageLabel(code) {
  const key = String(code || '').toLowerCase().trim();
  return LANGUAGES[key] || code;
}

export class Paper extends Component {
  constructor(props) {
    super(props);
    this.state = { paper: null, pdfFilename: '', loading: true, notFound: false, error: '' };
    this.controller = null;
    this.retry = this.retry.bind(this);
  }

  componentDidMount() {
    this.load();
  }

  componentWillUnmount() {
    if (this.controller) this.controller.abort();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.params?.id !== this.props.params?.id) {
      this.setState({ paper: null, pdfFilename: '', loading: true, notFound: false, error: '' });
      this.load();
    }
  }

  load() {
    const id = this.props.params?.id;
    if (!id) {
      this.setState({ loading: false, notFound: true });
      return;
    }
    if (this.controller) this.controller.abort();
    this.controller = new AbortController();
    this.setState({ loading: true, error: '' });
    apiGet(buildMetadataUrl(id), { signal: this.controller.signal })
      .then(async (response) => {
        if (response.status === 404) {
          this.setState({ loading: false, notFound: true });
          return;
        }
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        const data = await response.json();
        if (data?.error || !data?.metadata) {
          this.setState({ loading: false, notFound: true });
          return;
        }
        const meta = data.metadata;
        const pdf = findPdf(data.files);
        this.setState({
          loading: false,
          notFound: false,
          pdfFilename: pdf?.name || '',
          paper: {
            identifier: id,
            title: scalar(meta.title),
            description: scalar(meta.description),
            institution: scalar(meta.creator),
            year: scalar(meta.date),
            language: languageLabel(scalar(meta.language)),
            examType: scalar(meta['exam-type']),
            semester: scalar(meta.semester),
            courseCode: scalar(meta['course-code']),
            program: scalar(meta.program),
            subjects: Array.isArray(meta.subject) ? meta.subject : [meta.subject].filter(Boolean),
          },
        });
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        this.setState({ loading: false, error: error?.message || 'Could not load this paper' });
      });
  }

  retry() {
    this.load();
  }

  render(props, state) {
    if (state.loading) return html`<${Busy} label="Loading paper…" />`;

    if (state.error) {
      return html`<${Notice} kind="danger" icon="alert" action=${{ label: 'Retry', onClick: this.retry }}>
        Could not load this paper — ${state.error}
      </${Notice}>`;
    }

    if (state.notFound || !state.paper) {
      return html`<div>
        <h1>Paper not found</h1>
        <p>This paper may have been removed or the link may be incorrect.</p>
        <a class="ls-btn" href="#/"><${Icon} name="back" small=${true} /> Back to Home</a>
      </div>`;
    }

    const paper = state.paper;
    const id = paper.identifier;
    const downloadUrl = state.pdfFilename ? paperDownloadUrl(id, state.pdfFilename) : '';
    const archiveUrl = paperItemUrl(id);
    const title = paper.description || paper.title || id;
    const tags = [
      paper.year ? `${paper.year}` : '',
      paper.examType,
      paper.semester ? `Semester ${paper.semester}` : '',
      paper.language,
      paper.program,
      paper.courseCode,
    ];

    return html`<article>
      <nav aria-label="Breadcrumb">
        <a class="ls-out" href="#/">Home</a>
        ${paper.institution ? html` › ${paper.institution}` : null}
        ${paper.courseCode ? html` › ${paper.courseCode}` : null}
      </nav>

      <h1>${title}</h1>
      ${paper.institution ? html`<p>${paper.institution}</p>` : null}
      ${paper.title && paper.description ? html`<p class="ls-hint">${paper.title}</p>` : null}
      <${TagList} tags=${tags} label="Paper details" />

      ${paperThumbnail(id) ? html`<p><img src=${paperThumbnail(id)} alt=${`Cover of ${title}`} loading="lazy" /></p>` : null}

      <div>
        ${downloadUrl ? html`<a class="ls-btn ls-btn--primary" href=${downloadUrl} target="_blank" rel="noopener noreferrer">
          <${Icon} name="download" small=${true} /> Download PDF
        </a>` : null}
        <a class="ls-btn" href=${archiveUrl} target="_blank" rel="noopener noreferrer">
          View on Archive.org <${Icon} name="external" small=${true} />
        </a>
      </div>

      ${downloadUrl ? html`<${PdfViewer} url=${downloadUrl} />` : html`<${Empty} icon="file" title="No PDF preview available for this paper.">
        <a class="ls-out" href=${archiveUrl} target="_blank" rel="noopener noreferrer">View all files on Archive.org →</a>
      </${Empty}>`}
    </article>`;
  }
}

export default Paper;

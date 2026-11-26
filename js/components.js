import { h, Component } from '../vendor/preact.module.js';
import htm from '../vendor/htm.module.js';
import { Icon } from './icons.js';
import { getInstitutionList, searchInstitutions } from './wikidata.js';
import { paperThumbnail, paperItemUrl } from './archive.js';

const html = htm.bind(h);

export function Field({ label, id, hint, error, children, optional }) {
  return html`<div class="ls-field">
    <label for=${id}>${label}${optional ? html` <span class="ls-hint">(optional)</span>` : null}</label>
    ${children}
    ${error
      ? html`<p class="ls-callout ls-callout--error" role="alert"><${Icon} name="alert" small=${true} /> <span>${error}</span></p>`
      : hint ? html`<p class="ls-hint" id=${`${id}-hint`}>${hint}</p>` : null}
  </div>`;
}

export class Sheet extends Component {
  dialog = null;
  componentDidMount() { if (this.dialog && !this.dialog.open) this.dialog.showModal(); }
  componentWillUnmount() { if (this.dialog?.open) this.dialog.close(); }
  render({ title, onClose, children, footer }) {
    return html`<dialog class="ls-sheet" ref=${(el) => { this.dialog = el; }} aria-label=${title} onCancel=${(e) => { e.preventDefault(); onClose(); }}>
      <div class="ls-sheet__handle" aria-hidden="true"></div>
      <div class="ls-sheet__head">
        <h2>${title}</h2>
        <button type="button" class="ls-btn ls-btn--small" aria-label="Close" onClick=${onClose}><${Icon} name="close" small=${true} /></button>
      </div>
      <div class="ls-sheet__body">${children}</div>
      ${footer ? html`<div class="ls-sheet__foot">${footer}</div>` : null}
    </dialog>`;
  }
}

export function TagList({ tags, label }) {
  const list = (tags || []).filter(Boolean);
  if (!list.length) return null;
  return html`<ul class="ls-tags" aria-label=${label || 'Details'}>
    ${list.map((tag, i) => html`<li key=${i}><span class="ls-tag">${tag}</span></li>`)}
  </ul>`;
}

export function Busy({ label, small }) {
  return html`<p class="ls-callout ls-callout--info" role="status" aria-live="polite">
    <${Icon} name="clock" small=${small !== false} /> <span>${label}</span>
  </p>`;
}

export function Notice({ kind, icon, children, action }) {
  const variant = kind === 'error' || kind === 'danger' ? 'error' : kind === 'success' ? 'success' : kind === 'warning' ? 'warning' : 'info';
  const name = icon || (variant === 'error' ? 'alert' : variant === 'success' ? 'check' : 'info');
  return html`<div class=${`ls-callout ls-callout--${variant}`} role=${variant === 'error' ? 'alert' : 'status'}>
    <${Icon} name=${name} small=${true} />
    <div>
      <div>${children}</div>
      ${action ? html`<button type="button" class="ls-btn ls-btn--small" onClick=${action.onClick}>${action.label}</button>` : null}
    </div>
  </div>`;
}

export function Empty({ icon, title, children }) {
  return html`<div class="ls-slot">
    <p><${Icon} name=${icon || 'search'} /> <b>${title}</b></p>
    ${children ? html`<p>${children}</p>` : null}
  </div>`;
}

export function PaperCard({ paper, onClick }) {
  const title = paper.title || paper.identifier || 'Untitled paper';
  const identifier = paper.identifier || '';
  const thumb = identifier ? paperThumbnail(identifier) : '';
  const institution = paper.institution || paper.institutionName || paper['institution-name'] || '';
  const year = paper.year || paper.date || '';
  const detail = [institution, year].filter(Boolean).join(' · ');
  const inner = html`${thumb
    ? html`<img src=${thumb} alt="" loading="lazy" width="80" height="80" />`
    : html`<span aria-hidden="true"><${Icon} name="file" /></span>`}
    <span>
      <strong class="paper-title">${title}</strong>
      ${detail ? html`<span class="paper-meta">${detail}</span>` : null}
      ${paper.examType ? html`<span class="ls-tag">${paper.examType}</span>` : null}
    </span>`;
  return html`<li class="paper-card">
    ${onClick
      ? html`<button type="button" onClick=${onClick} aria-label=${`Open ${title}`}>${inner}</button>`
      : html`<a href=${paperItemUrl(identifier)} target="_blank" rel="noopener noreferrer">${inner}</a>`}
  </li>`;
}

// Shared async institution autocomplete used by the upload wizard and bulk
// sheet. Suggestions are optional: any typed name is accepted as-is.
export class InstitutionField extends Component {
  constructor(props) {
    super(props);
    this.state = { suggestions: [], open: false, busy: false };
    this.seq = 0;
    this.timer = null;
    this.onInput = this.onInput.bind(this);
    this.close = this.close.bind(this);
  }

  componentWillUnmount() {
    if (this.timer) clearTimeout(this.timer);
    this.seq += 1;
  }

  onInput(event) {
    const value = event.target.value;
    this.props.onChange(value, '');
    if (this.timer) clearTimeout(this.timer);
    if (!value.trim()) {
      this.setState({ suggestions: [], open: false, busy: false });
      return;
    }
    this.setState({ open: true, busy: true });
    const seq = ++this.seq;
    this.timer = setTimeout(() => {
      Promise.resolve()
        .then(() => getInstitutionList())
        .then((list) => searchInstitutions(value, list || []))
        .then((items) => {
          if (seq === this.seq) this.setState({ suggestions: items || [], busy: false, open: true });
        })
        .catch(() => {
          if (seq === this.seq) this.setState({ suggestions: [], busy: false });
        });
    }, 250);
  }

  choose(item) {
    this.props.onChange(item.label || item.name || '', item.qid || item.id || '');
    this.setState({ suggestions: [], open: false, busy: false });
  }

  close() {
    this.setState({ open: false });
  }

  render(props, state) {
    const id = props.id || 'institution';
    const listId = `${id}-suggestions`;
    return html`<div>
      <input id=${id} class="ls-input" type="text" autocomplete="off" role="combobox"
        aria-expanded=${state.open && state.suggestions.length > 0 ? 'true' : 'false'}
        aria-controls=${listId} aria-autocomplete="list" placeholder=${props.placeholder || 'Search institutions'}
        value=${props.value || ''} onInput=${this.onInput} onBlur=${() => setTimeout(this.close, 150)} />
      ${state.busy ? html`<p class="ls-hint" role="status">Searching institutions…</p>` : null}
      ${state.open && state.suggestions.length
        ? html`<ul id=${listId} role="listbox" class="ls-tags">
            ${state.suggestions.map((item, i) => {
              const label = item.label || item.name || '';
              return html`<li key=${item.qid || i} role="option" aria-selected="false">
                <button type="button" class="ls-btn ls-btn--small" onMouseDown=${(e) => e.preventDefault()} onClick=${() => this.choose(item)}>${label}${item.description ? html` — ${item.description}` : null}</button>
              </li>`;
            })}
          </ul>`
        : null}
      ${props.qid ? html`<p class="ls-hint"><${Icon} name="check" small=${true} /> Linked to Wikidata ${props.qid}</p>` : null}
    </div>`;
  }
}

export function prevent(event) {
  if (event && event.preventDefault) event.preventDefault();
}

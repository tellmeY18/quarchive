import { h, Component } from '../../vendor/preact.module.js';
import htm from '../../vendor/htm.module.js';
import { getInstitutionList } from '../wikidata.js';
import { formatRoute } from '../route.js';
import { Busy, Notice, Empty } from '../components.js';

const html = htm.bind(h);
const INITIAL_SHOW_COUNT = 12;

const EXAM_TYPES = [
  ['main', 'Main'], ['supplementary', 'Supplementary'], ['model', 'Model'],
  ['improvement', 'Improvement'], ['end-semester', 'End Semester'],
  ['midsemester', 'Midsemester'], ['make-up', 'Make Up'],
  ['re-exam', 'Re-Exam'], ['save-a-year', 'Save A Year'],
];

function years() {
  const result = [];
  for (let year = new Date().getFullYear(); year >= 2015; year -= 1) result.push(String(year));
  return result;
}

export class Browse extends Component {
  constructor(props) {
    super(props);
    this.state = { universities: [], loading: true, error: '', showAll: false };
    this.load = this.load.bind(this);
  }

  componentDidMount() {
    this.load();
  }

  load() {
    this.setState({ loading: true, error: '' });
    getInstitutionList()
      .then((list) => this.setState({ universities: Array.isArray(list) ? list : [], loading: false }))
      .catch((error) => this.setState({ loading: false, error: error?.message || 'Failed to load universities' }));
  }

  render(props, state) {
    const visible = state.showAll ? state.universities : state.universities.slice(0, INITIAL_SHOW_COUNT);
    const homeLink = (params) => formatRoute({ view: 'home', params });

    return html`<section>
      <h1>Browse Papers</h1>
      <p>Find question papers by university, year, or exam type.</p>

      <h2>By University</h2>
      ${state.loading ? html`<${Busy} label="Loading universities…" />` : null}
      ${state.error ? html`<${Notice} kind="danger" icon="alert" action=${{ label: 'Try again', onClick: this.load }}>Could not load universities — ${state.error}</${Notice}>` : null}
      ${!state.loading && !state.error && !visible.length ? html`<${Empty} title="No universities available">Try again later.</${Empty}>` : null}
      ${visible.length ? html`<ul class="paper-grid">
        ${visible.map((uni) => html`<li key=${uni.qid} class="paper-card">
          <a class="ls-out" href=${homeLink({ university: uni.qid, universityName: uni.label })}>
            <span>${uni.label}</span>
            ${uni.altLabel ? html`<span class="ls-hint">${uni.altLabel}</span>` : null}
          </a>
        </li>`)}
      </ul>` : null}
      ${state.universities.length > INITIAL_SHOW_COUNT ? html`<button type="button" class="ls-btn ls-btn--small"
        onClick=${() => this.setState({ showAll: !state.showAll })}>
        ${state.showAll ? 'Show fewer' : `Show all ${state.universities.length} universities`}
      </button>` : null}

      <h2>By Year</h2>
      <ul class="paper-grid">
        ${years().map((year) => html`<li key=${year} class="paper-card">
          <a class="ls-out" href=${homeLink({ year })}>${year}</a>
        </li>`)}
      </ul>

      <h2>By Exam Type</h2>
      <ul class="paper-grid">
        ${EXAM_TYPES.map(([value, label]) => html`<li key=${value} class="paper-card">
          <a class="ls-out" href=${homeLink({ examType: value })}>${label}</a>
        </li>`)}
      </ul>
    </section>`;
  }
}

export default Browse;

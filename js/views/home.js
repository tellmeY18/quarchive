import { h, Component } from '../../vendor/preact.module.js';
import htm from '../../vendor/htm.module.js';
import { Icon } from '../icons.js';
import { searchPapers, archiveCount } from '../archive.js';
import { SEARCH_DEBOUNCE_MS } from '../constants.js';
import { Busy, Notice, PaperCard, Empty } from '../components.js';

const html = htm.bind(h);
const PAGE_ROWS = 20;

const FILTER_GROUPS = [
  { label: 'Year', key: 'date', chips: ['2024', '2023', '2022', '2021', '2020', '2019'] },
  {
    label: 'Exam type',
    key: 'exam-type',
    chips: [
      ['main', 'Main'], ['supplementary', 'Supplementary'], ['model', 'Model'],
      ['improvement', 'Improvement'], ['end-semester', 'End semester'],
      ['midsemester', 'Midsemester'], ['make-up', 'Make up'],
      ['re-exam', 'Re-exam'], ['save-a-year', 'Save a year'],
    ],
  },
  {
    label: 'Language',
    key: 'language',
    chips: [
      ['en', 'English'], ['ml', 'Malayalam'], ['hi', 'Hindi'],
      ['ta', 'Tamil'], ['te', 'Telugu'], ['kn', 'Kannada'],
    ],
  },
];

function initialFilters(params = {}) {
  const filters = {};
  if (params.year) filters.date = params.year;
  if (params.examType) filters['exam-type'] = params.examType;
  if (params.university) filters.subject = params.university;
  return filters;
}

export class Home extends Component {
  constructor(props) {
    super(props);
    const params = props.params || {};
    const query = params.q || '';
    this.state = {
      text: query,
      query,
      filters: initialFilters(params),
      universityName: params.universityName || '',
      results: [],
      totalResults: 0,
      page: 1,
      loading: false,
      error: '',
      count: null,
    };
    this.seq = 0;
    this.controller = null;
    this.timer = null;
    this.onInput = this.onInput.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.clearSearch = this.clearSearch.bind(this);
    this.toggleFilter = this.toggleFilter.bind(this);
    this.clearFilters = this.clearFilters.bind(this);
    this.clearUniversity = this.clearUniversity.bind(this);
    this.loadMore = this.loadMore.bind(this);
    this.retry = this.retry.bind(this);
  }

  componentDidMount() {
    this.runSearch(this.state, 1, false);
    archiveCount()
      .then((count) => this.setState({ count }))
      .catch(() => this.setState({ count: 0 }));
  }

  componentWillUnmount() {
    if (this.timer) clearTimeout(this.timer);
    if (this.controller) this.controller.abort();
    this.seq += 1;
  }

  runSearch(source, page = 1, append = false) {
    if (this.controller) this.controller.abort();
    const controller = new AbortController();
    this.controller = controller;
    const seq = ++this.seq;
    const { query, filters } = source;
    this.setState({ loading: true, error: '', page });

    searchPapers({ query, filters, page, rows: PAGE_ROWS, signal: controller.signal })
      .then((data) => {
        if (seq !== this.seq) return;
        this.setState({
          results: append ? [...this.state.results, ...data.results] : data.results,
          totalResults: data.totalResults,
          loading: false,
        });
      })
      .catch((error) => {
        if (seq !== this.seq || error?.name === 'AbortError') return;
        this.setState({ loading: false, error: error?.message || 'Search failed. Please try again.' });
      });
  }

  commit(value) {
    if (this.timer) clearTimeout(this.timer);
    if (value === this.state.query) return;
    const next = { ...this.state, query: value };
    this.setState({ query: value });
    this.runSearch(next, 1, false);
  }

  onInput(event) {
    const value = event.target.value;
    this.setState({ text: value });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.commit(value), SEARCH_DEBOUNCE_MS);
  }

  onKeyDown(event) {
    if (event.key === 'Enter' || event.key === 'Escape') {
      if (event.key === 'Escape') this.setState({ text: '' });
      this.commit(event.key === 'Escape' ? '' : this.state.text);
      if (event.preventDefault) event.preventDefault();
    }
  }

  clearSearch() {
    this.setState({ text: '' });
    this.commit('');
  }

  toggleFilter(key, value) {
    const filters = { ...this.state.filters };
    if (filters[key] === value) delete filters[key];
    else filters[key] = value;
    const next = { ...this.state, filters };
    this.setState({ filters });
    this.runSearch(next, 1, false);
  }

  clearFilters() {
    const filters = {};
    const next = { ...this.state, filters, universityName: '' };
    this.setState({ filters, universityName: '' });
    this.runSearch(next, 1, false);
    if (this.props.navigate) this.props.navigate('home', {});
  }

  clearUniversity() {
    const filters = { ...this.state.filters };
    delete filters.subject;
    const next = { ...this.state, filters };
    this.setState({ filters, universityName: '' });
    this.runSearch(next, 1, false);
    if (this.props.navigate) this.props.navigate('home', {});
  }

  loadMore() {
    if (this.state.loading || this.state.results.length >= this.state.totalResults) return;
    this.runSearch(this.state, this.state.page + 1, true);
  }

  retry() {
    this.runSearch(this.state, 1, false);
  }

  render(props, state) {
    const hasQuery = Boolean(state.query.trim());
    const chipKeys = Object.keys(state.filters).filter((key) => key !== 'subject');
    const hasChipFilters = chipKeys.length > 0;
    const hasUniversity = Boolean(state.filters.subject);
    const isFiltered = hasQuery || hasChipFilters || hasUniversity;
    const sectionTitle = hasQuery
      ? `Search Results for “${state.query}”`
      : isFiltered ? 'Filtered Results' : 'Recent Uploads';
    const countText = hasQuery || hasChipFilters
      ? `${state.totalResults} paper${state.totalResults === 1 ? '' : 's'} found`
      : '';
    const emptyMessage = hasQuery
      ? `No papers found for “${state.query}”`
      : isFiltered
        ? 'No papers match the selected filters'
        : 'No papers uploaded yet. Be the first to contribute!';
    const stats = [
      ['Papers Archived', state.count === null ? '—' : state.count.toLocaleString()],
      ['Universities', '—'],
      ['Languages', '—'],
      ['States', '—'],
    ];

    return html`<section>
      <div class="ls-slot">
        <h1>Discover Previous Year Question Papers</h1>
        <p>Search, browse, and download university exam papers. Free forever, powered by the Internet Archive.</p>
        <div class="ls-field">
          <label class="ls-vh" for="home-search">Search papers</label>
          <div class="ls-links">
            <input id="home-search" class="ls-input" type="search" value=${state.text}
              placeholder="Search by university, course, or year..." onInput=${this.onInput}
              onKeyDown=${this.onKeyDown} />
            ${state.text ? html`<button type="button" class="ls-btn ls-btn--small" aria-label="Clear search" onClick=${this.clearSearch}><${Icon} name="close" small=${true} /></button>` : null}
          </div>
        </div>
      </div>

      <ul class="ls-tags" aria-label="Archive statistics">
        ${stats.map(([label, value]) => html`<li key=${label}><span class="ls-chip"><b>${value}</b> ${label}</span></li>`)}
      </ul>

      <h2>Filters</h2>
      ${FILTER_GROUPS.map((group) => html`<div key=${group.key}>
        <p class="ls-hint">${group.label}</p>
        <ul class="ls-tags">
          ${group.chips.map((chip) => {
            const value = Array.isArray(chip) ? chip[0] : chip;
            const label = Array.isArray(chip) ? chip[1] : chip;
            const active = state.filters[group.key] === value;
            return html`<li key=${value}>
              <button type="button" class="ls-chip" aria-pressed=${active ? 'true' : 'false'}
                onClick=${() => this.toggleFilter(group.key, value)}>${label}</button>
            </li>`;
          })}
        </ul>
      </div>`)}
      ${Object.keys(state.filters).length ? html`<button type="button" class="ls-btn ls-btn--small" onClick=${this.clearFilters}>Clear all filters</button>` : null}

      ${hasUniversity && state.universityName ? html`<p class="ls-callout ls-callout--info">
        <${Icon} name="info" small=${true} />
        <span>Papers from ${state.universityName}. <button type="button" class="ls-btn ls-btn--small" onClick=${this.clearUniversity}>Clear</button></span>
      </p>` : null}

      <h2>${sectionTitle}${countText ? html` <span class="ls-hint">${countText}</span>` : null}</h2>

      ${state.error ? html`<${Notice} kind="danger" icon="alert" action=${{ label: 'Retry', onClick: this.retry }}>Search failed — ${state.error}</${Notice}>` : null}

      ${state.loading && !state.results.length ? html`<${Busy} label="Searching the archive…" />` : null}
      ${!state.loading && !state.results.length && !state.error ? html`<${Empty} title=${emptyMessage}>Try a different search, or contribute a paper.</${Empty}>` : null}

      ${state.results.length ? html`<ul class="paper-grid">
        ${state.results.map((paper) => html`<${PaperCard} key=${paper.identifier} paper=${paper}
          onClick=${() => props.navigate('paper', { id: paper.identifier })} />`)}
      </ul>` : null}
      ${state.loading && state.results.length ? html`<${Busy} label="Loading more papers…" small=${true} />` : null}
      ${state.results.length < state.totalResults && !state.loading ? html`<button type="button" class="ls-btn" onClick=${this.loadMore}>Load more papers</button>` : null}
    </section>`;
  }
}

export default Home;

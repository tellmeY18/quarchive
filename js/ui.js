import { h, Component } from '../vendor/preact.module.js';
import htm from '../vendor/htm.module.js';
import { Icon } from './icons.js';
import { parseHash, formatRoute } from './route.js';
import { loadAuth, validateAuth } from './auth.js';
import { APP_VERSION, REPO_URL } from './config.js';
import { checkForUpdate } from './update.js';
import { Sheet } from './components.js';
import Home from './views/home.js';
import Browse from './views/browse.js';
import Paper from './views/paper.js';
import Upload from './views/upload.js';
import Bulk from './views/bulk.js';
import About from './views/about.js';
import AuthView from './views/auth.js';

const html = htm.bind(h);

const VIEWS = {
  home: Home,
  browse: Browse,
  paper: Paper,
  upload: Upload,
  'upload/bulk': Bulk,
  about: About,
};

const NAV = [
  { view: 'home', label: 'Home', icon: 'home' },
  { view: 'browse', label: 'Browse', icon: 'search' },
  { view: 'upload', label: 'Upload', icon: 'camera' },
  { view: 'about', label: 'About', icon: 'info' },
];

/** App shell: owns routing, session state, theme and the single toast slot. */
export class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      route: parseHash(),
      auth: null,
      authOpen: false,
      toast: null,
      theme: this.readTheme(),
    };
    this.toastTimer = null;
    this.toastId = 0;
    this.onHashChange = this.onHashChange.bind(this);
    this.onUpdate = this.onUpdate.bind(this);
    this.notify = this.notify.bind(this);
    this.clearToast = this.clearToast.bind(this);
    this.setAuth = this.setAuth.bind(this);
    this.openAuth = this.openAuth.bind(this);
    this.closeAuth = this.closeAuth.bind(this);
    this.toggleTheme = this.toggleTheme.bind(this);
    this.go = this.go.bind(this);
  }

  readTheme() {
    try {
      return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }

  componentDidMount() {
    window.addEventListener('hashchange', this.onHashChange);
    window.addEventListener('quarchive-update', this.onUpdate);

    const stored = loadAuth();
    if (stored) {
      this.setState({ auth: stored });
      validateAuth(stored)
        .then((ok) => {
          if (!ok) this.setAuth(null);
        })
        .catch(() => { /* keep the cached session until the user acts */ });
    }
  }

  componentWillUnmount() {
    window.removeEventListener('hashchange', this.onHashChange);
    window.removeEventListener('quarchive-update', this.onUpdate);
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  onHashChange() {
    this.setState({ route: parseHash(), authOpen: false });
    const main = document.getElementById('main');
    if (main && main.focus) main.focus({ preventScroll: true });
  }

  onUpdate() {
    this.notify('A new version is ready — reload to apply.', 'info', 6000);
  }

  go(view, params = {}) {
    const hash = formatRoute({ view, params });
    if (window.location.hash === hash) this.onHashChange();
    else window.location.hash = hash;
  }

  notify(message, variant = 'info', duration = 3000) {
    if (!message) return null;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    const id = ++this.toastId;
    this.setState({ toast: { id, message, variant, duration } });
    if (duration > 0) {
      this.toastTimer = setTimeout(() => this.clearToast(id), duration);
    }
    return id;
  }

  clearToast(id) {
    const current = this.state.toast;
    if (!current || (id != null && current.id !== id)) return;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.setState({ toast: null });
  }

  setAuth(auth) {
    this.setState({ auth: auth || null, authOpen: false });
  }

  openAuth() {
    this.setState({ authOpen: true });
  }

  closeAuth() {
    this.setState({ authOpen: false });
  }

  toggleTheme() {
    const theme = this.state.theme === 'dark' ? 'light' : 'dark';
    try {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem('quarchive:theme', JSON.stringify(theme));
    } catch { /* private mode: the in-memory theme still toggles */ }
    this.setState({ theme });
  }

  render(props, state) {
    const { route } = state;
    const View = VIEWS[route.view] || Home;
    const viewProps = {
      route,
      params: route.params,
      auth: state.auth,
      setAuth: this.setAuth,
      navigate: this.go,
      notify: this.notify,
      openAuth: this.openAuth,
      closeAuth: this.closeAuth,
      theme: state.theme,
      toggleTheme: this.toggleTheme,
    };

    return html`<div class="app">
      <a class="ls-skip" href="#main">Skip to content</a>
      <header class="app-header">
        <div class="header-inner">
          <a class="brand" href="#/" aria-label="Quarchive home">
            <span class="ls-mark ls-mark--fit ls-mark--animate" aria-hidden="true"><mark>quarchive</mark></span>
            <span class="ls-vh">Quarchive — question paper archive</span>
          </a>
          <div class="ls-links">
            <a class="ls-out" href="#/browse">Browse</a>
            <a class="ls-out" href="#/about">About</a>
            <button type="button" class="theme ls-btn ls-btn--small" onClick=${this.toggleTheme}
              aria-label=${`Switch to ${state.theme === 'dark' ? 'light' : 'dark'} theme`}>
              <${Icon} name=${state.theme === 'dark' ? 'sun' : 'moon'} small=${true} />
              ${state.theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
      </header>

      <main id="main" class="page page--with-nav" tabindex="-1">
        <${View} key=${`${route.view}:${route.params.id || ''}`} ...${viewProps} />
      </main>

      <footer class="foot">
        <p>An open-source archive of previous year university exam question papers.</p>
        <div class="ls-links">
          <button type="button" class="ls-btn ls-btn--small" onClick=${() => this.checkVersion()}>Version ${APP_VERSION}</button>
          <a class="ls-out" href=${REPO_URL} target="_blank" rel="noopener noreferrer">Source</a>
          <a class="ls-out" href="#/about">About</a>
        </div>
        <p>Powered by Internet Archive · Institution data from Wikidata.</p>
      </footer>

      <nav class="bottom-nav" aria-label="Main navigation">
        <ul class="ls-bottombar">
          ${NAV.map((item) => html`<li key=${item.view}>
            <a href=${item.view === 'home' ? '#/' : `#/${item.view}`}
              aria-current=${route.view === item.view ? 'page' : null}>
              <${Icon} name=${item.icon} small=${true} />
              <span>${item.label}</span>
            </a>
          </li>`)}
        </ul>
      </nav>

      ${state.toast ? html`<div class="toast-wrap">
        <div class="ls-toast" role="status" aria-live="polite">
          <${Icon} name=${state.toast.variant === 'success' ? 'check' : state.toast.variant === 'error' ? 'alert' : 'info'} small=${true} />
          <span>${state.toast.message}</span>
          <button type="button" class="ls-btn ls-btn--small" aria-label="Dismiss" onClick=${() => this.clearToast()}><${Icon} name="close" small=${true} /></button>
        </div>
      </div>` : null}

      ${state.authOpen ? html`<${Sheet} title="Sign in" onClose=${this.closeAuth}>
        <${AuthView} auth=${state.auth} setAuth=${this.setAuth} close=${this.closeAuth} notify=${this.notify} />
      </${Sheet}>` : null}
    </div>`;
  }

  checkVersion() {
    checkForUpdate({ force: true })
      .then(() => this.notify(`Quarchive ${APP_VERSION}`))
      .catch(() => this.notify(`Quarchive ${APP_VERSION}`));
  }
}

export default App;

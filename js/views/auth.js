import { h, Component } from '../../vendor/preact.module.js';
import htm from '../../vendor/htm.module.js';
import { Icon } from '../icons.js';
import { login as archiveLogin, generateS3Keys, logout as archiveLogout } from '../auth.js';
import { Field, Busy, Notice } from '../components.js';

const html = htm.bind(h);

/** Login form, also shown on its own for the sign-in sheet. */
export class AuthView extends Component {
  constructor(props) {
    super(props);
    this.state = {
      email: '', password: '', remember: false,
      busy: false, error: '', mode: 'form', cookies: null, keyError: '',
    };
    this.onSubmit = this.onSubmit.bind(this);
    this.signOut = this.signOut.bind(this);
  }

  onSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();
    const { email, password, remember } = this.state;
    this.setState({ busy: true, error: '', keyError: '' });
    archiveLogin({ email, password, remember })
      .then((result) => {
        if (!result) throw new Error('Login failed');
        if (result.success) {
          this.props.setAuth(result.user);
          this.props.notify?.('Signed in', 'success');
          this.props.close?.();
          return null;
        }
        if (result.needsKeys && result.cookies) {
          this.setState({ mode: 'keys', cookies: result.cookies, busy: false });
          return generateS3Keys({ cookies: result.cookies, email, remember });
        }
        throw new Error(result.error || 'Login failed');
      })
      .then((keyResult) => {
        if (!keyResult) return;
        if (keyResult.success) {
          this.props.setAuth(keyResult.user);
          this.props.notify?.('Upload keys ready', 'success');
          this.props.close?.();
        } else {
          this.setState({ keyError: keyResult.error || 'Failed to generate upload keys. Please try again.' });
        }
      })
      .catch((error) => {
        this.setState({ busy: false, error: error?.message || 'Connection failed — please try again' });
      })
      .finally(() => this.setState({ password: '', busy: false }));
  }

  signOut() {
    archiveLogout();
    this.props.setAuth(null);
    this.props.notify?.('Signed out', 'info');
    this.props.close?.();
  }

  render(props, state) {
    if (props.auth?.isLoggedIn) {
      return html`<div>
        <p><${Icon} name="check" small=${true} /> Signed in as ${props.auth.screenname || props.auth.email}</p>
        <button type="button" class="ls-btn" onClick=${this.signOut}>Sign Out</button>
      </div>`;
    }

    if (state.mode === 'keys') {
      return html`<div>
        <p>Your Archive.org account doesn't have upload keys yet.</p>
        ${state.busy ? html`<${Busy} label="Generating your upload keys…" />` : null}
        ${state.keyError ? html`<${Notice} kind="danger" icon="alert">${state.keyError}</${Notice}>` : null}
        <button type="button" class="ls-btn" onClick=${() => this.setState({ mode: 'form', keyError: '', cookies: null })}>
          ← Back to sign in
        </button>
      </div>`;
    }

    return html`<form onSubmit=${this.onSubmit}>
      <p>Sign in with your Internet Archive account to upload papers.</p>
      <${Field} id="login-email" label="Email">
        <input id="login-email" class="ls-input" type="email" required autocomplete="username"
          placeholder="you@example.com" disabled=${state.busy} value=${state.email}
          onInput=${(e) => this.setState({ email: e.target.value })} />
      </${Field}>
      <${Field} id="login-password" label="Password">
        <input id="login-password" class="ls-input" type="password" required autocomplete="current-password"
          placeholder="Your archive.org password" disabled=${state.busy} value=${state.password}
          onInput=${(e) => this.setState({ password: e.target.value })} />
      </${Field}>
      <p class="ls-check">
        <input id="login-remember" type="checkbox" checked=${state.remember} disabled=${state.busy}
          onInput=${(e) => this.setState({ remember: e.target.checked })} />
        <label for="login-remember">Remember me on this device</label>
      </p>
      ${state.error ? html`<${Notice} kind="danger" icon="alert">Sign in failed — ${state.error}</${Notice}>` : null}
      <button type="submit" class="ls-btn ls-btn--primary" disabled=${state.busy}>
        <${Icon} name="lock" small=${true} /> ${state.busy ? 'Signing in…' : 'Sign In'}
      </button>
      <p>Don't have an account? <a class="ls-out" href="https://archive.org/account/signup" target="_blank" rel="noopener noreferrer">Sign up at archive.org</a></p>
      <p class="ls-hint"><${Icon} name="lock" small=${true} /> Your password is sent directly to Archive.org. We never store it.</p>
    </form>`;
  }
}

export default AuthView;

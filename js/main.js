import { h, render } from '../vendor/preact.module.js';
import { App } from './ui.js';
import { startUpdates } from './update.js';

const app = document.getElementById('app');
app.replaceChildren(); // Preact adds to a container; nothing placed there before the app starts may stay behind
render(h(App), app);
startUpdates(() => dispatchEvent(new Event('quarchive-update')));

// Updates without interruption, the way Chaikadi does it. A new version installs in the background (sw.js) and
// takes over at once, but this page keeps running the old code until a safe moment, then restarts itself.
// The URL already holds the route, so the restart puts you back exactly where you were.
// Safe = the page is hidden, or you have been idle for a minute with no viewer open and no typing in progress.
import { APP_VERSION } from './config.js';

const IDLE_MS = 60 * 1000, CHECK_EVERY_MS = 30 * 60 * 1000;
let registration = null, lastCheck = 0, applying = false, takenOver = false, lastInput = Date.now(), onChange = () => {};
export const updateState = { ready: false, version: APP_VERSION };

for (const type of ['pointerdown', 'keydown', 'input', 'scroll']) addEventListener(type, () => { lastInput = Date.now(); }, { passive: true, capture: true });

function safeToRestart() {
  if (document.visibilityState === 'hidden') return true;
  if (Date.now() - lastInput < IDLE_MS) return false;
  const active = document.activeElement;
  return !document.querySelector('dialog[open]') && !(active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName));
}
function autoUpdate() { if (updateState.ready && !applying && safeToRestart()) apply(); }
function markReady() {
  if ((registration?.waiting || takenOver) && navigator.serviceWorker.controller) { updateState.ready = true; onChange(); autoUpdate(); }
}
export function apply() {
  if (applying || (!registration?.waiting && !takenOver)) return;
  applying = true;
  try { sessionStorage.setItem('quarchive:updated', '1'); } catch { /* storage blocked */ }
  if (takenOver) { location.reload(); return; }
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  setTimeout(() => location.reload(), 4000); // fallback if controllerchange never fires
}
export async function checkForUpdate({ force = false } = {}) {
  if (!registration || (!force && Date.now() - lastCheck < CHECK_EVERY_MS)) return 'skipped';
  lastCheck = Date.now();
  try { await registration.update(); } catch { return 'offline'; }
  for (let i = 0; i < 40 && registration.installing; i++) await new Promise(done => setTimeout(done, 250)); // a found update installs asynchronously
  markReady();
  return registration.waiting || takenOver ? 'ready' : 'current';
}
export const justUpdated = () => { try { const was = sessionStorage.getItem('quarchive:updated'); sessionStorage.removeItem('quarchive:updated'); return !!was; } catch { return false; } };

export function startUpdates(changed = () => {}) {
  onChange = changed;
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (applying) { location.reload(); return; }
    if (!hadController) return; // first install: this page is already current
    takenOver = true; markReady();
  });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(async reg => {
    registration = reg;
    await navigator.serviceWorker.ready;
    markReady();
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => { if (worker.state === 'installed') markReady(); });
    });
    lastCheck = Date.now();
  }).catch(() => { /* HTTPS and site storage are needed; the app works without it */ });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(); else autoUpdate(); });
  addEventListener('online', () => checkForUpdate());
  setInterval(autoUpdate, 15 * 1000);
  setInterval(() => checkForUpdate(), CHECK_EVERY_MS);
}

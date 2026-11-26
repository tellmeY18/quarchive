// Runs before first paint so the page never flashes the wrong theme. Kept as a plain file (no inline scripts).
try { document.documentElement.dataset.theme = JSON.parse(localStorage.getItem('quarchive:theme')) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch { document.documentElement.dataset.theme = 'light'; }

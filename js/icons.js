import { h } from '../vendor/preact.module.js';

// Small line icons on a 24 grid, drawn for this app (square caps and miters, like the brand's ls-icon).
const paths = {
  close: 'M5 5l14 14M19 5L5 19',
  back: 'M19 12H5M11 6l-6 6 6 6',
  prev: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  external: 'M14 3h7v7M21 3L11 13M18 14v7H3V6h7',
  info: 'M3 3h18v18H3zM12 11v6M12 7v.01',
  alert: 'M12 3L2 21h20zM12 9v5M12 17v1',
  retry: 'M20 4v6h-6M4 20v-6h6M19 10A8 8 0 0 0 5 7M5 14a8 8 0 0 0 14 3',
  moon: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
  sun: 'M7 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
  link: 'M9 15l6-6M8 7l3-3a5 5 0 0 1 7 7l-3 3M16 17l-3 3a5 5 0 0 1-7-7l3-3',
  share: 'M12 16V3M7 8l5-5 5 5M4 12v9h16v-9',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  star: 'M12 3l2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.2 6.4 20.3l1.2-6.3L3 9.6l6.3-.8z',
  graph: 'M6 6a2 2 0 1 0 0 .01M18 6a2 2 0 1 0 0 .01M12 18a2 2 0 1 0 0 .01M8 6h8M7 8l4 8M17 8l-4 8',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  home: 'M3 11l9-8 9 8M6 10v11h12V10M10 21v-6h4v6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M16 16l5 5',
  upload: 'M12 16V3M7 8l5-5 5 5M4 16v5h16v-5',
  camera: 'M3 8h4l2-3h6l2 3h4v13H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  check: 'M4 13l5 5L20 6',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l4 2',
  wifi: 'M2 8a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M9 16a5 5 0 0 1 6 0M12 20v.01',
  lock: 'M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3M12 14v3',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6',
  plus: 'M12 4v16M4 12h16',
  minus: 'M4 12h16',
  download: 'M12 3v12M7 10l5 5 5-5M4 16v5h16v-5',
  folder: 'M3 5h6l2 3h10v11H3z',
};

export function Icon({ name, small }) {
  return h('svg', { class: `ls-icon${small ? ' ls-icon--sm' : ''}`, viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, h('path', { d: paths[name] }));
}

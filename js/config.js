// APP_VERSION and the cache name in sw.js are stamped together by the deploy workflow on every release.
export const APP_VERSION = 'dev';
export const REPO_URL = 'https://github.com/tellmeY18/quarchive';
export const SITE_URL = 'https://quarchive.pages.dev/';
export const LETSIMPL_URL = 'https://letsimpl.fyi';
export const ARCHIVE_HOST = 'https://archive.org';
export const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';

// All browser storage keys start with this prefix; malformed values are cleaned on read.
export const STORAGE_PREFIX = 'quarchive:';
export const FETCH_TIMEOUT_MS = 20000;
export const OCR_BUDGET_MS = 15000;
export const RECENT_KEEP = 10, HISTORY_MAX = 200;

// Neutral interface labels; change them here and nowhere else.
export const LABELS = {
  home: 'Home', browse: 'Browse', search: 'Search', upload: 'Upload', bulk: 'Bulk upload',
  paper: 'Paper', camera: 'Camera', about: 'About', account: 'Account', download: 'Download',
};

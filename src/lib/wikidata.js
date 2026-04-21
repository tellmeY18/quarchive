/**
 * Wikidata SPARQL templates and parsers for Indian educational institution lookup.
 *
 * AGGRESSIVE MODE — designed to catch every degree-granting institution in India.
 *
 * Improvements over v1:
 * - 40+ institution type QIDs (was 11), including medical, law, agriculture, mgmt, arts, etc.
 * - P131 traversal up to 5 levels deep + P276 (location) as alternative
 * - Country-scoped fallback: P17 = Q668 for institutions whose P131 chain doesn't reach state level
 * - 100+ abbreviation/expansion entries for Indian higher-ed naming patterns
 * - Fuzzy scoring: stop-word filtering, bigram overlap, partial-acronym matching, weighted token score
 * - searchInstitutionsLocal returns ranked results (no hard score threshold — caller can filter)
 * - Multi-strategy remote search: state-scoped first, India-wide fallback if under threshold
 * - Cache versioning: changing CACHE_VERSION busts all stale caches automatically
 * - Deduplication by QID with label merging
 */

const WIKIDATA_SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_VERSION = "v4"; // bump to bust all caches

// ---------------------------------------------------------------------------
// Institution types — cast the widest net for degree-granting bodies
// ---------------------------------------------------------------------------

export const INSTITUTION_TYPES = [
  // ── Core higher education ──────────────────────────────────────────────
  "Q3918", // university
  "Q189004", // college
  "Q38723", // higher education institution  (umbrella)
  "Q875538", // public university
  "Q23002054", // private university
  "Q2354621", // deemed university (India)
  "Q15141672", // central university (India)
  "Q47531586", // Institute of National Importance (India)

  // ── Institutes of technology / engineering ────────────────────────────
  "Q1664720", // institute of technology
  "Q1371037", // institute of technology (used by many IIT/NIT entries)
  "Q902104", // polytechnic
  "Q1391170", // military academy (some engineering colleges)

  // ── Medical / health sciences ─────────────────────────────────────────
  "Q1406864", // medical school / college of medicine
  "Q1781513", // dental school
  "Q3354234", // nursing school
  "Q1572817", // pharmacy school / college of pharmacy
  "Q3918105", // veterinary school
  "Q7000969", // paramedical college  (used by some Indian Wikidata entries)

  // ── Agriculture / rural / fisheries ──────────────────────────────────
  "Q1471494", // agricultural university
  "Q27651650", // agricultural college
  "Q7163584", // college of fisheries (used in India-specific entries)

  // ── Law ───────────────────────────────────────────────────────────────
  "Q1069840", // law school
  "Q7230884", // law college

  // ── Management / business ─────────────────────────────────────────────
  "Q2149093", // management institute
  "Q1141239", // business school
  "Q5931765", // commerce college (used by some Indian entries)

  // ── Arts, science, humanities ─────────────────────────────────────────
  "Q3354859", // arts and science college
  "Q1143467", // fine arts school
  "Q1069712", // college of education (teacher training)
  "Q47460393", // teachers college

  // ── Research & specialised institutes ────────────────────────────────
  "Q31855", // research institute
  "Q15936437", // research university
  "Q622057", // professional school
  "Q1391145", // research organization (broader, catches IISER etc.)
  "Q55491", // research center
  "Q4671277", // academic institution (broad umbrella)

  // ── Information technology / computing ────────────────────────────────
  "Q23039057", // institute of information technology (IIIT family)

  // ── Design / fashion / architecture ───────────────────────────────────
  "Q1065336", // design school / college of design
  "Q1060829", // architecture school

  // ── Physical education / sports ───────────────────────────────────────
  "Q1076486", // sports school (some Indian institutes grant degrees)

  // ── Open / distance learning ──────────────────────────────────────────
  "Q23003764", // open university

  // ── Autonomous / affiliated colleges (India-specific stubs) ──────────
  "Q47258966", // autonomous college (India)
  "Q2385804", // educational institution (last-resort catch-all)
];

// Languages for label retrieval (add regional languages for better Indian coverage)
const LABEL_LANGUAGES =
  "en,ml,hi,ta,te,kn,bn,mr,gu,pa,or,as,ur,sd,mai,bho,ne,kok";

// Minimum score for a result to appear in searchInstitutionsLocal output
const MIN_SCORE_THRESHOLD = 0;

// ---------------------------------------------------------------------------
// Abbreviation expansions — Indian higher-ed naming patterns
// ---------------------------------------------------------------------------

const ABBREVIATION_EXPANSIONS = {
  // ── National institutes / central bodies ──────────────────────────────
  nit: ["national institute of technology"],
  iit: ["indian institute of technology"],
  iisc: ["indian institute of science"],
  iiser: ["indian institute of science education and research"],
  iiit: ["indian institute of information technology"],
  nift: ["national institute of fashion technology"],
  niper: ["national institute of pharmaceutical education and research"],
  nid: ["national institute of design"],
  nca: ["national college of arts"],
  iim: ["indian institute of management"],
  ism: ["indian school of mines"],
  ismu: ["indian school of mines university"],
  tiss: ["tata institute of social sciences"],
  xlri: ["xavier labour relations institute"],
  irma: ["institute of rural management anand"],
  iica: ["indian institute of corporate affairs"],
  nimhans: ["national institute of mental health and neurosciences"],
  aiims: ["all india institute of medical sciences"],
  jipmer: [
    "jawaharlal institute of postgraduate medical education and research",
  ],
  pgimer: ["postgraduate institute of medical education and research"],
  icmr: ["indian council of medical research"],
  drdo: ["defence research and development organisation"],
  isro: ["indian space research organisation"],
  bits: ["birla institute of technology and science"],
  bit: ["birla institute of technology"],
  vit: ["vellore institute of technology"],
  mit: ["manipal institute of technology"],
  sit: ["symbiosis institute of technology"],
  cbit: ["chaitanya bharathi institute of technology"],
  biet: ["basaveshwar institute of engineering and technology"],

  // ── Regional engineering colleges / older names ───────────────────────
  rec: ["regional engineering college"],
  gec: ["government engineering college"],
  cet: ["college of engineering"],
  tce: ["thiagarajar college of engineering"],
  psg: ["psg college of technology"],
  nce: ["national college of engineering"],
  ace: ["ace college of engineering"],
  kec: ["kongu engineering college"],

  // ── University abbreviations ──────────────────────────────────────────
  bhu: ["banaras hindu university"],
  amu: ["aligarh muslim university"],
  jnu: ["jawaharlal nehru university"],
  du: ["university of delhi", "delhi university"],
  pu: ["punjab university", "university of punjab"],
  mu: ["mumbai university", "university of mumbai", "mysore university"],
  au: ["anna university", "andhra university", "annamalai university"],
  ku: ["kerala university", "kannur university", "kalyani university"],
  gu: ["gujarat university", "gauhati university"],
  su: ["saurashtra university"],
  ru: ["rajasthan university", "ranchi university"],
  nu: ["nagpur university"],
  bu: ["bangalore university", "bombay university"],
  ou: ["osmania university"],
  cu: ["calcutta university", "university of calcutta"],
  pu: ["patna university", "university of patna"],
  lu: ["lucknow university", "university of lucknow"],
  tu: ["tezpur university"],
  hu: ["hyderabad university", "university of hyderabad"],
  jntu: ["jawaharlal nehru technological university"],
  ktu: [
    "kerala technological university",
    "apj abdul kalam technological university",
  ],
  apjaktu: ["apj abdul kalam technological university"],
  cusat: ["cochin university of science and technology"],
  kufos: ["kerala university of fisheries and ocean studies"],
  iucaa: ["inter university centre for astronomy and astrophysics"],
  sndt: ["shreemati nathibai damodar thackersey women university"],
  ignou: ["indira gandhi national open university"],
  ycmou: ["yashwantrao chavan maharashtra open university"],
  nios: ["national institute of open schooling"],

  // ── State-name abbreviations ──────────────────────────────────────────
  mg: ["mahatma gandhi"],
  apj: ["abdul kalam", "apj abdul kalam"],
  br: ["bhimrao ramji", "b r ambedkar"],
  bra: ["b r ambedkar"],
  svn: ["swami vivekananda"],
  sv: ["sri venkateswara"],
  rgu: ["rajiv gandhi university"],
  rguhs: ["rajiv gandhi university of health sciences"],
  rgipt: ["rajiv gandhi institute of petroleum technology"],
  manit: ["maulana azad national institute of technology"],
  mnnit: ["motilal nehru national institute of technology"],
  vnit: ["visvesvaraya national institute of technology"],
  nith: ["national institute of technology hamirpur"],
  nitk: ["national institute of technology karnataka"],
  nitc: ["national institute of technology calicut"],
  nitm: ["national institute of technology meghalaya"],
  nitap: ["national institute of technology arunachal pradesh"],
  nits: ["national institute of technology silchar"],
  nitt: ["national institute of technology tiruchirappalli"],
  nitw: ["national institute of technology warangal"],
  nitp: ["national institute of technology patna"],
  nitr: ["national institute of technology rourkela"],
  nitj: ["national institute of technology jalandhar"],
  nituk: ["national institute of technology uttarakhand"],
  nitg: ["national institute of technology goa"],
  nitkuk: ["national institute of technology kurukshetra"],
  nitdgp: ["national institute of technology durgapur"],

  // ── NIT state codes (e.g. "nit calicut" -> expansion) ─────────────────
  iitb: ["indian institute of technology bombay"],
  iitm: ["indian institute of technology madras"],
  iitd: ["indian institute of technology delhi"],
  iitk: ["indian institute of technology kanpur"],
  iitkgp: ["indian institute of technology kharagpur"],
  iitg: ["indian institute of technology guwahati"],
  iitr: ["indian institute of technology roorkee"],
  iith: ["indian institute of technology hyderabad"],
  iitbbs: ["indian institute of technology bhubaneswar"],
  iitj: ["indian institute of technology jodhpur"],
  iitv: ["indian institute of technology varanasi"],
  iitp: ["indian institute of technology patna"],
  iiti: ["indian institute of technology indore"],
  iitmandi: ["indian institute of technology mandi"],
  iitpkd: ["indian institute of technology palakkad"],
  iittpu: ["indian institute of technology tirupati"],
  iitbhilai: ["indian institute of technology bhilai"],
  iitdh: ["indian institute of technology dharwad"],
  iitjammu: ["indian institute of technology jammu"],
  iiitb: ["indian institute of information technology bangalore"],
  iiitd: ["indian institute of information technology delhi"],
  iiitm: ["indian institute of information technology madhya pradesh"],
  iiith: ["international institute of information technology hyderabad"],
  iiitp: ["indian institute of information technology pune"],
  iiita: ["indian institute of information technology allahabad"],
  iiitg: ["indian institute of information technology guwahati"],

  // ── Common word expansions ────────────────────────────────────────────
  govt: ["government"],
  gov: ["government"],
  univ: ["university"],
  inst: ["institute"],
  tech: ["technology"],
  engg: ["engineering"],
  eng: ["engineering"],
  sci: ["science"],
  med: ["medical", "medicine"],
  agri: ["agriculture", "agricultural"],
  vet: ["veterinary"],
  arch: ["architecture", "architectural"],
  mgmt: ["management"],
  mgt: ["management"],
  edu: ["education"],
  natl: ["national"],
  intl: ["international"],
  col: ["college"],
  poly: ["polytechnic"],
  res: ["research"],
  comm: ["commerce", "commercial"],
  arts: ["arts", "art"],
  law: ["law", "legal"],
  pharm: ["pharmacy", "pharmaceutical"],
  dent: ["dental", "dentistry"],
  nurs: ["nursing"],
  pt: ["physiotherapy", "physical therapy"],
  ot: ["occupational therapy"],
  ayur: ["ayurveda", "ayurvedic"],
  homo: ["homeopathy", "homeopathic"],
  unani: ["unani", "yunani"],
  siddha: ["siddha"],
  yoga: ["yoga"],
  naturo: ["naturopathy"],
};

// Stop words to ignore during token matching (improves precision)
const STOP_WORDS = new Set([
  "of",
  "the",
  "and",
  "a",
  "an",
  "in",
  "at",
  "for",
  "to",
  "by",
  "with",
  "from",
  "into",
  "through",
  "during",
  "is",
  "are",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeSparqlString(str) {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

export function normalizeText(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function acronymOf(text) {
  const words = normalizeText(text).split(" ").filter(Boolean);
  return words.map((w) => w[0]).join("");
}

/** All acronyms from all contiguous sub-sequences of tokens (for partial acronym matching) */
function subAcronymsOf(text) {
  const words = normalizeText(text)
    .split(" ")
    .filter((w) => !STOP_WORDS.has(w) && w.length > 0);
  const result = new Set();
  for (let i = 0; i < words.length; i++) {
    let acr = "";
    for (let j = i; j < words.length; j++) {
      acr += words[j][0];
      if (acr.length >= 2) result.add(acr);
    }
  }
  return result;
}

function levenshtein(a, b) {
  const s = a || "";
  const t = b || "";
  const n = s.length;
  const m = t.length;
  if (n === 0) return m;
  if (m === 0) return n;
  const dp = Array.from({ length: n + 1 }, (_, i) => {
    const row = new Array(m + 1);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[n][m];
}

/** Extract content bigrams from a normalized string (for overlap scoring). */
function bigrams(text) {
  const words = text.split(" ").filter((w) => w.length >= 2);
  const out = new Set();
  for (let i = 0; i < words.length - 1; i++) {
    out.add(`${words[i]}|${words[i + 1]}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Token expansion (used both locally and for remote query generation)
// ---------------------------------------------------------------------------

export function expandQueryTokens(query) {
  const normalized = normalizeText(query);
  const baseTokens = normalized.split(" ").filter(Boolean);
  const out = new Set(baseTokens);

  for (const token of baseTokens) {
    const expansions = ABBREVIATION_EXPANSIONS[token];
    if (expansions) {
      for (const phrase of expansions) {
        for (const t of normalizeText(phrase).split(" ").filter(Boolean)) {
          out.add(t);
        }
      }
    }
  }

  return Array.from(out);
}

// ---------------------------------------------------------------------------
// SPARQL query builders
// ---------------------------------------------------------------------------

/**
 * Build token filter for remote SPARQL query.
 * Strategy:
 *   - Binds rdfs:label + optional skos:altLabel in English
 *   - Requires at least minHits tokens to match (scales with query length)
 *   - Tokens under 2 chars are skipped; at most 10 tokens sent
 */
function buildTokenizedRemoteFilter(searchTerm) {
  const tokens = expandQueryTokens(searchTerm)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t))
    .slice(0, 10);

  if (!tokens.length) return "";

  const tokenExprs = tokens.map((tok) => {
    const lit = escapeSparqlString(tok);
    return `(CONTAINS(LCASE(STR(?searchLabel)), "${lit}") || (BOUND(?searchAlt) && CONTAINS(LCASE(STR(?searchAlt)), "${lit}")))`;
  });

  // For short queries (1-2 meaningful tokens) require ALL to match (more precise).
  // For longer queries allow partial overlap.
  const minHits =
    tokens.length <= 2
      ? tokens.length
      : Math.max(2, Math.floor(tokens.length * 0.5));
  const sumExpr = tokenExprs.map((e) => `IF(${e}, 1, 0)`).join(" + ");

  return `
  ?item rdfs:label ?searchLabel .
  FILTER(LANG(?searchLabel) = "en") .
  OPTIONAL { ?item skos:altLabel ?searchAlt . FILTER(LANG(?searchAlt) = "en") . }
  FILTER((${sumExpr}) >= ${minHits}) .
`;
}

/**
 * Build the main institution SPARQL query.
 *
 * @param {object} opts
 * @param {string|null}  opts.stateQid   – Wikidata QID of Indian state/UT (null = all India)
 * @param {string|null}  opts.searchTerm – optional keyword filter (remote token mode)
 * @param {number|null}  opts.limit      – result cap
 * @param {boolean}      opts.wideScope  – if true, also add P17=India fallback inside UNION
 */
export function buildInstitutionSparql({
  stateQid = null,
  searchTerm = null,
  limit = null,
  wideScope = false,
} = {}) {
  const typesValues = INSTITUTION_TYPES.map((q) => `wd:${q}`).join(" ");

  // Location filter:
  //  - For state-scoped: traverse P131 up to 5 levels + P276 alternative
  //  - Additionally include the P17=India fallback so institutions with a
  //    direct country link but missing district/state P131 are still caught.
  let locationFilter;
  if (stateQid) {
    locationFilter = `
  {
    { ?item wdt:P131 wd:${stateQid} . }
    UNION { ?item wdt:P131/wdt:P131 wd:${stateQid} . }
    UNION { ?item wdt:P131/wdt:P131/wdt:P131 wd:${stateQid} . }
    UNION { ?item wdt:P131/wdt:P131/wdt:P131/wdt:P131 wd:${stateQid} . }
    UNION { ?item wdt:P131/wdt:P131/wdt:P131/wdt:P131/wdt:P131 wd:${stateQid} . }
    UNION { ?item wdt:P276 wd:${stateQid} . }
    UNION { ?item wdt:P276/wdt:P131 wd:${stateQid} . }
    UNION { ?item wdt:P276/wdt:P131/wdt:P131 wd:${stateQid} . }
    ${wideScope ? "UNION { ?item wdt:P17 wd:Q668 . }" : ""}
  }`;
  } else {
    // All India — use P17 (country) = India (Q668) as primary filter
    locationFilter = `
  {
    { ?item wdt:P17 wd:Q668 . }
    UNION { ?item wdt:P131/wdt:P17 wd:Q668 . }
  }`;
  }

  const textFilter = searchTerm ? buildTokenizedRemoteFilter(searchTerm) : "";

  // Bump up limit for state queries (more thorough)
  const effectiveLimit = limit ?? (stateQid ? 3000 : 1500);

  return `
SELECT DISTINCT ?item ?itemLabel ?itemAltLabel ?locLabel WHERE {
  VALUES ?type { ${typesValues} }
  ?item wdt:P31/wdt:P279* ?type .
  ${locationFilter}
  OPTIONAL { ?item wdt:P131 ?loc . }
  ${textFilter}
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "${LABEL_LANGUAGES}" .
  }
}
ORDER BY ?itemLabel
LIMIT ${effectiveLimit}
`.trim();
}

// ---------------------------------------------------------------------------
// Result parsing
// ---------------------------------------------------------------------------

export function parseInstitutionResults(json) {
  const bindings = json?.results?.bindings || [];
  const seen = new Map();

  for (const b of bindings) {
    const uri = b.item?.value || "";
    const qid = uri.split("/").pop() || "";
    const label = b.itemLabel?.value || "";

    // Skip items whose label is just the QID (no English label in Wikidata)
    if (!label || !qid || /^Q\d+$/.test(label)) continue;

    if (seen.has(qid)) {
      const existing = seen.get(qid);
      if (!existing.location && b.locLabel?.value) {
        existing.location = b.locLabel.value;
      }
      if (!existing.altLabel && b.itemAltLabel?.value) {
        existing.altLabel = b.itemAltLabel.value;
      }
      // Merge additional alt labels if different
      if (
        b.itemAltLabel?.value &&
        b.itemAltLabel.value !== existing.altLabel &&
        !existing.altLabels.includes(b.itemAltLabel.value)
      ) {
        existing.altLabels.push(b.itemAltLabel.value);
      }
      continue;
    }

    seen.set(qid, {
      label,
      qid,
      altLabel: b.itemAltLabel?.value || "",
      altLabels: b.itemAltLabel?.value ? [b.itemAltLabel.value] : [],
      location: b.locLabel?.value || "",
    });
  }

  return Array.from(seen.values());
}

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

function cacheKey(stateQid) {
  const scope = stateQid ? `state_${stateQid}` : "all";
  return `quarchive_institutions_${CACHE_VERSION}_${scope}`;
}

/**
 * Fetch with an AbortController-backed timeout. The public Wikidata SPARQL
 * endpoint will happily hang for 60+ seconds on an expensive query before
 * returning 504 — we cut that off client-side so the UI never freezes.
 */
async function fetchJsonWithTimeout(url, { timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent":
          "Quarchive/2.0 (https://github.com/quarchive; educational project)",
      },
    });
    if (!res.ok) {
      throw new Error(
        `Wikidata SPARQL query failed: ${res.status} ${res.statusText}`,
      );
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Post-filter type list used *after* the Wikibase mwapi EntitySearch has
 * already narrowed candidates to ~50–100 text matches. Intentionally small —
 * mwapi has done the hard work, this just rejects non-institutions (people,
 * events, awards named after universities, etc.) via a cheap P31/P279* check.
 *
 * The umbrella types below transitively cover the full 40+ hierarchy from
 * INSTITUTION_TYPES through `wdt:P279*`, at a fraction of the query cost.
 */
const MWAPI_POSTFILTER_TYPES = [
  "Q3918", // university
  "Q189004", // college
  "Q38723", // higher education institution
  "Q1664720", // institute of technology
  "Q1371037", // institute of technology (alt)
  "Q47531586", // Institute of National Importance (India)
  "Q2385804", // educational institution (catch-all)
  "Q4671277", // academic institution (catch-all)
  "Q31855", // research institute
  "Q15936437", // research university
  "Q23039057", // institute of information technology
];

/**
 * Build a SPARQL query that uses Wikibase's mwapi EntitySearch service for
 * fast Elasticsearch-backed label/alias matching, then post-filters by
 * country + institution type.
 *
 * This replaces the previous `wdt:P31/wdt:P279*` + `P131` union approach,
 * which timed out at 60+ seconds on the public endpoint for all-India and
 * deeply-nested state-scoped queries.
 */
function buildInstitutionMwapiSparql({
  searchTerm,
  stateQid = null,
  limit = 50,
} = {}) {
  const typesValues = MWAPI_POSTFILTER_TYPES.map((q) => `wd:${q}`).join(" ");
  const escapedSearch = escapeSparqlString(String(searchTerm || "").trim());
  // mwapi's own limit — request slightly more than we'll return, since some
  // hits will be rejected by the type post-filter.
  const mwapiLimit = Math.min(Math.max(limit * 2, 50), 100);

  // State scoping runs AFTER mwapi has narrowed to ~100 candidates, so a
  // property-path lookup (`P131+`) is cheap. One-or-more hops lets us match
  // an institution in a district in a state in India.
  const stateFilter = stateQid
    ? `?item wdt:P131+ wd:${stateQid} .`
    : `?item wdt:P17 wd:Q668 .`;

  return `
SELECT DISTINCT ?item ?itemLabel ?itemAltLabel ?locLabel WHERE {
  SERVICE wikibase:mwapi {
    bd:serviceParam wikibase:api "EntitySearch" .
    bd:serviceParam wikibase:endpoint "www.wikidata.org" .
    bd:serviceParam mwapi:search "${escapedSearch}" .
    bd:serviceParam mwapi:language "en" .
    bd:serviceParam mwapi:limit "${mwapiLimit}" .
    ?item wikibase:apiOutputItem mwapi:item .
  }
  ${stateFilter}
  ?item wdt:P31/wdt:P279* ?type .
  VALUES ?type { ${typesValues} }
  OPTIONAL { ?item wdt:P131 ?loc . }
  OPTIONAL {
    ?item skos:altLabel ?itemAltLabel .
    FILTER(LANG(?itemAltLabel) = "en")
  }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "${LABEL_LANGUAGES}" .
  }
}
LIMIT ${limit}
`.trim();
}

/**
 * Return a locally-cached list of institutions for an optional state scope.
 *
 * IMPORTANT CHANGE (v4 cache bump): we no longer attempt an eager SPARQL
 * bootstrap here. The previous implementation fired a `wdt:P31/wdt:P279*`
 * query across 40+ type hierarchies plus deep `P131` unions, which the
 * public Wikidata endpoint times out at 60+ seconds — that was the root
 * cause of "no universities load".
 *
 * Instead, all live lookups go through `searchInstitutionsRemote`, which
 * uses the Wikibase mwapi EntitySearch service (Elasticsearch-backed) and
 * typically returns in ≤ 3 s. The local list is populated opportunistically
 * from prior remote-search hits, cached in localStorage, and used purely
 * as a warm-start for the fuzzy scorer on subsequent keystrokes.
 */
export async function getInstitutionList(stateQid = null) {
  const key = cacheKey(stateQid);

  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL && Array.isArray(data)) {
        return data;
      }
    }
  } catch {
    // ignore cache read errors
  }

  // No bootstrap — return empty; remote search will populate results on demand
  // and `cacheRemoteResults` below will grow the warm-start list over time.
  return [];
}

/**
 * Merge a batch of remote-search results into the localStorage warm-start
 * cache for a given state scope. Called by `searchInstitutionsRemote` on
 * every successful query so repeated searches get faster over a session.
 */
function cacheRemoteResults(stateQid, newResults) {
  if (!Array.isArray(newResults) || newResults.length === 0) return;
  const key = cacheKey(stateQid);
  try {
    const cached = localStorage.getItem(key);
    let data = [];
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed.data)) data = parsed.data;
    }
    const existingQids = new Set(data.map((r) => r.qid));
    for (const r of newResults) {
      if (!existingQids.has(r.qid)) {
        data.push(r);
        existingQids.add(r.qid);
      }
    }
    // Cap the warm-start cache to prevent unbounded growth across a session.
    if (data.length > 500) data = data.slice(-500);
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // ignore quota / parse errors
  }
}

// ---------------------------------------------------------------------------
// Local fuzzy search (runs on the cached list — O(n) per keystroke)
// ---------------------------------------------------------------------------

export function searchInstitutionsLocal(query, list) {
  if (!Array.isArray(list)) return [];
  if (!query || !query.trim()) return list.slice(0, 20);

  const qNorm = normalizeText(query);
  const qTokens = expandQueryTokens(query).filter(
    (t) => !STOP_WORDS.has(t) && t.length >= 2,
  );
  const qAcronym = acronymOf(query.replace(/\s+/g, " "));
  const qSubAcronyms = subAcronymsOf(query);
  const qBigrams = bigrams(qNorm);

  const scored = [];

  for (const item of list) {
    const label = item.label || "";
    const alt = item.altLabel || "";
    const loc = item.location || "";
    const allAlts = item.altLabels || (alt ? [alt] : []);

    const labelNorm = normalizeText(label);
    const altNorm = normalizeText(alt);
    const locNorm = normalizeText(loc);
    const allNorms = [labelNorm, ...allAlts.map(normalizeText)];

    const labelAcronym = acronymOf(labelNorm);
    const labelSubAcrs = subAcronymsOf(labelNorm);
    const altAcronym = alt ? acronymOf(altNorm) : "";
    const altSubAcrs = alt ? subAcronymsOf(altNorm) : new Set();

    let score = 0;

    // ── Exact / prefix / contains ──────────────────────────────────────
    if (labelNorm === qNorm) score += 20;
    else if (labelNorm.startsWith(qNorm)) score += 12;
    else if (labelNorm.includes(qNorm)) score += 8;
    else if (allNorms.some((n) => n.includes(qNorm))) score += 5;
    else if (locNorm.includes(qNorm)) score += 2;

    // ── Exact acronym match (e.g. "NITC" -> "National Institute of Technology Calicut") ──
    if (qAcronym.length >= 2) {
      if (labelAcronym === qAcronym || altAcronym === qAcronym) score += 14;
      else if (labelSubAcrs.has(qAcronym) || altSubAcrs.has(qAcronym))
        score += 9;
    }

    // ── Query is a sub-acronym of the label (e.g. "iit" matches any IIT) ─
    for (const qa of qSubAcronyms) {
      if (labelAcronym === qa || altAcronym === qa) score += 6;
      else if (labelSubAcrs.has(qa) || altSubAcrs.has(qa)) score += 3;
    }

    // ── Token overlap (weighted: longer tokens = more signal) ─────────
    let tokenScore = 0;
    let tokenHits = 0;
    for (const t of qTokens) {
      const inLabel =
        labelNorm.includes(t) || allNorms.some((n) => n.includes(t));
      const inLoc = locNorm.includes(t);
      if (inLabel) {
        tokenScore += 1 + t.length * 0.12; // longer token = more weight
        tokenHits++;
      } else if (inLoc) {
        tokenScore += 0.5;
        tokenHits++;
      }
    }
    // Bonus for proportion of query tokens matched
    if (qTokens.length > 0) {
      tokenScore *= 1 + tokenHits / qTokens.length;
    }
    score += tokenScore;

    // ── Bigram overlap (phrase-aware) ─────────────────────────────────
    if (qBigrams.size > 0) {
      const lBigrams = bigrams(labelNorm);
      let bigramHits = 0;
      for (const bg of qBigrams) {
        if (lBigrams.has(bg)) bigramHits++;
      }
      score += bigramHits * 3;
    }

    // ── Lightweight typo tolerance (only for queries >= 5 chars) ──────
    if (qNorm.length >= 5) {
      // Compare query against each token in the label (not whole string, for speed)
      const labelTokens = labelNorm
        .split(" ")
        .filter(
          (w) => w.length >= qNorm.length - 2 && w.length <= qNorm.length + 2,
        );
      for (const lt of labelTokens) {
        const dist = levenshtein(qNorm, lt);
        if (dist === 1) {
          score += 3;
          break;
        }
        if (dist === 2 && qNorm.length >= 7) {
          score += 1.5;
          break;
        }
      }

      // Also compare against prefix of label (whole-label match for short institutions)
      const labelPrefix = labelNorm.slice(0, qNorm.length);
      const prefixDist = levenshtein(qNorm, labelPrefix);
      if (prefixDist === 1) score += 2.5;
      else if (prefixDist === 2 && qNorm.length >= 8) score += 1;
    }

    if (score > MIN_SCORE_THRESHOLD) {
      scored.push({ ...item, _score: score });
    }
  }

  scored.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    return a.label.localeCompare(b.label);
  });

  return scored;
}

// ---------------------------------------------------------------------------
// Remote fallback search (tokenized SPARQL — runs when local list is empty
// or local results are insufficient)
// ---------------------------------------------------------------------------

/**
 * Remote institution search via Wikibase mwapi EntitySearch.
 *
 * Strategy:
 *   1. Expand the raw query through `expandQueryTokens` so abbreviations
 *      ("ktu", "iit", "bits") are resolved to their canonical expansions
 *      before being sent to Elasticsearch.
 *   2. Run one mwapi-backed SPARQL query for the expanded phrase (state-
 *      scoped if a state was selected).
 *   3. If state-scoped and weak (<3 hits), fall back to an all-India search
 *      so a user who selected "Kerala" but typed "IIT" still finds IITs.
 *   4. Cache merged results into the warm-start list keyed by state.
 *
 * All network calls are time-boxed at 12 s via AbortController so a slow
 * endpoint never hangs the UI.
 */
export async function searchInstitutionsRemote(query, stateQid = null) {
  const raw = String(query || "").trim();
  if (!raw) return [];

  // Build the search phrase sent to Elasticsearch. Prefer an abbreviation-
  // expanded form when the query is a known alias; otherwise use the raw
  // text (mwapi EntitySearch already tokenises and does fuzzy matching).
  const expandedTokens = expandQueryTokens(raw);
  const searchTerm =
    expandedTokens.length > raw.split(/\s+/).length
      ? expandedTokens.join(" ")
      : raw;

  const runQuery = async (scopeQid, term) => {
    const sparql = buildInstitutionMwapiSparql({
      searchTerm: term,
      stateQid: scopeQid,
      limit: 50,
    });
    const url = `${WIKIDATA_SPARQL_ENDPOINT}?query=${encodeURIComponent(sparql)}`;
    const json = await fetchJsonWithTimeout(url, { timeoutMs: 12000 });
    return parseInstitutionResults(json);
  };

  let results = [];
  try {
    results = await runQuery(stateQid, searchTerm);
  } catch {
    // Primary query failed (timeout or network) — fall through to widened
    // retry with the raw term in case the expansion produced a pathological
    // Elasticsearch phrase.
    if (searchTerm !== raw) {
      try {
        results = await runQuery(stateQid, raw);
      } catch {
        results = [];
      }
    }
  }

  // State scoped and weak → widen to all-India with the same term.
  if (stateQid && results.length < 3) {
    try {
      const indiaResults = await runQuery(null, searchTerm);
      const existingQids = new Set(results.map((r) => r.qid));
      for (const r of indiaResults) {
        if (!existingQids.has(r.qid)) results.push(r);
      }
    } catch {
      // non-fatal — keep whatever state-scoped results we got
    }
  }

  // Opportunistic warm-start: seed the local cache so repeat searches
  // within the same session are instant via `searchInstitutionsLocal`.
  cacheRemoteResults(stateQid, results);

  return results;
}

// ---------------------------------------------------------------------------
// Combined search (local + remote, with deduplication)
// ---------------------------------------------------------------------------

/**
 * High-level entry point: search local cache first, fall back to remote if
 * local results are weak, then deduplicate and re-rank the merged list.
 *
 * @param {string}         query
 * @param {Array}          localList   – result of getInstitutionList()
 * @param {string|null}    stateQid    – optional state scope
 * @param {object}         opts
 * @param {number}         opts.minLocalResults  – trigger remote if local < this (default 5)
 * @param {number}         opts.maxResults       – cap on returned results (default 30)
 * @returns {Promise<Array>}
 */
export async function searchInstitutions(
  query,
  localList,
  stateQid = null,
  { minLocalResults = 5, maxResults = 30 } = {},
) {
  const localResults = searchInstitutionsLocal(query, localList);

  if (localResults.length >= minLocalResults) {
    return localResults.slice(0, maxResults);
  }

  // Local results are sparse — run remote search and merge
  try {
    const remoteResults = await searchInstitutionsRemote(query, stateQid);
    const existingQids = new Set(localResults.map((r) => r.qid));
    const merged = [...localResults];

    for (const r of remoteResults) {
      if (!existingQids.has(r.qid)) {
        merged.push(r);
        existingQids.add(r.qid);
      }
    }

    // Re-rank merged list with local fuzzy scorer
    const reranked = searchInstitutionsLocal(query, merged);
    return reranked.slice(0, maxResults);
  } catch {
    return localResults.slice(0, maxResults);
  }
}

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------

export function clearInstitutionCache(stateQid = null) {
  const remove = (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* no-op */
    }
  };

  if (stateQid) {
    remove(cacheKey(stateQid));
    return;
  }

  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("quarchive_institutions_")) keysToRemove.push(k);
    }
    keysToRemove.forEach(remove);
  } catch {
    /* no-op */
  }
}

export async function fetchInstitutionByQid(qid) {
  const cleanQid = String(qid).trim().toUpperCase();
  if (!/^Q\d+$/.test(cleanQid)) return null;

  const sparql = `
SELECT ?item ?itemLabel ?locationLabel WHERE {
  BIND(wd:${cleanQid} AS ?item)
  OPTIONAL { ?item wdt:P131 ?location . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
} LIMIT 1
  `;

  const url = `${WIKIDATA_SPARQL_ENDPOINT}?query=${encodeURIComponent(sparql)}`;
  try {
    const json = await fetchJsonWithTimeout(url, { timeoutMs: 10000 });

    if (
      !json.results ||
      !json.results.bindings ||
      json.results.bindings.length === 0
    ) {
      return null;
    }

    const b = json.results.bindings[0];

    if (!b.itemLabel || b.itemLabel.value === cleanQid) {
      return null;
    }

    return {
      qid: cleanQid,
      label: b.itemLabel.value,
      location: b.locationLabel ? b.locationLabel.value : null,
      altLabel: null,
    };
  } catch {
    return null;
  }
}

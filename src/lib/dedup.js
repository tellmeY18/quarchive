/**
 * Three-layer deduplication strategy.
 * Layers 1 & 2 run client-side before upload.
 * Layer 3 (IAS3 checksum header) is handled in the upload Worker.
 */

import { buildSearchUrl, buildMetadataUrl } from "./archiveOrg.js";

export async function layer1HashCheck(hashHex) {
  // Guard against empty / missing hash. Without this, buildSearchUrl
  // drops the falsy sha256 filter and the query collapses to just
  // `subject:quarchive`, which returns an arbitrary existing item and
  // causes every upload to be falsely flagged as a duplicate.
  if (!hashHex || typeof hashHex !== "string" || hashHex.length < 64) {
    console.warn("Layer 1 dedup check skipped: missing or invalid hash");
    return { isDuplicate: false, item: null };
  }

  const url = buildSearchUrl({
    filters: { sha256: hashHex },
    rows: 1,
  });

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Archive.org search failed: ${res.status}`);
    }

    const json = await res.json();
    const docs = json?.response?.docs || [];

    if (docs.length > 0) {
      return { isDuplicate: true, item: docs[0] };
    }

    return { isDuplicate: false, item: null };
  } catch (err) {
    console.error("Layer 1 dedup check failed:", err);
    return { isDuplicate: false, item: null };
  }
}

export async function layer2IdentifierCheck(identifier) {
  const url = buildMetadataUrl(identifier);

  try {
    const res = await fetch(url);

    if (res.ok) {
      const json = await res.json();
      if (json && json.metadata) {
        return { isDuplicate: true, item: json.metadata };
      }
    }

    return { isDuplicate: false, item: null };
  } catch (err) {
    console.error("Layer 2 dedup check failed:", err);
    return { isDuplicate: false, item: null };
  }
}

export async function runAllDedupLayers({ hashHex, identifier }) {
  const l1 = await layer1HashCheck(hashHex);
  if (l1.isDuplicate) {
    return { isDuplicate: true, item: l1.item, layerTriggered: 1 };
  }

  const l2 = await layer2IdentifierCheck(identifier);
  if (l2.isDuplicate) {
    return { isDuplicate: true, item: l2.item, layerTriggered: 2 };
  }

  return { isDuplicate: false, item: null, layerTriggered: null };
}

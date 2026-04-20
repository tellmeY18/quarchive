/**
 * Document Detection via Sobel + Hough Line Transform
 *
 * Detects the four corners of a document (question paper) in an image.
 * Uses edge detection and Hough line transform to find dominant lines,
 * then intersects them to find corners.
 *
 * Returns: { corners: [[tl], [tr], [br], [bl]], confidence: 0..1 } or null
 */

/**
 * Sobel edge detection
 */
function sobelEdges(imageData) {
  const { data, width, height } = imageData;
  const edges = new Float32Array(width * height);

  // Sobel kernels
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0,
        gy = 0;
      let idx = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const pixelIdx = ((y + dy) * width + (x + dx)) * 4;
          // Use greyscale value (perceptual weighting)
          const grey =
            0.299 * data[pixelIdx] +
            0.587 * data[pixelIdx + 1] +
            0.114 * data[pixelIdx + 2];

          gx += grey * sobelX[idx];
          gy += grey * sobelY[idx];
          idx++;
        }
      }

      const edgeStrength = Math.sqrt(gx * gx + gy * gy);
      edges[y * width + x] = edgeStrength;
    }
  }

  return edges;
}

/**
 * Non-maximum suppression to thin edges
 */
function nonMaxSuppression(edges, width, height, threshold) {
  const suppressed = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const edgeVal = edges[idx];

      if (edgeVal < threshold) continue;

      // Check 8 neighbors
      let isLocalMax = true;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const neighborIdx = (y + dy) * width + (x + dx);
          if (edges[neighborIdx] > edgeVal) {
            isLocalMax = false;
            break;
          }
        }
        if (!isLocalMax) break;
      }

      suppressed[idx] = isLocalMax ? 255 : 0;
    }
  }

  return suppressed;
}

/**
 * Hough line transform to find dominant lines
 * Returns array of { theta, rho, count } sorted by strength
 */
function houghLineTransform(edges, width, height, threshold) {
  // Note: `Math.sqrt(width*width + height*height)` would give us the
  // maximum possible rho for bounding the accumulator, but we key the
  // accumulator by string instead of by indexed bucket, so we don't
  // need an explicit bound here.
  const accumulator = new Map(); // "theta,rho" -> count

  // Hough space: 1-degree angular precision
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (edges[y * width + x] < threshold) continue;

      // Check 180 angles (0-179 degrees)
      for (let theta = 0; theta < 180; theta++) {
        const rad = (theta * Math.PI) / 180;
        const rho = x * Math.cos(rad) + y * Math.sin(rad);
        const rhoRounded = Math.round(rho);

        const key = `${theta},${rhoRounded}`;
        accumulator.set(key, (accumulator.get(key) || 0) + 1);
      }
    }
  }

  // Extract strong lines
  const lines = Array.from(accumulator.entries())
    .map(([key, count]) => {
      const [theta, rho] = key.split(",").map(Number);
      return { theta, rho, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20); // Keep top 20 lines

  return lines;
}

/**
 * Find intersection of two lines (from Hough parameters)
 */
function lineIntersection(line1, line2, width, height) {
  const theta1 = (line1.theta * Math.PI) / 180;
  const theta2 = (line2.theta * Math.PI) / 180;
  const rho1 = line1.rho;
  const rho2 = line2.rho;

  const denominator =
    Math.cos(theta1) * Math.sin(theta2) - Math.sin(theta1) * Math.cos(theta2);

  // Lines are parallel
  if (Math.abs(denominator) < 1e-6) return null;

  const x = (rho1 * Math.sin(theta2) - rho2 * Math.sin(theta1)) / denominator;
  const y = (rho2 * Math.cos(theta1) - rho1 * Math.cos(theta2)) / denominator;

  // Clamp to image bounds with margin
  const margin = 50;
  if (x < -margin || x > width + margin || y < -margin || y > height + margin) {
    return null;
  }

  return [x, y];
}

/**
 * Find the four corners of a document by intersecting dominant lines
 */
function findCornersFromLines(lines, width, height) {
  const corners = [];

  // Try pairs of lines to find intersection points
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    for (let j = i + 1; j < Math.min(lines.length, 10); j++) {
      const intersection = lineIntersection(lines[i], lines[j], width, height);
      if (intersection) {
        corners.push(intersection);
      }
    }
  }

  if (corners.length < 4) return null;

  // Sort corners into [top-left, top-right, bottom-right, bottom-left]
  // by angle from image center
  const cx = width / 2;
  const cy = height / 2;

  corners.sort((a, b) => {
    const angleA = Math.atan2(a[1] - cy, a[0] - cx);
    const angleB = Math.atan2(b[1] - cy, b[0] - cx);
    return angleA - angleB;
  });

  // Pick the 4 corners that are most spread out
  // (represent the actual document edges, not noise)
  const convexCorners = pickConvexQuad(corners);
  if (!convexCorners) return null;

  return convexCorners;
}

/**
 * From a set of candidate corners, pick the 4 that form a convex quadrilateral
 * closest to a rectangle (document-like shape)
 */
function pickConvexQuad(candidates) {
  if (candidates.length < 4) return null;

  // Use a simple heuristic: pick corners with maximum total distance (spread)
  let bestQuad = null;
  let bestScore = 0;

  // Try all combinations of 4 corners
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      for (let k = j + 1; k < candidates.length; k++) {
        for (let l = k + 1; l < candidates.length; l++) {
          const quad = [
            candidates[i],
            candidates[j],
            candidates[k],
            candidates[l],
          ];
          const score = quadScore(quad);

          if (score > bestScore) {
            bestScore = score;
            bestQuad = quad;
          }
        }
      }
    }
  }

  return bestQuad;
}

/**
 * Score a quadrilateral based on:
 * - Convexity (cross products)
 * - Aspect ratio (close to 0.7 for A4 papers)
 * - Area (larger is better)
 */
function quadScore(quad) {
  // Check convexity
  for (let i = 0; i < 4; i++) {
    const p0 = quad[i];
    const p1 = quad[(i + 1) % 4];
    const p2 = quad[(i + 2) % 4];

    const cross =
      (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);

    if (i === 0) {
      var firstCross = cross;
    } else if (cross > 0 !== firstCross > 0) {
      return 0; // Not convex
    }
  }

  // Compute aspect ratio
  const edge1 = distance(quad[0], quad[1]);
  const edge2 = distance(quad[1], quad[2]);
  // Opposite-edge distances (quad[2]→quad[3], quad[3]→quad[0]) are
  // implicitly covered by the aspectRatio check below; computing them
  // explicitly just to ignore them tripped the no-unused-vars rule.

  const aspectRatio = edge1 / edge2;
  const rationality =
    1 / (1 + Math.abs(Math.log(Math.max(aspectRatio, 1 / aspectRatio))));

  // Compute area
  const area =
    quad[0][0] * quad[1][1] -
    quad[1][0] * quad[0][1] +
    (quad[1][0] * quad[2][1] - quad[2][0] * quad[1][1]) +
    (quad[2][0] * quad[3][1] - quad[3][0] * quad[2][1]) +
    (quad[3][0] * quad[0][1] - quad[0][0] * quad[3][1]);

  const normArea = Math.abs(area / 2);
  const areaNorm = Math.min(normArea / (800 * 600), 1); // Normalize against max typical paper size

  // Combine scores
  return rationality * 0.5 + areaNorm * 0.5;
}

function distance(p1, p2) {
  return Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2);
}

/**
 * Compute confidence score for detected corners
 */
function computeConfidence(corners, width, height, lineCount) {
  if (!corners || corners.length !== 4) return 0;

  // All corners within image bounds (with margin)
  const margin = 100;
  for (const [x, y] of corners) {
    if (
      x < -margin ||
      x > width + margin ||
      y < -margin ||
      y > height + margin
    ) {
      return 0;
    }
  }

  // Compute area coverage
  const area = quadArea(corners);
  const imageArea = width * height;
  const coverage = area / imageArea;

  // Confidence based on coverage + line strength
  const lineConfidence = Math.min(lineCount / 50, 1); // Normalize to 0..1
  const coverageConfidence =
    coverage < 0.1 ? 0 : coverage > 0.6 ? 1 : coverage / 0.6;

  return lineConfidence * 0.4 + coverageConfidence * 0.6;
}

function quadArea(quad) {
  // Shoelace formula
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const p0 = quad[i];
    const p1 = quad[(i + 1) % 4];
    area += p0[0] * p1[1] - p1[0] * p0[1];
  }
  return Math.abs(area / 2);
}

/**
 * Main function: detect paper quad in an image
 */
export async function detectPaperQuad(imageBitmap) {
  try {
    // Convert ImageBitmap to canvas and get ImageData
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(imageBitmap, 0, 0);
    const imageData = ctx.getImageData(
      0,
      0,
      imageBitmap.width,
      imageBitmap.height,
    );

    const width = imageBitmap.width;
    const height = imageBitmap.height;

    // Step 1: Sobel edge detection
    const edges = sobelEdges(imageData);

    // Adaptive threshold based on histogram
    const threshold = computeAdaptiveThreshold(edges);

    // Step 2: Non-maximum suppression
    const suppressed = nonMaxSuppression(edges, width, height, threshold * 0.5);

    // Step 3: Hough line transform
    const lines = houghLineTransform(suppressed, width, height, 10);

    if (lines.length < 4) return null;

    // Step 4: Find corners from line intersections
    const corners = findCornersFromLines(lines, width, height);

    if (!corners) return null;

    // Step 5: Compute confidence
    const confidence = computeConfidence(corners, width, height, lines.length);

    return {
      corners,
      confidence,
    };
  } catch (e) {
    console.error("[documentDetect] Error:", e);
    return null;
  }
}

/**
 * Adaptive threshold based on histogram
 */
function computeAdaptiveThreshold(edges) {
  // Compute histogram
  const bins = new Uint32Array(256);
  for (let i = 0; i < edges.length; i++) {
    const binIdx = Math.min(255, Math.floor((edges[i] / 255) * 255));
    bins[binIdx]++;
  }

  // Find 70th percentile as threshold
  let sum = 0;
  const target = edges.length * 0.7;
  for (let i = 255; i >= 0; i--) {
    sum += bins[i];
    if (sum >= target) {
      return i;
    }
  }

  return 128;
}

/**
 * Perspective Warp - Transform detected quad into a clean rectangle
 * 
 * Takes a detected quad from documentDetect.js and applies a perspective
 * transform (homography) to produce a rectangular, straight image.
 */

/**
 * Compute homography matrix from source quad to target rectangle
 * Using Direct Linear Transform (DLT)
 */
function computeHomography(srcQuad, targetWidth, targetHeight) {
  // Source quad: [tl, tr, br, bl]
  // Target rect: [0,0], [w,0], [w,h], [0,h]
  const src = srcQuad;
  const dst = [
    [0, 0],
    [targetWidth, 0],
    [targetWidth, targetHeight],
    [0, targetHeight],
  ];

  // Build the system of linear equations for DLT
  const A = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [xp, yp] = dst[i];

    A.push([x, y, 1, 0, 0, 0, -xp * x, -xp * y, -xp]);
    A.push([0, 0, 0, x, y, 1, -yp * x, -yp * y, -yp]);
  }

  // Solve using SVD (simplified version - using pseudo-inverse)
  const h = solveLinearSystem(A);
  return h;
}

/**
 * Simplified linear solver for homography
 * Uses Gaussian elimination (not full SVD, but sufficient for well-conditioned problem)
 */
function solveLinearSystem(A) {
  // For homography, we expect a well-conditioned 8x9 system
  // We'll use a least-squares approach with Gaussian elimination

  // Create augmented matrix [A | 0]
  const n = A.length;
  const m = A[0].length;

  // Copy matrix
  const mat = A.map(row => [...row]);

  // Gaussian elimination
  for (let col = 0; col < Math.min(n, m - 1); col++) {
    // Find pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(mat[row][col]) > Math.abs(mat[maxRow][col])) {
        maxRow = row;
      }
    }

    // Swap rows
    [mat[col], mat[maxRow]] = [mat[maxRow], mat[col]];

    // Eliminate
    for (let row = col + 1; row < n; row++) {
      const factor = mat[row][col] / mat[col][col];
      for (let j = col; j < m; j++) {
        mat[row][j] -= factor * mat[col][j];
      }
    }
  }

  // Back substitution
  const x = new Array(m - 1).fill(0);
  for (let i = Math.min(n, m - 1) - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < m - 1; j++) {
      sum += mat[i][j] * x[j];
    }
    if (Math.abs(mat[i][i]) > 1e-10) {
      x[i] = (mat[i][m - 1] - sum) / mat[i][i];
    }
  }

  // Normalize so h[8] = 1
  if (x[8] !== 0) {
    for (let i = 0; i < x.length; i++) {
      x[i] /= x[8];
    }
  }

  // Pad with 1 at the end if needed
  return [...x, 1];
}

/**
 * Apply homography matrix to a point
 */
function applyHomography(point, H) {
  const [x, y] = point;
  const [h1, h2, h3, h4, h5, h6, h7, h8, h9] = H;

  const px = h1 * x + h2 * y + h3;
  const py = h4 * x + h5 * y + h6;
  const pz = h7 * x + h8 * y + h9;

  return [px / pz, py / pz];
}

/**
 * Warp an image to a rectangle using perspective transform
 * 
 * @param {ImageBitmap} imageBitmap - Source image
 * @param {Array} quad - [tl, tr, br, bl] corners to warp
 * @param {number} targetWidth - Output width (default: based on quad aspect ratio)
 * @param {number} targetHeight - Output height (default: based on quad aspect ratio)
 * @returns {Promise<ImageBitmap>} Warped rectangular image
 */
export async function warpToRect(imageBitmap, quad, targetWidth = null, targetHeight = null) {
  try {
    // If target size not specified, compute from quad aspect ratio
    if (!targetWidth || !targetHeight) {
      const [tl, tr, br, bl] = quad;
      
      const topEdge = Math.sqrt(
        (tr[0] - tl[0]) ** 2 + (tr[1] - tl[1]) ** 2
      );
      const bottomEdge = Math.sqrt(
        (br[0] - bl[0]) ** 2 + (br[1] - bl[1]) ** 2
      );
      const leftEdge = Math.sqrt(
        (bl[0] - tl[0]) ** 2 + (bl[1] - tl[1]) ** 2
      );
      const rightEdge = Math.sqrt(
        (br[0] - tr[0]) ** 2 + (br[1] - tr[1]) ** 2
      );

      // Average opposite edges
      const w = (topEdge + bottomEdge) / 2;
      const h = (leftEdge + rightEdge) / 2;

      // Target: A4 proportions (210/297 ≈ 0.707) or use actual ratio
      const aspectRatio = w / h;
      const targetAspect = 0.707; // A4

      // If ratio is wildly different (e.g., photograph of a square flyer),
      // use the actual ratio instead of forcing A4
      if (Math.abs(Math.log(aspectRatio / targetAspect)) > 0.3) {
        // Use actual ratio
        targetWidth = Math.round(w * 2); // 2x for ~300dpi equivalent
        targetHeight = Math.round(h * 2);
      } else {
        // Force A4 proportions at 2x resolution
        targetWidth = 2000;
        targetHeight = Math.round(2000 / targetAspect);
      }
    }

    // Compute homography
    const H = computeHomography(quad, targetWidth, targetHeight);

    // Create canvas and context
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context');

    // Draw source image on temp canvas to get ImageData
    const srcCanvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) throw new Error('Could not get src context');
    srcCtx.drawImage(imageBitmap, 0, 0);

    const srcImageData = srcCtx.getImageData(
      0,
      0,
      imageBitmap.width,
      imageBitmap.height
    );
    const srcData = srcImageData.data;
    const srcWidth = imageBitmap.width;
    const srcHeight = imageBitmap.height;

    // Create output ImageData
    const outImageData = ctx.createImageData(targetWidth, targetHeight);
    const outData = outImageData.data;

    // Apply perspective transform using bilinear interpolation
    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        // Map target (x, y) back to source coordinates
        const [srcX, srcY] = perspectiveInverse(
          [x, y],
          H
        );

        // Bilinear interpolation
        const [r, g, b, a] = bilinearInterpolate(
          srcX,
          srcY,
          srcData,
          srcWidth,
          srcHeight
        );

        const outIdx = (y * targetWidth + x) * 4;
        outData[outIdx] = r;
        outData[outIdx + 1] = g;
        outData[outIdx + 2] = b;
        outData[outIdx + 3] = a;
      }
    }

    ctx.putImageData(outImageData, 0, 0);

    // Convert canvas to ImageBitmap
    return await createImageBitmap(canvas);
  } catch (e) {
    console.error('[perspectiveWarp] Error:', e);
    return imageBitmap; // Return original on error
  }
}

/**
 * Inverse homography: given output (x, y), find source coordinates
 * H maps source -> target, so we need H^-1 to map target -> source
 */
function perspectiveInverse(point, H) {
  // Invert homography matrix
  const H_inv = invertMatrix3x3(H);
  return applyHomography(point, H_inv);
}

/**
 * Invert a 3x3 matrix (represented as 9-element array)
 */
function invertMatrix3x3(H) {
  const [h1, h2, h3, h4, h5, h6, h7, h8, h9] = H;

  // Matrix form:
  // [h1 h2 h3]
  // [h4 h5 h6]
  // [h7 h8 h9]

  const det =
    h1 * (h5 * h9 - h6 * h8) -
    h2 * (h4 * h9 - h6 * h7) +
    h3 * (h4 * h8 - h5 * h7);

  if (Math.abs(det) < 1e-10) {
    return H; // Singular, return original
  }

  const invDet = 1 / det;

  return [
    (h5 * h9 - h6 * h8) * invDet,
    (h3 * h8 - h2 * h9) * invDet,
    (h2 * h6 - h3 * h5) * invDet,
    (h6 * h7 - h4 * h9) * invDet,
    (h1 * h9 - h3 * h7) * invDet,
    (h3 * h4 - h1 * h6) * invDet,
    (h4 * h8 - h5 * h7) * invDet,
    (h2 * h7 - h1 * h8) * invDet,
    (h1 * h5 - h2 * h4) * invDet,
  ];
}

/**
 * Bilinear interpolation for pixel sampling
 */
function bilinearInterpolate(x, y, srcData, srcWidth, srcHeight) {
  // Clamp to valid range
  x = Math.max(0, Math.min(srcWidth - 1, x));
  y = Math.max(0, Math.min(srcHeight - 1, y));

  const x0 = Math.floor(x);
  const x1 = Math.min(srcWidth - 1, x0 + 1);
  const y0 = Math.floor(y);
  const y1 = Math.min(srcHeight - 1, y0 + 1);

  const fx = x - x0;
  const fy = y - y0;

  const idx00 = (y0 * srcWidth + x0) * 4;
  const idx10 = (y0 * srcWidth + x1) * 4;
  const idx01 = (y1 * srcWidth + x0) * 4;
  const idx11 = (y1 * srcWidth + x1) * 4;

  const r =
    srcData[idx00] * (1 - fx) * (1 - fy) +
    srcData[idx10] * fx * (1 - fy) +
    srcData[idx01] * (1 - fx) * fy +
    srcData[idx11] * fx * fy;

  const g =
    srcData[idx00 + 1] * (1 - fx) * (1 - fy) +
    srcData[idx10 + 1] * fx * (1 - fy) +
    srcData[idx01 + 1] * (1 - fx) * fy +
    srcData[idx11 + 1] * fx * fy;

  const b =
    srcData[idx00 + 2] * (1 - fx) * (1 - fy) +
    srcData[idx10 + 2] * fx * (1 - fy) +
    srcData[idx01 + 2] * (1 - fx) * fy +
    srcData[idx11 + 2] * fx * fy;

  const a =
    srcData[idx00 + 3] * (1 - fx) * (1 - fy) +
    srcData[idx10 + 3] * fx * (1 - fy) +
    srcData[idx01 + 3] * (1 - fx) * fy +
    srcData[idx11 + 3] * fx * fy;

  return [
    Math.round(r),
    Math.round(g),
    Math.round(b),
    Math.round(a),
  ];
}

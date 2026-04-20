/**
 * Paper Enhancement Pipeline
 *
 * Improves scanned paper readability through:
 * 1. Greyscale conversion (if needed)
 * 2. Adaptive threshold (Sauvola-style) for uneven lighting
 * 3. Optional denoise (median filter)
 * 4. Contrast stretch for crisp black text on white background
 *
 * Runs in OffscreenCanvas, keeps data off the main thread.
 * Never over-processes; skips enhancement if image is already sharp.
 */

/**
 * Convert image to greyscale
 */
function toGreyscale(imageData) {
  const { data, width, height } = imageData;
  const grey = new Uint8ClampedArray(width * height);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    grey[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  return grey;
}

/**
 * Compute Laplacian variance to detect if image is already sharp
 */
function laplacianVariance(grey, width, height) {
  const laplacian = new Float32Array(width * height);
  const kernel = [
    [0, -1, 0],
    [-1, 4, -1],
    [0, -1, 0],
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const neighborIdx = (y + dy) * width + (x + dx);
          sum += grey[neighborIdx] * kernel[dy + 1][dx + 1];
        }
      }

      laplacian[y * width + x] = sum;
    }
  }

  // Compute variance
  let mean = 0;
  for (let i = 0; i < laplacian.length; i++) {
    mean += Math.abs(laplacian[i]);
  }
  mean /= laplacian.length;

  let variance = 0;
  for (let i = 0; i < laplacian.length; i++) {
    variance += (Math.abs(laplacian[i]) - mean) ** 2;
  }
  variance /= laplacian.length;

  return Math.sqrt(variance);
}

/**
 * Sauvola-style adaptive threshold
 * Uses local mean and standard deviation to determine per-pixel threshold
 *
 * @param {Uint8ClampedArray} grey - Greyscale values
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} windowSize - Local window size (default 25)
 * @param {number} k - Sensitivity factor (default 0.2)
 */
function savolaThreshold(grey, width, height, windowSize = 25, k = 0.2) {
  const halfWindow = Math.floor(windowSize / 2);
  const result = new Uint8ClampedArray(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Compute local mean and std dev
      let sum = 0;
      let sumSq = 0;
      let count = 0;

      for (let dy = -halfWindow; dy <= halfWindow; dy++) {
        for (let dx = -halfWindow; dx <= halfWindow; dx++) {
          const ny = Math.max(0, Math.min(height - 1, y + dy));
          const nx = Math.max(0, Math.min(width - 1, x + dx));
          const val = grey[ny * width + nx];

          sum += val;
          sumSq += val * val;
          count++;
        }
      }

      const mean = sum / count;
      const variance = sumSq / count - mean * mean;
      const stdDev = Math.sqrt(Math.max(0, variance));

      // Sauvola threshold formula
      const threshold = mean * (1 + k * (stdDev / 128 - 1));

      // Apply threshold
      const pixelVal = grey[y * width + x];
      result[y * width + x] = pixelVal < threshold ? 0 : 255;
    }
  }

  return result;
}

/**
 * Median filter (3x3) for light denoising
 */
function medianFilter(grey, width, height) {
  const result = new Uint8ClampedArray(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const values = [];

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          values.push(grey[(y + dy) * width + (x + dx)]);
        }
      }

      values.sort((a, b) => a - b);
      result[y * width + x] = values[4]; // Middle value
    }
  }

  // Copy edges
  for (let x = 0; x < width; x++) {
    result[x] = grey[x];
    result[(height - 1) * width + x] = grey[(height - 1) * width + x];
  }
  for (let y = 0; y < height; y++) {
    result[y * width] = grey[y * width];
    result[y * width + (width - 1)] = grey[y * width + (width - 1)];
  }

  return result;
}

/**
 * Compute histogram entropy to detect noise level
 */
function noiseLevel(grey) {
  const hist = new Uint32Array(256);

  for (let i = 0; i < grey.length; i++) {
    hist[grey[i]]++;
  }

  // Entropy
  let entropy = 0;
  const total = grey.length;

  for (let i = 0; i < 256; i++) {
    const p = hist[i] / total;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  return entropy / 8; // Normalize to 0..1
}

/**
 * Contrast stretch: remap so min→0, max→240 (not pure white to preserve texture)
 */
function contrastStretch(data, width, height) {
  const result = new Uint8ClampedArray(width * height);

  // Find min/max
  let min = 255,
    max = 0;
  for (let i = 0; i < data.length; i++) {
    min = Math.min(min, data[i]);
    max = Math.max(max, data[i]);
  }

  const range = max - min;

  if (range < 10) {
    // Already low contrast, don't stretch
    return new Uint8ClampedArray(data);
  }

  // Remap
  for (let i = 0; i < data.length; i++) {
    result[i] = Math.round(((data[i] - min) / range) * 240);
  }

  return result;
}

/**
 * Convert greyscale + alpha back to RGBA
 */
function greyscaleToRGBA(grey, originalAlpha = null) {
  const rgba = new Uint8ClampedArray(grey.length * 4);

  for (let i = 0; i < grey.length; i++) {
    const val = grey[i];
    rgba[i * 4] = val;
    rgba[i * 4 + 1] = val;
    rgba[i * 4 + 2] = val;
    rgba[i * 4 + 3] = originalAlpha ? originalAlpha[i] : 255;
  }

  return rgba;
}

/**
 * Main enhancement pipeline
 *
 * @param {ImageBitmap} imageBitmap - Input image
 * @param {string} mode - Enhancement mode: 'auto' | 'bw' | 'colour'
 * @returns {Promise<ImageBitmap>} Enhanced image
 */
export async function enhanceImage(imageBitmap, mode = "auto") {
  try {
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return imageBitmap;

    ctx.drawImage(imageBitmap, 0, 0);
    const imageData = ctx.getImageData(
      0,
      0,
      imageBitmap.width,
      imageBitmap.height,
    );
    const { width, height } = imageData;

    // Mode: 'colour' — skip all enhancement
    if (mode === "colour") {
      return imageBitmap;
    }

    // Convert to greyscale
    const grey = toGreyscale(imageData);

    // Check if already sharp — skip enhancement if so
    if (mode === "auto") {
      const sharpness = laplacianVariance(grey, width, height);
      if (sharpness > 100) {
        // Already sharp, return original
        return imageBitmap;
      }
    }

    // Adaptive threshold
    let enhanced = savolaThreshold(grey, width, height, 25, 0.2);

    // Optional denoising
    const noise = noiseLevel(enhanced);
    if (noise > 3.5) {
      enhanced = medianFilter(enhanced, width, height);
    }

    // Contrast stretch
    enhanced = contrastStretch(enhanced, width, height);

    // Convert back to RGBA
    const result = greyscaleToRGBA(enhanced);

    // Write back to canvas
    const outImageData = new ImageData(result, width, height);
    ctx.putImageData(outImageData, 0, 0);

    // Return as ImageBitmap
    return await createImageBitmap(canvas);
  } catch (e) {
    console.error("[paperEnhance] Error:", e);
    return imageBitmap; // Return original on error
  }
}

/**
 * Batch enhance multiple images (e.g., all captured pages)
 */
export async function enhanceImages(
  imageBitmaps,
  mode = "auto",
  onProgress = null,
) {
  const results = [];

  for (let i = 0; i < imageBitmaps.length; i++) {
    const enhanced = await enhanceImage(imageBitmaps[i], mode);
    results.push(enhanced);

    if (onProgress) {
      onProgress((i + 1) / imageBitmaps.length);
    }
  }

  return results;
}

/**
 * Camera frame processing: detect → perspective warp → enhance.
 *
 * The defaults deliberately match the budget-device fast path from the
 * React app: no auto-warp, one cheap contrast pass, and the raw frame kept
 * as the reversible base for later re-processing.
 */

const OUTPUT_JPEG_QUALITY = 0.92
const DEFAULT_ENHANCE = 'fast'

/* ------------------------------------------------------------------ *
 * Canvas helpers
 * ------------------------------------------------------------------ */

function makeCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height)
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function imageDataFrom(source) {
  if (source && typeof source.data !== 'undefined' && source.width && source.height) {
    return source
  }
  const canvas = makeCanvas(source.width, source.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2d context')
  ctx.drawImage(source, 0, 0)
  return ctx.getImageData(0, 0, source.width, source.height)
}

async function canvasToBitmap(canvas) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(canvas)
  const blob = await canvasToBlob(canvas)
  return createImageBitmap(blob)
}

async function canvasToBlob(canvas, quality = OUTPUT_JPEG_QUALITY) {
  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: 'image/jpeg', quality })
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('encode failed'))),
      'image/jpeg',
      quality,
    )
  })
}

export async function blobToBitmap(blob) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob)
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function bitmapToJpegBlob(bitmap, quality = OUTPUT_JPEG_QUALITY) {
  const canvas = makeCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2d context for bitmap encoding')
  ctx.drawImage(bitmap, 0, 0)
  return canvasToBlob(canvas, quality)
}

/* ------------------------------------------------------------------ *
 * Document detection
 * ------------------------------------------------------------------ */

function sobelEdges(imageData) {
  const { data, width, height } = imageData
  const edges = new Float32Array(width * height)
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1]
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1]

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0
      let gy = 0
      let idx = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const pixel = ((y + dy) * width + (x + dx)) * 4
          const grey =
            0.299 * data[pixel] +
            0.587 * data[pixel + 1] +
            0.114 * data[pixel + 2]
          gx += grey * sobelX[idx]
          gy += grey * sobelY[idx]
          idx++
        }
      }
      edges[y * width + x] = Math.sqrt(gx * gx + gy * gy)
    }
  }
  return edges
}

function nonMaxSuppression(edges, width, height, threshold) {
  const suppressed = new Uint8Array(width * height)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const value = edges[idx]
      if (value < threshold) continue
      let localMax = true
      for (let dy = -1; dy <= 1 && localMax; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          if (edges[(y + dy) * width + (x + dx)] > value) {
            localMax = false
            break
          }
        }
      }
      suppressed[idx] = localMax ? 255 : 0
    }
  }
  return suppressed
}

function houghLineTransform(edges, width, height, threshold) {
  const accumulator = new Map()
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (edges[y * width + x] < threshold) continue
      for (let theta = 0; theta < 180; theta++) {
        const rad = (theta * Math.PI) / 180
        const rho = Math.round(x * Math.cos(rad) + y * Math.sin(rad))
        const key = `${theta},${rho}`
        accumulator.set(key, (accumulator.get(key) || 0) + 1)
      }
    }
  }
  return Array.from(accumulator.entries())
    .map(([key, count]) => {
      const [theta, rho] = key.split(',').map(Number)
      return { theta, rho, count }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
}

function lineIntersection(a, b, width, height) {
  const t1 = (a.theta * Math.PI) / 180
  const t2 = (b.theta * Math.PI) / 180
  const denominator =
    Math.cos(t1) * Math.sin(t2) - Math.sin(t1) * Math.cos(t2)
  if (Math.abs(denominator) < 1e-6) return null
  const x = (a.rho * Math.sin(t2) - b.rho * Math.sin(t1)) / denominator
  const y = (b.rho * Math.cos(t1) - a.rho * Math.cos(t2)) / denominator
  const margin = 50
  if (x < -margin || x > width + margin || y < -margin || y > height + margin) {
    return null
  }
  return [x, y]
}

function distance(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)
}

function quadScore(quad) {
  let firstCross = 0
  for (let i = 0; i < 4; i++) {
    const [p0, p1, p2] = [quad[i], quad[(i + 1) % 4], quad[(i + 2) % 4]]
    const cross =
      (p1[0] - p0[0]) * (p2[1] - p0[1]) -
      (p1[1] - p0[1]) * (p2[0] - p0[0])
    if (i === 0) firstCross = cross
    else if (cross > 0 !== firstCross > 0) return 0
  }
  const aspectRatio = distance(quad[0], quad[1]) / distance(quad[1], quad[2])
  const rationality =
    1 /
    (1 + Math.abs(Math.log(Math.max(aspectRatio, 1 / aspectRatio))))
  const area =
    quad[0][0] * quad[1][1] -
    quad[1][0] * quad[0][1] +
    (quad[1][0] * quad[2][1] - quad[2][0] * quad[1][1]) +
    (quad[2][0] * quad[3][1] - quad[3][0] * quad[2][1]) +
    (quad[3][0] * quad[0][1] - quad[0][0] * quad[3][1])
  const areaNorm = Math.min(Math.abs(area / 2) / (800 * 600), 1)
  return rationality * 0.5 + areaNorm * 0.5
}

function quadArea(quad) {
  let area = 0
  for (let i = 0; i < 4; i++) {
    const p0 = quad[i]
    const p1 = quad[(i + 1) % 4]
    area += p0[0] * p1[1] - p1[0] * p0[1]
  }
  return Math.abs(area / 2)
}

function pickConvexQuad(candidates) {
  let best = null
  let bestScore = 0
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      for (let k = j + 1; k < candidates.length; k++) {
        for (let l = k + 1; l < candidates.length; l++) {
          const quad = [candidates[i], candidates[j], candidates[k], candidates[l]]
          const score = quadScore(quad)
          if (score > bestScore) {
            bestScore = score
            best = quad
          }
        }
      }
    }
  }
  return best
}

function findCornersFromLines(lines, width, height) {
  const corners = []
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    for (let j = i + 1; j < Math.min(lines.length, 10); j++) {
      const point = lineIntersection(lines[i], lines[j], width, height)
      if (point) corners.push(point)
    }
  }
  if (corners.length < 4) return null
  const cx = width / 2
  const cy = height / 2
  corners.sort(
    (a, b) =>
      Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx),
  )
  return pickConvexQuad(corners)
}

function adaptiveThreshold(edges) {
  const bins = new Uint32Array(256)
  for (let i = 0; i < edges.length; i++) {
    bins[Math.min(255, Math.floor((edges[i] / 255) * 255))]++
  }
  let sum = 0
  const target = edges.length * 0.7
  for (let i = 255; i >= 0; i--) {
    sum += bins[i]
    if (sum >= target) return i
  }
  return 128
}

function detectionConfidence(corners, width, height, lineCount) {
  if (!corners || corners.length !== 4) return 0
  for (const [x, y] of corners) {
    if (x < -100 || x > width + 100 || y < -100 || y > height + 100) return 0
  }
  const coverage = quadArea(corners) / (width * height)
  const lineConfidence = Math.min(lineCount / 50, 1)
  const coverageConfidence =
    coverage < 0.1 ? 0 : coverage > 0.6 ? 1 : coverage / 0.6
  return lineConfidence * 0.4 + coverageConfidence * 0.6
}

/** Detect the four paper corners. Returns null on any internal failure. */
export function detectPaperQuad(source) {
  try {
    const imageData = imageDataFrom(source)
    const { width, height } = imageData
    const edges = sobelEdges(imageData)
    const threshold = adaptiveThreshold(edges)
    const suppressed = nonMaxSuppression(edges, width, height, threshold * 0.5)
    const lines = houghLineTransform(suppressed, width, height, 10)
    if (lines.length < 4) return null
    const corners = findCornersFromLines(lines, width, height)
    if (!corners) return null
    return { corners, confidence: detectionConfidence(corners, width, height, lines.length) }
  } catch (err) {
    console.error('[documentDetect] Error:', err)
    return null
  }
}

export const detectQuad = detectPaperQuad

/* ------------------------------------------------------------------ *
 * Perspective warp
 * ------------------------------------------------------------------ */

function solveLinearSystem(A) {
  const mat = A.map((row) => [...row])
  const n = mat.length
  const m = mat[0].length
  for (let col = 0; col < Math.min(n, m - 1); col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(mat[row][col]) > Math.abs(mat[pivot][col])) pivot = row
    }
    ;[mat[col], mat[pivot]] = [mat[pivot], mat[col]]
    for (let row = col + 1; row < n; row++) {
      const factor = mat[row][col] / mat[col][col]
      for (let j = col; j < m; j++) mat[row][j] -= factor * mat[col][j]
    }
  }
  const x = new Array(m - 1).fill(0)
  for (let i = Math.min(n, m - 1) - 1; i >= 0; i--) {
    let sum = 0
    for (let j = i + 1; j < m - 1; j++) sum += mat[i][j] * x[j]
    if (Math.abs(mat[i][i]) > 1e-10) x[i] = (mat[i][m - 1] - sum) / mat[i][i]
  }
  if (x[8] !== 0) for (let i = 0; i < x.length; i++) x[i] /= x[8]
  return [...x, 1]
}

function computeHomography(src, targetWidth, targetHeight) {
  const dst = [
    [0, 0],
    [targetWidth, 0],
    [targetWidth, targetHeight],
    [0, targetHeight],
  ]
  const A = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]
    const [xp, yp] = dst[i]
    A.push([x, y, 1, 0, 0, 0, -xp * x, -xp * y, -xp])
    A.push([0, 0, 0, x, y, 1, -yp * x, -yp * y, -yp])
  }
  return solveLinearSystem(A)
}

function applyHomography([x, y], H) {
  const px = H[0] * x + H[1] * y + H[2]
  const py = H[3] * x + H[4] * y + H[5]
  const pz = H[6] * x + H[7] * y + H[8]
  return [px / pz, py / pz]
}

function invertMatrix3x3(H) {
  const [a, b, c, d, e, f, g, h, i] = H
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
  if (Math.abs(det) < 1e-10) return H
  const inv = 1 / det
  return [
    (e * i - f * h) * inv,
    (c * h - b * i) * inv,
    (b * f - c * e) * inv,
    (f * g - d * i) * inv,
    (a * i - c * g) * inv,
    (c * d - a * f) * inv,
    (d * h - e * g) * inv,
    (b * g - a * h) * inv,
    (a * e - b * d) * inv,
  ]
}

function bilinear(x, y, data, width, height) {
  x = Math.max(0, Math.min(width - 1, x))
  y = Math.max(0, Math.min(height - 1, y))
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const fx = x - x0
  const fy = y - y0
  const out = []
  for (let channel = 0; channel < 4; channel++) {
    const idx00 = (y0 * width + x0) * 4 + channel
    const idx10 = (y0 * width + x1) * 4 + channel
    const idx01 = (y1 * width + x0) * 4 + channel
    const idx11 = (y1 * width + x1) * 4 + channel
    out.push(
      Math.round(
        data[idx00] * (1 - fx) * (1 - fy) +
          data[idx10] * fx * (1 - fy) +
          data[idx01] * (1 - fx) * fy +
          data[idx11] * fx * fy,
      ),
    )
  }
  return out
}

export async function warpToRect(
  imageBitmap,
  quad,
  targetWidth = null,
  targetHeight = null,
) {
  try {
    if (!targetWidth || !targetHeight) {
      const [tl, tr, br, bl] = quad
      const top = distance(tl, tr)
      const bottom = distance(bl, br)
      const left = distance(tl, bl)
      const right = distance(tr, br)
      const w = (top + bottom) / 2
      const h = (left + right) / 2
      const aspectRatio = w / h
      if (Math.abs(Math.log(aspectRatio / 0.707)) > 0.3) {
        targetWidth = Math.round(w * 2)
        targetHeight = Math.round(h * 2)
      } else {
        targetWidth = 2000
        targetHeight = Math.round(2000 / 0.707)
      }
    }

    const H = computeHomography(quad, targetWidth, targetHeight)
    const inverse = invertMatrix3x3(H)
    const canvas = makeCanvas(targetWidth, targetHeight)
    const ctx = canvas.getContext('2d')
    const sourceData = imageDataFrom(imageBitmap)
    const out = ctx.createImageData(targetWidth, targetHeight)

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const [sx, sy] = applyHomography([x, y], inverse)
        const [r, g, b, a] = bilinear(
          sx,
          sy,
          sourceData.data,
          sourceData.width,
          sourceData.height,
        )
        const idx = (y * targetWidth + x) * 4
        out.data[idx] = r
        out.data[idx + 1] = g
        out.data[idx + 2] = b
        out.data[idx + 3] = a
      }
    }
    ctx.putImageData(out, 0, 0)
    return await canvasToBitmap(canvas)
  } catch (err) {
    console.error('[perspectiveWarp] Error:', err)
    return imageBitmap
  }
}

export const warpQuad = warpToRect

/* ------------------------------------------------------------------ *
 * Enhancement
 * ------------------------------------------------------------------ */

function toGreyscale(imageData) {
  const grey = new Uint8ClampedArray(imageData.width * imageData.height)
  for (let i = 0; i < imageData.data.length; i += 4) {
    grey[i / 4] = Math.round(
      0.299 * imageData.data[i] +
        0.587 * imageData.data[i + 1] +
        0.114 * imageData.data[i + 2],
    )
  }
  return grey
}

function laplacianVariance(grey, width, height) {
  const kernel = [0, -1, 0, -1, 4, -1, 0, -1, 0]
  const values = new Float32Array(width * height)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0
      let idx = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += grey[(y + dy) * width + (x + dx)] * kernel[idx++]
        }
      }
      values[y * width + x] = sum
    }
  }
  let mean = 0
  for (let i = 0; i < values.length; i++) mean += Math.abs(values[i])
  mean /= values.length
  let variance = 0
  for (let i = 0; i < values.length; i++) {
    variance += (Math.abs(values[i]) - mean) ** 2
  }
  return Math.sqrt(variance / values.length)
}

function sauvolaThreshold(grey, width, height, windowSize = 25, k = 0.2) {
  const half = Math.floor(windowSize / 2)
  const result = new Uint8ClampedArray(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let sumSq = 0
      let count = 0
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const val = grey[
            Math.max(0, Math.min(height - 1, y + dy)) * width +
              Math.max(0, Math.min(width - 1, x + dx))
          ]
          sum += val
          sumSq += val * val
          count++
        }
      }
      const mean = sum / count
      const std = Math.sqrt(Math.max(0, sumSq / count - mean * mean))
      const threshold = mean * (1 + k * (std / 128 - 1))
      result[y * width + x] = grey[y * width + x] < threshold ? 0 : 255
    }
  }
  return result
}

function medianFilter(grey, width, height) {
  const result = new Uint8ClampedArray(width * height)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const values = []
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          values.push(grey[(y + dy) * width + (x + dx)])
        }
      }
      values.sort((a, b) => a - b)
      result[y * width + x] = values[4]
    }
  }
  for (let x = 0; x < width; x++) {
    result[x] = grey[x]
    result[(height - 1) * width + x] = grey[(height - 1) * width + x]
  }
  for (let y = 0; y < height; y++) {
    result[y * width] = grey[y * width]
    result[y * width + width - 1] = grey[y * width + width - 1]
  }
  return result
}

function noiseLevel(grey) {
  const histogram = new Uint32Array(256)
  for (let i = 0; i < grey.length; i++) histogram[grey[i]]++
  let entropy = 0
  for (let i = 0; i < 256; i++) {
    const p = histogram[i] / grey.length
    if (p > 0) entropy -= p * Math.log2(p)
  }
  return entropy / 8
}

function contrastStretch(data) {
  let min = 255
  let max = 0
  for (let i = 0; i < data.length; i++) {
    min = Math.min(min, data[i])
    max = Math.max(max, data[i])
  }
  const range = max - min
  if (range < 10) return new Uint8ClampedArray(data)
  const result = new Uint8ClampedArray(data.length)
  for (let i = 0; i < data.length; i++) {
    result[i] = Math.round(((data[i] - min) / range) * 240)
  }
  return result
}

function fastContrastStretchRGBA(imageData) {
  const { data } = imageData
  const hist = new Uint32Array(256)
  let sampled = 0
  for (let i = 0; i < data.length; i += 32) {
    const lum = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
    )
    hist[Math.max(0, Math.min(255, lum))]++
    sampled++
  }
  if (sampled === 0) return imageData
  const lowCount = Math.floor(sampled * 0.02)
  const highCount = Math.floor(sampled * 0.98)
  let low = 0
  let high = 255
  let running = 0
  for (let i = 0; i < 256; i++) {
    running += hist[i]
    if (low === 0 && running >= lowCount) low = i
    if (running >= highCount) {
      high = i
      break
    }
  }
  const range = high - low
  if (range >= 200 || range < 10) return imageData
  const scale = 232 / range
  const lut = new Uint8ClampedArray(256)
  for (let i = 0; i < 256; i++) lut[i] = Math.round(8 + (i - low) * scale)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]]
    data[i + 1] = lut[data[i + 1]]
    data[i + 2] = lut[data[i + 2]]
  }
  return imageData
}

function greyToRGBA(grey) {
  const rgba = new Uint8ClampedArray(grey.length * 4)
  for (let i = 0; i < grey.length; i++) {
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = grey[i]
    rgba[i * 4 + 3] = 255
  }
  return rgba
}

export async function enhanceImage(imageBitmap, mode = DEFAULT_ENHANCE) {
  try {
    if (mode === 'colour') return imageBitmap
    const canvas = makeCanvas(imageBitmap.width, imageBitmap.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return imageBitmap
    ctx.drawImage(imageBitmap, 0, 0)
    const imageData = ctx.getImageData(
      0,
      0,
      imageBitmap.width,
      imageBitmap.height,
    )

    if (mode === 'fast') {
      ctx.putImageData(fastContrastStretchRGBA(imageData), 0, 0)
      return await canvasToBitmap(canvas)
    }

    const { width, height } = imageData
    const grey = toGreyscale(imageData)
    if (mode === 'auto' && laplacianVariance(grey, width, height) > 100) {
      return imageBitmap
    }
    let enhanced = sauvolaThreshold(grey, width, height, 25, 0.2)
    if (noiseLevel(enhanced) > 3.5) enhanced = medianFilter(enhanced, width, height)
    enhanced = contrastStretch(enhanced)
    ctx.putImageData(
      new ImageData(greyToRGBA(enhanced), width, height),
      0,
      0,
    )
    return await canvasToBitmap(canvas)
  } catch (err) {
    console.error('[paperEnhance] Error:', err)
    return imageBitmap
  }
}

export const enhance = enhanceImage

export async function enhanceImages(images, mode = DEFAULT_ENHANCE, onProgress) {
  const results = []
  for (let i = 0; i < images.length; i++) {
    results.push(await enhanceImage(images[i], mode))
    onProgress?.((i + 1) / images.length)
  }
  return results
}

/* ------------------------------------------------------------------ *
 * Pipeline
 * ------------------------------------------------------------------ */

/**
 * Process one captured frame. Internal failures fall back to the previous
 * stage; only a failure to decode the raw blob rejects.
 */
export async function processCapturedFrame(rawBlob, options = {}) {
  const { enhanceMode = DEFAULT_ENHANCE, autoDetect = false } = options
  const rawBitmap = await blobToBitmap(rawBlob)
  const frameWidth = rawBitmap.width
  const frameHeight = rawBitmap.height
  let baseBlob = rawBlob

  let baseBitmap = rawBitmap
  let crop = { corners: null, mode: 'none', confidence: null }

  if (autoDetect) {
    try {
      const detected = detectPaperQuad(rawBitmap)
      if (
        detected &&
        detected.confidence >= 0.6 &&
        quadArea(detected.corners) / (frameWidth * frameHeight) >= 0.6
      ) {
        baseBitmap = await warpToRect(rawBitmap, detected.corners)
        crop = {
          corners: detected.corners,
          mode: 'auto',
          confidence: detected.confidence,
        }
        baseBlob = await bitmapToJpegBlob(baseBitmap)
      }
    } catch (err) {
      console.warn('[capture] detect/warp failed, using raw frame:', err)
      baseBitmap = rawBitmap
      crop = { corners: null, mode: 'none', confidence: null }
    }
  }

  let finalBitmap = baseBitmap
  try {
    finalBitmap = await enhanceImage(baseBitmap, enhanceMode)
  } catch (err) {
    console.warn('[capture] enhance failed, using base frame:', err)
    finalBitmap = baseBitmap
  }

  let finalBlob
  if (finalBitmap === baseBitmap && baseBlob === rawBlob && enhanceMode === 'colour') {
    finalBlob = rawBlob
  } else {
    try {
      finalBlob = await bitmapToJpegBlob(finalBitmap)
    } catch (err) {
      console.warn('[capture] final encode failed:', err)
      finalBlob = baseBlob
    }
  }

  return {
    blob: finalBlob,
    dataUrl: URL.createObjectURL(finalBlob),
    width: finalBitmap.width,
    height: finalBitmap.height,
    crop,
    baseBitmap,
    baseBlob,
  }
}

export const processFrame = processCapturedFrame

/** Re-run enhancement on a stored base blob (no detection or warp). */
export async function reprocessPage(baseBlob, enhanceMode = DEFAULT_ENHANCE) {
  const bitmap = await blobToBitmap(baseBlob)
  let out = bitmap
  try {
    out = await enhanceImage(bitmap, enhanceMode)
  } catch (err) {
    console.warn('[capture] reprocess enhance failed:', err)
  }
  let blob = out
  try {
    blob = await bitmapToJpegBlob(out)
  } catch {
    blob = baseBlob
  }
  return {
    blob,
    dataUrl: URL.createObjectURL(blob),
    width: out.width,
    height: out.height,
  }
}

/** Re-run manual crop (warp + enhance) using user-dragged corners. */
export async function reprocessWithCorners(
  rawBlob,
  corners,
  enhanceMode = DEFAULT_ENHANCE,
) {
  const rawBitmap = await blobToBitmap(rawBlob)
  let warped = rawBitmap
  try {
    warped = await warpToRect(rawBitmap, corners)
  } catch (err) {
    console.warn('[capture] manual warp failed:', err)
  }
  let baseBlob = rawBlob
  try {
    baseBlob = await bitmapToJpegBlob(warped)
  } catch {
    baseBlob = rawBlob
  }
  let finalBitmap = warped
  try {
    finalBitmap = await enhanceImage(warped, enhanceMode)
  } catch (err) {
    console.warn('[capture] manual enhance failed:', err)
  }
  let blob = baseBlob
  try {
    blob = await bitmapToJpegBlob(finalBitmap)
  } catch {
    blob = baseBlob
  }
  return {
    blob,
    dataUrl: URL.createObjectURL(blob),
    width: finalBitmap.width,
    height: finalBitmap.height,
    crop: { corners, mode: 'manual', confidence: null },
    baseBitmap: warped,
    baseBlob,
  }
}

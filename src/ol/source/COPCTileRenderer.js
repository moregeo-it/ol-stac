/**
 * @module ol/source/COPCTileRenderer
 */
import {Copc} from 'copc';
import {createLazPerf} from 'laz-perf';

export const BAND_COUNT = 8;

/**
 * @typedef {Object} Options
 * @property {string} url The URL of the COPC file.
 * @property {Object<string, string>} [headers] Additional headers for the requests.
 * @property {import("copc").Copc} copc The COPC metadata.
 * @property {string} wasmUrl The URL of the LAZ decompressor.
 * @property {number} maxCachedPoints The maximum number of decoded points kept in memory.
 */

/**
 * @typedef {Object} TileRequest
 * @property {Array<{key: string, node: import("copc").Hierarchy.Node}>} nodes The octree nodes to render.
 * @property {import("ol/extent.js").Extent} extent The extent including the margin.
 * @property {number} resolution The resolution.
 * @property {number} size The tile size in pixels.
 * @property {number} margin The margin in pixels.
 * @property {number} pointSize The minimum point size in pixels.
 * @property {number} shadeExaggeration The vertical exaggeration for the lighting.
 * @property {number} unitScale The size of a horizontal unit in elevation units.
 * @property {number} sunAzimuth The azimuth of the sun in degrees (clockwise from north).
 * @property {number} sunAltitude The altitude of the sun in degrees.
 * @property {number} shadowLength The maximum length of shadows in pixels (0 disables shadows).
 * @property {number} occlusionRadius The radius of the ambient occlusion in pixels (0 disables it).
 */

/**
 * @typedef {Object} NodePoints
 * @property {number} depth The octree depth of the node.
 * @property {number} count The number of points.
 * @property {Float64Array} x X coordinates.
 * @property {Float64Array} y Y coordinates.
 * @property {Float32Array} z Z coordinates.
 * @property {Uint16Array} intensity Intensities.
 * @property {Uint8Array} classification Classifications.
 * @property {Uint16Array|null} rgb Interleaved colors, if available.
 */

/**
 * @type {Object<string, Promise<Object>>}
 */
const lazPerfInstances = {};

/**
 * @param {string} url The URL of the WebAssembly file.
 * @return {Promise<Object>} The LAZ decompressor.
 */
function getLazPerf(url) {
  if (!lazPerfInstances[url]) {
    lazPerfInstances[url] = createLazPerf({locateFile: () => url});
  }
  return lazPerfInstances[url];
}

/**
 * @param {string} url The URL.
 * @param {Object<string, string>} [headers] Additional headers.
 * @return {function(number, number): Promise<Uint8Array>} The range getter.
 */
export function createRangeGetter(url, headers = {}) {
  return async (begin, end) => {
    const response = await fetch(url, {
      headers: Object.assign({}, headers, {
        Range: `bytes=${begin}-${end - 1}`,
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Failed to load ${url}: ${response.status} ${response.statusText}`,
      );
    }
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (response.status !== 206 && buffer.byteLength !== end - begin) {
      throw new Error(`The server for ${url} doesn't support range requests`);
    }
    return buffer;
  };
}

/**
 * @param {import("copc").Copc} copc The COPC metadata.
 * @return {boolean} Whether the points have colors.
 */
export function hasColors(copc) {
  return [2, 3, 5, 7, 8, 10].includes(copc.header.pointDataRecordFormat);
}

/**
 * Decodes COPC nodes and renders them into data tiles.
 * Runs in a worker, or on the main thread if workers are not available.
 */
class COPCTileRenderer {
  /**
   * @param {Options} options The options.
   */
  constructor(options) {
    /**
     * @type {import("copc").Copc}
     * @private
     */
    this.copc_ = options.copc;

    /**
     * @type {function(number, number): Promise<Uint8Array>}
     * @private
     */
    this.getter_ = createRangeGetter(options.url, options.headers);

    /**
     * @type {Promise<Object>}
     * @private
     */
    this.lazPerf_ = getLazPerf(options.wasmUrl);

    /**
     * @type {number}
     * @private
     */
    this.maxCachedPoints_ = options.maxCachedPoints;

    /**
     * Least recently used first.
     * @type {Map<string, {count: number, points: Promise<NodePoints>}>}
     * @private
     */
    this.cache_ = new Map();

    /**
     * @type {number}
     * @private
     */
    this.cachedPoints_ = 0;
  }

  /**
   * @param {TileRequest} request The tile request.
   * @param {function(): boolean} [isAborted] Whether the request was aborted.
   * @return {Promise<Float32Array>} The data.
   */
  async render(request, isAborted = () => false) {
    const nodes = await Promise.all(
      request.nodes.map(({key, node}) => this.getPoints_(key, node)),
    );
    if (isAborted()) {
      throw new Error('Aborted');
    }
    return this.rasterize_(request, nodes);
  }

  /**
   * @param {string} key The node key.
   * @param {import("copc").Hierarchy.Node} node The node.
   * @return {Promise<NodePoints>} The decoded points.
   * @private
   */
  getPoints_(key, node) {
    let entry = this.cache_.get(key);
    if (entry) {
      // Mark as recently used
      this.cache_.delete(key);
      this.cache_.set(key, entry);
      return entry.points;
    }
    entry = {count: node.pointCount, points: this.decodePoints_(key, node)};
    this.cache_.set(key, entry);
    this.cachedPoints_ += entry.count;
    for (const [oldKey, oldEntry] of this.cache_) {
      if (this.cachedPoints_ <= this.maxCachedPoints_ || oldKey === key) {
        break;
      }
      this.cache_.delete(oldKey);
      this.cachedPoints_ -= oldEntry.count;
    }
    entry.points.catch(() => {
      if (this.cache_.get(key) === entry) {
        this.cache_.delete(key);
        this.cachedPoints_ -= entry.count;
      }
    });
    return entry.points;
  }

  /**
   * @param {string} key The node key.
   * @param {import("copc").Hierarchy.Node} node The node.
   * @return {Promise<NodePoints>} The decoded points.
   * @private
   */
  async decodePoints_(key, node) {
    const colors = hasColors(this.copc_);
    const include = ['X', 'Y', 'Z', 'Intensity', 'Classification'];
    if (colors) {
      include.push('Red', 'Green', 'Blue');
    }
    const view = await Copc.loadPointDataView(this.getter_, this.copc_, node, {
      lazPerf: /** @type {*} */ (await this.lazPerf_),
      include,
    });
    const count = view.pointCount;
    const getX = view.getter('X');
    const getY = view.getter('Y');
    const getZ = view.getter('Z');
    const getIntensity = view.getter('Intensity');
    const getClassification = view.getter('Classification');
    const points = {
      depth: parseInt(key, 10),
      count,
      x: new Float64Array(count),
      y: new Float64Array(count),
      z: new Float32Array(count),
      intensity: new Uint16Array(count),
      classification: new Uint8Array(count),
      rgb: colors ? new Uint16Array(count * 3) : null,
    };
    for (let i = 0; i < count; i++) {
      points.x[i] = getX(i);
      points.y[i] = getY(i);
      points.z[i] = getZ(i);
      points.intensity[i] = getIntensity(i);
      points.classification[i] = getClassification(i);
    }
    if (colors) {
      const getters = [
        view.getter('Red'),
        view.getter('Green'),
        view.getter('Blue'),
      ];
      for (let i = 0; i < count; i++) {
        for (let c = 0; c < 3; c++) {
          points.rgb[i * 3 + c] = getters[c](i);
        }
      }
    }
    return points;
  }

  /**
   * @param {TileRequest} request The tile request.
   * @param {Array<NodePoints>} nodes The decoded nodes.
   * @return {Float32Array} The data.
   * @private
   */
  rasterize_(request, nodes) {
    const {extent, resolution, size, margin} = request;
    const spacing = this.copc_.info.spacing;
    const deepest = nodes.reduce((d, node) => Math.max(d, node.depth), 0);
    const splat = Math.max(
      request.pointSize,
      Math.ceil(spacing / Math.pow(2, deepest) / resolution),
    );

    const full = size + 2 * margin;
    const zBuffer = new Float32Array(full * full).fill(-Infinity);
    const nodeIndex = new Int32Array(full * full).fill(-1);
    const pointIndex = new Int32Array(full * full);
    const offset = Math.floor((splat - 1) / 2);
    // Larger points are drawn as domes to give them a 3D appearance,
    // the dome covers the corners so that no gaps remain between points
    const radius = (splat / 2) * Math.SQRT2;
    const dome = splat >= 3;
    const domeHeight = (0.5 * splat * resolution) / request.unitScale;
    const center = (splat - 1) / 2;
    for (let n = 0; n < nodes.length; n++) {
      const points = nodes[n];
      for (let i = 0; i < points.count; i++) {
        const px = points.x[i];
        const py = points.y[i];
        if (
          px < extent[0] ||
          px >= extent[2] ||
          py <= extent[1] ||
          py > extent[3]
        ) {
          continue;
        }
        const col = Math.floor((px - extent[0]) / resolution) - offset;
        const row = Math.floor((extent[3] - py) / resolution) - offset;
        const pz = points.z[i];
        for (let r = Math.max(0, row); r < Math.min(full, row + splat); r++) {
          for (let c = Math.max(0, col); c < Math.min(full, col + splat); c++) {
            let z = pz;
            if (dome) {
              const dr = r - row - center;
              const dc = c - col - center;
              const d = (dr * dr + dc * dc) / (radius * radius);
              z += Math.sqrt(1 - d) * domeHeight;
            }
            const index = r * full + c;
            if (z > zBuffer[index]) {
              zBuffer[index] = z;
              nodeIndex[index] = n;
              pointIndex[index] = i;
            }
          }
        }
      }
    }

    fillHoles(zBuffer, nodeIndex, pointIndex, full);
    const light = computeLighting(zBuffer, nodeIndex, full, margin, request);

    const data = new Float32Array(size * size * BAND_COUNT);
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const index = (row + margin) * full + col + margin;
        const n = nodeIndex[index];
        if (n < 0) {
          continue;
        }
        const points = nodes[n];
        const i = pointIndex[index];
        const o = (row * size + col) * BAND_COUNT;
        data[o] = points.z[i];
        data[o + 1] = points.intensity[i];
        data[o + 2] = points.classification[i];
        if (points.rgb) {
          data[o + 3] = points.rgb[i * 3];
          data[o + 4] = points.rgb[i * 3 + 1];
          data[o + 5] = points.rgb[i * 3 + 2];
        }
        data[o + 6] = light[row * size + col];
        data[o + 7] = 1;
      }
    }
    return data;
  }
}

/**
 * Computes the lighting (hillshade, cast shadows and ambient occlusion) of the
 * tile without the margin from the elevations.
 * @param {Float32Array} zBuffer The elevations.
 * @param {Int32Array} nodeIndex The node index per pixel (-1 if empty).
 * @param {number} full The width and height including the margin.
 * @param {number} margin The margin in pixels.
 * @param {TileRequest} request The tile request.
 * @return {Float32Array} The lighting (0-1) per pixel.
 */
function computeLighting(zBuffer, nodeIndex, full, margin, request) {
  const size = request.size;
  // Elevation units per pixel, exaggerated
  const pixel =
    (request.resolution * request.unitScale) / request.shadeExaggeration;
  const azimuth = (request.sunAzimuth * Math.PI) / 180;
  const altitude = (request.sunAltitude * Math.PI) / 180;
  const sunX = Math.sin(azimuth) * Math.cos(altitude);
  const sunY = Math.cos(azimuth) * Math.cos(altitude);
  const sunZ = Math.sin(altitude);
  const tanAltitude = Math.tan(altitude);
  // Towards the sun in pixels, rows grow southwards
  const stepCol = Math.sin(azimuth);
  const stepRow = -Math.cos(azimuth);
  const occlusionSteps = [1, 2, 3, 5, 8, 12, 16, 24, 32].filter(
    (step) => step <= request.occlusionRadius,
  );
  const directions = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ].map(([dc, dr]) => [dc, dr, Math.hypot(dc, dr)]);

  const zAt = (row, col, fallback) => {
    const index = row * full + col;
    return nodeIndex[index] < 0 ? fallback : zBuffer[index];
  };

  const light = new Float32Array(size * size);
  for (let row = margin; row < margin + size; row++) {
    for (let col = margin; col < margin + size; col++) {
      const index = row * full + col;
      if (nodeIndex[index] < 0) {
        continue;
      }
      const z = zBuffer[index];

      const dzdx = (zAt(row, col + 1, z) - zAt(row, col - 1, z)) / (2 * pixel);
      const dzdy = (zAt(row - 1, col, z) - zAt(row + 1, col, z)) / (2 * pixel);
      let direct = Math.max(
        0,
        (sunZ - dzdx * sunX - dzdy * sunY) /
          Math.sqrt(1 + dzdx * dzdx + dzdy * dzdy),
      );

      if (direct > 0) {
        for (let t = 1; t <= request.shadowLength; t += t < 8 ? 1 : t >> 3) {
          const r = Math.round(row + stepRow * t);
          const c = Math.round(col + stepCol * t);
          if (r < 0 || c < 0 || r >= full || c >= full) {
            break;
          }
          if (zAt(r, c, -Infinity) - z > t * pixel * tanAltitude) {
            direct *= 0.35;
            break;
          }
        }
      }

      let occlusion = 0;
      if (occlusionSteps.length > 0) {
        for (const [dc, dr, length] of directions) {
          let horizon = 0;
          for (const step of occlusionSteps) {
            const r = row + dr * step;
            const c = col + dc * step;
            if (r < 0 || c < 0 || r >= full || c >= full) {
              break;
            }
            const slope = (zAt(r, c, z) - z) / (step * length * pixel);
            if (slope > horizon) {
              horizon = slope;
            }
          }
          // Sine of the horizon angle
          occlusion += horizon / Math.sqrt(1 + horizon * horizon);
        }
        occlusion /= directions.length;
      }

      light[(row - margin) * size + col - margin] =
        (0.35 + 0.65 * direct) * (1 - 0.8 * occlusion);
    }
  }
  return light;
}

/**
 * Fills empty pixels that are mostly surrounded by points with the highest neighbor.
 * @param {Float32Array} zBuffer The elevations.
 * @param {Int32Array} nodeIndex The node index per pixel (-1 if empty).
 * @param {Int32Array} pointIndex The point index per pixel.
 * @param {number} size The width and height.
 */
function fillHoles(zBuffer, nodeIndex, pointIndex, size) {
  const sourceZ = zBuffer.slice();
  const sourceNode = nodeIndex.slice();
  const sourcePoint = pointIndex.slice();
  for (let row = 1; row < size - 1; row++) {
    for (let col = 1; col < size - 1; col++) {
      const index = row * size + col;
      if (sourceNode[index] >= 0) {
        continue;
      }
      let filled = 0;
      let best = -1;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const neighbor = index + dr * size + dc;
          if (sourceNode[neighbor] < 0) {
            continue;
          }
          filled++;
          if (best < 0 || sourceZ[neighbor] > sourceZ[best]) {
            best = neighbor;
          }
        }
      }
      if (filled >= 4) {
        zBuffer[index] = sourceZ[best];
        nodeIndex[index] = sourceNode[best];
        pointIndex[index] = sourcePoint[best];
      }
    }
  }
}

export default COPCTileRenderer;

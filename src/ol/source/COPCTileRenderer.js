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
 * @property {number} shadeExaggeration The vertical exaggeration for the hillshade.
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
            const index = r * full + c;
            if (pz > zBuffer[index]) {
              zBuffer[index] = pz;
              nodeIndex[index] = n;
              pointIndex[index] = i;
            }
          }
        }
      }
    }

    fillHoles(zBuffer, nodeIndex, pointIndex, full);

    const data = new Float32Array(size * size * BAND_COUNT);
    // 315° azimuth, 45° altitude
    const sunX = -Math.SQRT1_2 * Math.SQRT1_2;
    const sunY = Math.SQRT1_2 * Math.SQRT1_2;
    const sunZ = Math.SQRT1_2;
    const scale = request.shadeExaggeration / (2 * resolution);
    const zAt = (index, fallback) =>
      nodeIndex[index] < 0 ? fallback : zBuffer[index];
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const index = (row + margin) * full + col + margin;
        const n = nodeIndex[index];
        if (n < 0) {
          continue;
        }
        const points = nodes[n];
        const i = pointIndex[index];
        const pz = zBuffer[index];
        const dzdx = (zAt(index + 1, pz) - zAt(index - 1, pz)) * scale;
        const dzdy = (zAt(index - full, pz) - zAt(index + full, pz)) * scale;
        const shade =
          (sunZ - dzdx * sunX - dzdy * sunY) /
          Math.sqrt(1 + dzdx * dzdx + dzdy * dzdy);

        const o = (row * size + col) * BAND_COUNT;
        data[o] = pz;
        data[o + 1] = points.intensity[i];
        data[o + 2] = points.classification[i];
        if (points.rgb) {
          data[o + 3] = points.rgb[i * 3];
          data[o + 4] = points.rgb[i * 3 + 1];
          data[o + 5] = points.rgb[i * 3 + 2];
        }
        data[o + 6] = Math.max(0, shade);
        data[o + 7] = 1;
      }
    }
    return data;
  }
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

/**
 * @module ol/source/COPC
 */
import {Copc} from 'copc';
import DataTileSource from 'ol/source/DataTile.js';
import TileGrid from 'ol/tilegrid/TileGrid.js';
import {registerProjection} from '../proj.js';
import COPCBand from './COPCBand.js';
import {BAND_COUNT, createRangeGetter, hasColors} from './COPCTileRenderer.js';

/**
 * The default location of the LAZ decompressor (WebAssembly).
 * @type {string}
 */
export const LAZ_PERF_WASM_URL =
  'https://cdn.jsdelivr.net/npm/laz-perf@0.0.7/lib/web/laz-perf.wasm';

export {COPCBand};

/**
 * @typedef {Object} Options
 * @property {string} url The URL of the COPC file. The server must support HTTP range requests.
 * @property {Object<string, string>} [headers] Additional headers for the requests.
 * @property {import("ol/proj.js").ProjectionLike} [projection] The projection of the point cloud.
 * Read from the WKT in the file by default.
 * @property {import("ol/source/Source.js").AttributionLike} [attributions] Attributions.
 * @property {number} [tileSize=256] The tile size in pixels.
 * @property {number} [pointSize=1] The minimum size of a point in pixels.
 * Points get larger when zooming in beyond the density of the point cloud.
 * @property {number} [shadeExaggeration=1] The vertical exaggeration for the lighting.
 * @property {number} [sunAzimuth=315] The azimuth of the sun in degrees (clockwise from north).
 * @property {number} [sunAltitude=45] The altitude of the sun in degrees.
 * @property {boolean} [shadows=true] Whether points cast shadows.
 * @property {boolean} [ambientOcclusion=true] Whether points are darkened by higher points around them.
 * @property {number} [maxCachedPoints=10000000] The maximum number of decoded points kept in memory.
 * @property {number} [workers] The number of web workers that decode and render the points.
 * Defaults to the number of logical processors minus one (1 to 4). Set to 0 to work on the main thread.
 * @property {string} [wasmUrl] The URL of the LAZ decompressor (`laz-perf.wasm`), see {@link LAZ_PERF_WASM_URL}.
 * @property {number} [transition] Transition time when fading in new tiles (in milliseconds).
 */

/**
 * @typedef {Object} PendingRequest
 * @property {import("./COPCTileRenderer.js").TileRequest} request The tile request.
 * @property {AbortSignal} [signal] The abort signal.
 * @property {function(Float32Array): void} resolve Resolves the request.
 * @property {function(Error): void} reject Rejects the request.
 */

/**
 * Returns the horizontal part of a compound coordinate reference system,
 * as proj4 can't parse compound reference systems.
 * @param {string} wkt WKT1 or WKT2
 * @return {string} The horizontal reference system.
 */
export function getHorizontalWkt(wkt) {
  wkt = wkt.trim();
  if (!/^(COMPD_CS|COMPOUNDCRS)\s*\[/i.test(wkt)) {
    return wkt;
  }
  const match = /(PROJCS|PROJCRS|GEOGCS|GEOGCRS|GEODCRS)\s*\[/i.exec(
    wkt.substring(1),
  );
  if (!match) {
    return wkt;
  }
  const start = match.index + 1;
  let depth = 0;
  for (let i = start; i < wkt.length; i++) {
    if (wkt[i] === '[') {
      depth++;
    } else if (wkt[i] === ']' && --depth === 0) {
      return wkt.substring(start, i + 1);
    }
  }
  return wkt;
}

/**
 * @classdesc
 * A source for Cloud Optimized Point Clouds (COPC).
 * The points are rendered top-down into data tiles (see {@link COPCBand} for the bands),
 * which can be styled with a WebGL tile layer.
 * Decoding and rendering happens in web workers.
 * @api
 */
class COPCSource extends DataTileSource {
  /**
   * @param {Options} options COPC source options.
   */
  constructor(options) {
    super({
      attributions: options.attributions,
      state: 'loading',
      tileGrid: undefined,
      projection: options.projection || null,
      transition: options.transition,
      interpolate: false,
      wrapX: false,
      bandCount: BAND_COUNT,
      hasAlpha: true,
    });

    /**
     * @type {number}
     * @private
     */
    this.size_ = options.tileSize || 256;

    /**
     * @type {number}
     * @private
     */
    this.pointSize_ = options.pointSize || 1;

    /**
     * @type {number}
     * @private
     */
    this.shadeExaggeration_ =
      options.shadeExaggeration === undefined ? 1 : options.shadeExaggeration;

    /**
     * @type {number}
     * @private
     */
    this.sunAzimuth_ =
      options.sunAzimuth === undefined ? 315 : options.sunAzimuth;

    /**
     * @type {number}
     * @private
     */
    this.sunAltitude_ =
      options.sunAltitude === undefined ? 45 : options.sunAltitude;

    /**
     * @type {boolean}
     * @private
     */
    this.shadows_ = options.shadows !== false;

    /**
     * @type {boolean}
     * @private
     */
    this.ambientOcclusion_ = options.ambientOcclusion !== false;

    /**
     * The size of a horizontal unit in elevation units.
     * @type {number}
     * @private
     */
    this.unitScale_ = 1;

    /**
     * @type {function(number, number): Promise<Uint8Array>}
     * @private
     */
    this.getter_ = createRangeGetter(options.url, options.headers);

    /**
     * @type {import("copc").Copc|null}
     * @private
     */
    this.copc_ = null;

    /**
     * @type {Object<string, import("copc").Hierarchy.Node|undefined>}
     * @private
     */
    this.nodes_ = {};

    /**
     * @type {Object<string, import("copc").Hierarchy.Page|undefined>}
     * @private
     */
    this.pages_ = {};

    /**
     * @type {Object<string, Promise<void>>}
     * @private
     */
    this.pageRequests_ = {};

    /**
     * @type {number}
     * @private
     */
    this.maxDepth_ = 0;

    /**
     * @type {Array<Worker>}
     * @private
     */
    this.workers_ = [];

    /**
     * @type {Map<number, PendingRequest>}
     * @private
     */
    this.pending_ = new Map();

    /**
     * @type {number}
     * @private
     */
    this.requestId_ = 0;

    /**
     * Renders on the main thread if no workers are available.
     * @type {Promise<import("./COPCTileRenderer.js").default>|null}
     * @private
     */
    this.localRenderer_ = null;

    /**
     * @type {import("./COPCTileRenderer.js").Options|null}
     * @private
     */
    this.rendererOptions_ = null;

    /**
     * @type {Error|null}
     * @private
     */
    this.error_ = null;

    this.init_(options)
      .then(() => {
        this.setLoader(this.loadTile_.bind(this));
        this.setState('ready');
      })
      .catch((error) => {
        this.error_ = error;
        this.setState('error');
      });
  }

  /**
   * @param {Options} options The options.
   * @private
   */
  async init_(options) {
    const copc = await Copc.create(this.getter_);
    this.copc_ = copc;
    this.addHierarchy_(
      await Copc.loadHierarchyPage(this.getter_, copc.info.rootHierarchyPage),
    );

    if (!this.projection) {
      if (!copc.wkt) {
        throw new Error(
          'The point cloud does not specify a coordinate reference system',
        );
      }
      this.projection = await registerProjection(
        getHorizontalWkt(copc.wkt),
        'wkt2',
      );
    }

    const projection = this.getProjection();
    // Assumes metric elevations for geographic coordinates
    if (projection.getUnits() === 'degrees') {
      this.unitScale_ = projection.getMetersPerUnit();
    }

    const cube = copc.info.cube;
    const {min, max} = copc.header;
    const maxResolution = (cube[3] - cube[0]) / this.size_;
    // Deeper levels may be in hierarchy pages that are not loaded yet
    const maxDepth =
      this.maxDepth_ + (Object.keys(this.pages_).length > 0 ? 4 : 0);
    const minResolution = copc.info.spacing / Math.pow(2, maxDepth) / 4;
    const resolutions = [maxResolution];
    while (
      resolutions[resolutions.length - 1] > minResolution &&
      resolutions.length < 30
    ) {
      resolutions.push(resolutions[resolutions.length - 1] / 2);
    }
    this.tileGrid = new TileGrid({
      extent: [min[0], min[1], max[0], max[1]],
      origin: [cube[0], cube[4]],
      resolutions,
      tileSize: this.size_,
    });

    let workers = options.workers;
    if (workers === undefined) {
      const cores =
        typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 2;
      workers = Math.max(1, Math.min(4, (cores || 2) - 1));
    }
    if (typeof Worker === 'undefined') {
      workers = 0;
    }
    const maxCachedPoints = options.maxCachedPoints || 10000000;
    this.rendererOptions_ = {
      url: options.url,
      headers: options.headers,
      copc,
      wasmUrl: options.wasmUrl || LAZ_PERF_WASM_URL,
      maxCachedPoints: Math.ceil(maxCachedPoints / Math.max(1, workers)),
    };
    for (let i = 0; i < workers; i++) {
      if (!this.createWorker_()) {
        this.fallBack_();
        break;
      }
    }
  }

  /**
   * @return {boolean} `true` if the worker was created.
   * @private
   */
  createWorker_() {
    let worker;
    try {
      // @ts-ignore import.meta is fine, only the type check targets CommonJS
      worker = new Worker(new URL('../worker/COPC.js', import.meta.url), {
        type: 'module',
      });
    } catch {
      return false;
    }
    worker.onmessage = (event) => {
      const {id, data, error} = event.data;
      const pending = this.pending_.get(id);
      if (!pending) {
        return;
      }
      this.pending_.delete(id);
      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(data);
      }
    };
    // Fails if the worker can't be loaded, e.g. due to the bundler setup
    worker.onerror = () => this.fallBack_();
    worker.postMessage({type: 'init', options: this.rendererOptions_});
    this.workers_.push(worker);
    return true;
  }

  /**
   * Continues on the main thread.
   * @private
   */
  fallBack_() {
    this.terminateWorkers_();
    const pending = Array.from(this.pending_.values());
    this.pending_.clear();
    for (const {request, signal, resolve, reject} of pending) {
      this.renderLocally_(request, signal).then(resolve, reject);
    }
  }

  /**
   * @private
   */
  terminateWorkers_() {
    this.workers_.forEach((worker) => worker.terminate());
    this.workers_ = [];
  }

  /**
   * @param {import("./COPCTileRenderer.js").TileRequest} request The tile request.
   * @param {AbortSignal} [signal] The abort signal.
   * @return {Promise<Float32Array>} The data.
   * @private
   */
  async renderLocally_(request, signal) {
    if (!this.localRenderer_) {
      this.localRenderer_ = import('./COPCTileRenderer.js').then(
        (module) => new module.default(this.rendererOptions_),
      );
    }
    const renderer = await this.localRenderer_;
    return renderer.render(request, () => Boolean(signal && signal.aborted));
  }

  /**
   * @param {import("./COPCTileRenderer.js").TileRequest} request The tile request.
   * @param {number} affinity Requests with the same affinity go to the same worker to reuse its cache.
   * @param {AbortSignal} [signal] The abort signal.
   * @return {Promise<Float32Array>} The data.
   * @private
   */
  render_(request, affinity, signal) {
    if (this.workers_.length === 0) {
      return this.renderLocally_(request, signal);
    }
    const worker = this.workers_[affinity % this.workers_.length];
    const id = ++this.requestId_;
    return new Promise((resolve, reject) => {
      this.pending_.set(id, {request, signal, resolve, reject});
      if (signal) {
        signal.addEventListener('abort', () => {
          if (this.pending_.has(id)) {
            worker.postMessage({type: 'abort', id});
          }
        });
      }
      worker.postMessage({type: 'render', id, request});
    });
  }

  /**
   * @return {Error|null} The error, if the source failed to load.
   * @api
   */
  getError() {
    return this.error_;
  }

  /**
   * @return {import("copc").Copc|null} The COPC metadata (header, VLRs, info), once loaded.
   * @api
   */
  getMetadata() {
    return this.copc_;
  }

  /**
   * @return {boolean} Whether the points have colors.
   * @api
   */
  hasColors() {
    return this.copc_ !== null && hasColors(this.copc_);
  }

  /**
   * @return {Array<number>|null} The [min, max] range of the elevations.
   * @api
   */
  getElevationRange() {
    if (!this.copc_) {
      return null;
    }
    return [this.copc_.header.min[2], this.copc_.header.max[2]];
  }

  /**
   * @param {import("copc").Hierarchy.Subtree} subtree The hierarchy subtree.
   * @private
   */
  addHierarchy_(subtree) {
    Object.assign(this.nodes_, subtree.nodes);
    Object.assign(this.pages_, subtree.pages);
    for (const key in subtree.nodes) {
      this.maxDepth_ = Math.max(this.maxDepth_, parseInt(key, 10));
    }
  }

  /**
   * @param {string} key The node key.
   * @return {Promise<void>} Resolves once the page is loaded.
   * @private
   */
  loadPage_(key) {
    if (!this.pageRequests_[key]) {
      this.pageRequests_[key] = Copc.loadHierarchyPage(
        this.getter_,
        this.pages_[key],
      ).then((subtree) => this.addHierarchy_(subtree));
    }
    return this.pageRequests_[key];
  }

  /**
   * Finds the octree nodes up to the given depth that intersect the extent.
   * @param {import("ol/extent.js").Extent} extent The extent.
   * @param {number} maxDepth The maximum depth.
   * @return {Promise<Array<string>>} The node keys.
   * @private
   */
  async findNodes_(extent, maxDepth) {
    const cube = this.copc_.info.cube;
    const width = cube[3] - cube[0];
    const keys = [];
    const visit = async (d, x, y, z) => {
      const key = `${d}-${x}-${y}-${z}`;
      if (!this.nodes_[key] && this.pages_[key]) {
        await this.loadPage_(key);
      }
      if (!this.nodes_[key]) {
        return;
      }
      const size = width / Math.pow(2, d);
      const minX = cube[0] + x * size;
      const minY = cube[1] + y * size;
      if (
        minX > extent[2] ||
        minX + size < extent[0] ||
        minY > extent[3] ||
        minY + size < extent[1]
      ) {
        return;
      }
      if (this.nodes_[key].pointCount > 0) {
        keys.push(key);
      }
      if (d >= maxDepth) {
        return;
      }
      const children = [];
      for (let i = 0; i < 8; i++) {
        children.push(
          visit(
            d + 1,
            x * 2 + (i & 1),
            y * 2 + ((i >> 1) & 1),
            z * 2 + ((i >> 2) & 1),
          ),
        );
      }
      await Promise.all(children);
    };
    await visit(0, 0, 0, 0);
    return keys;
  }

  /**
   * @param {number} z The tile zoom level.
   * @param {number} x The tile column.
   * @param {number} y The tile row.
   * @param {import("ol/source/DataTile.js").LoaderOptions} [options] The loader options.
   * @return {Promise<Float32Array>} The data.
   * @private
   */
  async loadTile_(z, x, y, options) {
    const resolution = this.tileGrid.getResolution(z);
    const extent = this.tileGrid.getTileCoordExtent([z, x, y]);
    const cube = this.copc_.info.cube;
    const spacing = this.copc_.info.spacing;
    const depth = Math.max(0, Math.ceil(Math.log2(spacing / resolution)));

    const {min, max} = this.copc_.header;
    const pixel = (resolution * this.unitScale_) / this.shadeExaggeration_;
    const shadowLength = this.shadows_
      ? Math.min(
          32,
          Math.ceil(
            (max[2] - min[2]) /
              (pixel * Math.tan((this.sunAltitude_ * Math.PI) / 180)),
          ),
        )
      : 0;
    const occlusionRadius = this.ambientOcclusion_ ? 8 : 0;

    // The margin prevents seams in the splats and the lighting
    const maxSplat = Math.max(
      this.pointSize_,
      Math.ceil(spacing / Math.pow(2, this.maxDepth_) / resolution),
    );
    const margin = Math.max(maxSplat, shadowLength, occlusionRadius) + 1;
    const buffered = [
      extent[0] - margin * resolution,
      extent[1] - margin * resolution,
      extent[2] + margin * resolution,
      extent[3] + margin * resolution,
    ];

    const keys = await this.findNodes_(buffered, depth);

    // Tiles in the same deepest node share most of their points
    const nodeSize =
      (cube[3] - cube[0]) / Math.pow(2, Math.min(depth, this.maxDepth_));
    const nodeX = Math.floor((extent[0] + extent[2]) / 2 / nodeSize);
    const nodeY = Math.floor((extent[1] + extent[3]) / 2 / nodeSize);
    const affinity = Math.abs((nodeX * 73856093) ^ (nodeY * 19349663));

    return this.render_(
      {
        nodes: keys.map((key) => ({key, node: this.nodes_[key]})),
        extent: buffered,
        resolution,
        size: this.size_,
        margin,
        pointSize: this.pointSize_,
        shadeExaggeration: this.shadeExaggeration_,
        unitScale: this.unitScale_,
        sunAzimuth: this.sunAzimuth_,
        sunAltitude: this.sunAltitude_,
        shadowLength,
        occlusionRadius,
      },
      affinity,
      options && options.signal,
    );
  }

  /**
   * @override
   */
  disposeInternal() {
    this.terminateWorkers_();
    this.pending_.forEach(({reject}) => reject(new Error('Disposed')));
    this.pending_.clear();
    super.disposeInternal();
  }
}

export default COPCSource;

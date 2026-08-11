/**
 * @module ol-stac/source/GeoZarr
 */

import {warn} from 'ol/console.js';
import {getCenter} from 'ol/extent.js';
import {register as registerProj4} from 'ol/proj/proj4.js';
import {get as getProjection, toUserCoordinate, toUserExtent} from 'ol/proj.js';
import {toSize} from 'ol/size.js';
import DataTileSource from 'ol/source/DataTile.js';
import {parseTileMatrixSet} from 'ol/source/ogcTileUtil.js';
import WMTSTileGrid from 'ol/tilegrid/WMTS.js';
import proj4 from 'proj4';
import {FetchStore, get, open, slice, withRangeCoalescing} from 'zarrita';

const REQUIRED_ZARR_CONVENTIONS = [
  'd35379db-88df-4056-af3a-620245f8e347', // multiscales
  'f17cb550-5864-4468-aeb7-f3180cfb622f', // proj:
  '689b58e2-cf7b-45e0-9fff-9cfc0883d6b4', // spatial:
];

/**
 * @typedef {'nearest'|'linear'} ResampleMethod
 */

/**
 * @typedef {Object} Band
 * @property {string} name The band name.
 * @property {string} group The group path relative to the `url`, containing this band
 * (e.g. `'measurements/reflectance'`).
 */

/**
 * @typedef {Object} GeoZarrStoreOptions
 * @property {Object<string, string>} [headers] additional key-value pairs of headers to be passed with each request. Key is the header name, value the header value.
 * @property {string} [credentials] How credentials shall be handled. See
 * https://developer.mozilla.org/en-US/docs/Web/API/fetch for reference and possible values
 */

/**
 * @typedef {Object} Options
 * @property {string} url When `bands` contains plain strings, this must be the full URL to the
 * multiscales group (e.g. `'https://example.com/store.zarr/measurements/reflectance'`).
 * When `bands` contains {@link Band} objects, this is the base URL from which each band's
 * `group` path is resolved (e.g. `'https://example.com/store.zarr/satellite/sentinel2'`).
 * When `variable` is given, this is the URL of the group that contains the (multiscale)
 * datacube (e.g. `'https://example.com/store.zarr'`).
 * @property {Array<string|Band>} [bands] The bands to render, for stores where each band is
 * a separate (2-dimensional) array.  Each entry is either a band name string (single-group
 * mode) or a {@link Band} object specifying both the band name and the group it belongs to
 * (multi-group mode).  In multi-group mode, the first band's group determines the tile grid
 * and must follow at least the proj: and spatial: conventions.
 * If it also has a multiscales layout (all three conventions), multiple resolution levels are
 * supported.  Otherwise a single-resolution tile grid is derived from `spatial:bbox`,
 * `proj:code`, and `spatial:shape` (or the array shape from consolidated metadata).
 * Bands from additional groups do not need to follow any convention; they can be multi-scale
 * (array located at `<matrixId>/<bandName>`) or single-scale (array at the group root).
 * Mutually exclusive with `variable`.
 * @property {string} [variable] The name of an n-dimensional data array (variable) to render,
 * for stores where all bands are packed into a single array (e.g. a `(time, band, y, x)`
 * datacube).  The array must exist within each multiscale level group (or at the group root
 * for single-scale stores).  Non-spatial dimensions are fixed with `selector`.
 * Mutually exclusive with `bands`.
 * @property {Object<string, number|string|Array<number|string>>} [selector] For `variable`
 * mode: how to slice each non-spatial dimension, keyed by dimension name (from the array's
 * `dimension_names`).  Values are 0-based indices (number), coordinate labels (string), or an
 * array of these.  At most one dimension may map to an array; its entries are rendered as
 * separate bands (in the given order).  Unlisted non-spatial dimensions default to index 0.
 * Labels are resolved against the dimension's coordinate array; if that array cannot be read
 * (e.g. an unsupported string encoding), pass indices instead.
 * @property {GeoZarrStoreOptions} [storeOptions] Additional options to be passed to
 * [zarrita](https://zarrita.dev/)'s `FetchStore` with each request to the Zarr store.
 * @property {import("ol/extent.js").Extent} [extent] Fallback extent of the data, in
 * coordinates of the source projection.  Only used when the store neither declares its
 * extent (`spatial:bbox` or `bounds` attributes) nor has coordinate arrays to infer it from.
 * @property {boolean} [flipY] Fallback orientation: set to `true` when the data is stored
 * south-up (ascending y).  Only used when the orientation can neither be read from the
 * store metadata nor inferred from its coordinate arrays.
 * @property {import("ol/proj.js").ProjectionLike} [projection] Source projection.  If not provided, the GeoZarr metadata
 * will be read for projection information.
 * @property {number} [transition=250] Duration of the opacity transition for rendering.
 * To disable the opacity transition, pass `transition: 0`.
 * @property {boolean} [wrapX=false] Render tiles beyond the tile grid extent.
 * @property {ResampleMethod} [resample='nearest'] Resampling method if bands are not available for all multi-scale levels.
 */

/**
 * Source for GeoZarr stores conforming to the following conventions:
 * - [Zarr multiscales convention](https://github.com/zarr-conventions/multiscales)
 * - [Geospatial projection convention](https://github.com/zarr-conventions/geo-proj)
 * - [Spatial convention](https://github.com/zarr-conventions/spatial)
 *
 * When all three conventions are present, multiple resolution levels are supported.
 * When only proj: and spatial: are present, a single-resolution tile grid is derived
 * from `spatial:bbox`, `proj:code`, and `spatial:shape`.
 * The legacy `tile_matrix_set` attribute is also supported, as is the GeoZarr-style
 * `multiscales` array attribute (`[{tile_matrix_set, datasets: [{path, factor, ...}]}]`).
 *
 * Two data layouts are supported:
 * - One array per band (`bands` option), addressed by name at `<matrixId>/<bandName>`
 *   (multi-scale) or at the group root (single-scale).
 * - A single n-dimensional data array shared by all bands (`variable` + `selector`
 *   options), e.g. a `(time, band, y, x)` datacube with multiscale level groups.
 */
export default class GeoZarr extends DataTileSource {
  /**
   * @param {Options} options The options.
   */
  constructor(options) {
    super({
      state: 'loading',
      tileGrid: null,
      projection: options.projection || null,
      transition: options.transition,
      wrapX: options.wrapX,
    });

    /**
     * @type {string}
     * @private
     */
    this.url_ = options.url;

    /**
     * @type {GeoZarrStoreOptions|undefined}
     * @private
     */
    this.storeOptions_ = options.storeOptions;

    /**
     * @type {import("ol/extent.js").Extent|undefined}
     * @private
     */
    this.fallbackExtent_ = options.extent;

    /**
     * @type {boolean|undefined}
     * @private
     */
    this.fallbackFlipY_ = options.flipY;

    /**
     * The zarrita open function to use, pinned to v2 when the store cannot
     * be probed for v3 metadata (e.g. S3 buckets answering 403 for missing
     * keys).
     * @type {Function}
     * @private
     */
    this.openFn_ = open;

    /**
     * @type {Error|null}
     */
    this.error_ = null;

    /**
     * @type {Array<import('zarrita').Group<any>>}
     * @private
     */
    this.groups_ = [];

    /**
     * @type {any|null}
     * @private
     */
    this.consolidatedMetadata_ = null;

    /**
     * Cache of opened zarrita arrays keyed by path. Caching the Promise
     * (not the resolved value) deduplicates concurrent opens for the same
     * array path across tiles at the same zoom level.
     * @private
     * @type {Map<string, Promise<import('zarrita').Array<import('zarrita').DataType, any>>>}
     */
    this.arrayCache_ = new Map();

    /**
     * Name of the n-dimensional data array to render (datacube mode).
     * @type {string|null}
     * @private
     */
    this.variable_ = options.variable || null;

    /**
     * @type {Object<string, number|string|Array<number|string>>}
     * @private
     */
    this.selector_ = options.selector || {};

    if (this.variable_ && Array.isArray(options.bands)) {
      throw new Error(
        'The `bands` and `variable` options are mutually exclusive',
      );
    }

    const groupOrder = /** @type {Array<string>} */ ([]);
    const bandGroupIndex = /** @type {Array<number>} */ ([]);
    const bands = (options.bands || []).map((b) => {
      if (typeof b === 'string') {
        bandGroupIndex.push(0);
        return b;
      }
      let gi = groupOrder.indexOf(b.group);
      if (gi === -1) {
        gi = groupOrder.length;
        groupOrder.push(b.group);
      }
      bandGroupIndex.push(gi);
      return b.name;
    });

    /**
     * @type {Array<string>|undefined}
     * @private
     */
    this.groupPaths_ = groupOrder.length > 0 ? groupOrder : undefined;

    /**
     * Maps each band index to the index of the group it belongs to in `this.groups_`.
     * @type {Array<number>}
     * @private
     */
    this.bandGroupIndex_ = bandGroupIndex;

    /**
     * Pixel resolution for single-scale bands.  When set, indicates that the
     * band lives directly at its group root (no matrixId subdirectory) and
     * provides the pixel resolution to use for coordinate calculations.
     * Undefined for multi-scale bands.
     * @type {Array<number|undefined>}
     * @private
     */
    this.bandSingleScaleResolution_ = new Array(bands.length).fill(undefined);

    /**
     * @type {Array<string>}
     * @private
     */
    this.bands_ = bands;

    /**
     * @type {Object<string, Array<string>> | null}
     * @private
     */
    this.bandsByLevel_ = null;

    /**
     * Multiscale levels for datacube mode, ordered like the tile grid
     * (coarse to fine follows the tile grid's z order).
     * @type {Array<{arrayPath: string, shapeY: number|undefined}>|null}
     * @private
     */
    this.levels_ = null;

    /**
     * Whether the data is stored south-up (ascending y coordinates) and
     * rows must be flipped when reading.
     * @type {boolean}
     * @private
     */
    this.flipY_ = false;

    /**
     * Dimension names of the data array in datacube mode.
     * @type {Array<string>|null}
     * @private
     */
    this.dimensionNames_ = null;

    /**
     * @type {number}
     * @private
     */
    this.yDimIndex_ = 0;

    /**
     * @type {number}
     * @private
     */
    this.xDimIndex_ = 1;

    /**
     * Resolved selector for each non-spatial dimension of the data array
     * (datacube mode), in dimension order.
     * @type {Array<{dimIndex: number, indices: Array<number>}>}
     * @private
     */
    this.selectorSlots_ = [];

    /**
     * Index in `selectorSlots_` of the dimension that is rendered as
     * multiple bands, or -1 if a single band is rendered.
     * @type {number}
     * @private
     */
    this.multiSlotIndex_ = -1;

    /**
     * @type {number|undefined}
     * @private
     */
    this.fillValue_;

    /**
     * @type {ResampleMethod}
     * @private
     */
    this.resampleMethod_ = options.resample || 'linear';

    let bandCount = this.bands_.length;
    if (this.variable_) {
      bandCount = 1;
      for (const key in this.selector_) {
        const value = this.selector_[key];
        if (Array.isArray(value)) {
          if (bandCount > 1) {
            throw new Error(
              'Only one selector dimension may select multiple values',
            );
          }
          bandCount = value.length;
        }
      }
    }

    /**
     * Number of bands.
     * @type {number}
     */
    this.bandCount = bandCount;

    /**
     * @type {import("ol/tilegrid/WMTS.js").default}
     * @override
     */
    this.tileGrid;

    this.setLoader(this.loadTile_.bind(this));

    this.configure_()
      .then(() => {
        this.setState('ready');
      })
      .catch((err) => {
        this.error_ = err;
        this.setState('error');
      });
  }

  async configure_() {
    const overrides = /** @type {RequestInit} */ (this.storeOptions_) || {};
    const store = /** @type {FetchStore} */ (
      withRangeCoalescing(new FetchStore(this.url_, {overrides}))
    );

    // Fetch group zarr.json once for both opening the group and extracting
    // consolidated metadata. Without this, open() and the manual metadata
    // read would each make a separate HTTP request for the same file.
    const cache = new Map();
    const encoder = new TextEncoder();
    // Some servers (e.g. S3 buckets without list permissions) answer 403
    // instead of 404 for missing keys, which zarrita treats as an error.
    const groupBytes = await store.get('/zarr.json').catch(() => undefined);
    if (groupBytes) {
      cache.set('/zarr.json', groupBytes);
      try {
        this.consolidatedMetadata_ = JSON.parse(
          new TextDecoder().decode(groupBytes),
        ).consolidated_metadata.metadata;
        for (const [key, value] of Object.entries(this.consolidatedMetadata_)) {
          cache.set(`/${key}/zarr.json`, encoder.encode(JSON.stringify(value)));
        }
      } catch {
        // no consolidated metadata
      }
    }
    if (!this.consolidatedMetadata_) {
      // Zarr v2: consolidated metadata lives in .zmetadata
      const v2Bytes = await store.get('/.zmetadata').catch(() => undefined);
      if (v2Bytes) {
        try {
          const v2Metadata = JSON.parse(
            new TextDecoder().decode(v2Bytes),
          ).metadata;
          for (const [key, value] of Object.entries(v2Metadata)) {
            cache.set(`/${key}`, encoder.encode(JSON.stringify(value)));
          }
          this.consolidatedMetadata_ = normalizeV2Metadata(v2Metadata);
        } catch {
          // no consolidated metadata
        }
      }
    }

    // Wrap the store so that child metadata (groups, arrays) is served from
    // the consolidated metadata instead of making per-child HTTP requests,
    // and so that chunks shared by several tiles are only fetched once.
    const cachedStore = createCachedStore(store, cache);

    /**
     * @param {*} source The store or location to open.
     * @return {Promise<import('zarrita').Group<any>>} The opened group.
     */
    const openGroup = async (source) => {
      try {
        return await this.openFn_(source, {kind: 'group'});
      } catch (err) {
        if (this.openFn_ === open) {
          // Retry as Zarr v2 without probing for v3 metadata first, for
          // servers that answer 403 for missing keys.
          const group = await open.v2(source, {kind: 'group'});
          this.openFn_ = open.v2;
          return group;
        }
        throw err;
      }
    };

    const groups = [];
    if (this.groupPaths_) {
      // Multi-group mode: open root, then each sub-group
      const rootGroup = await openGroup(cachedStore);
      for (const groupPath of this.groupPaths_) {
        groups.push(await openGroup(rootGroup.resolve(groupPath)));
      }
    } else {
      // Single group mode
      groups.push(await openGroup(cachedStore));
    }
    this.groups_.push(...groups);

    const attributes =
      /** @type {LegacyDatasetAttributes | DatasetAttributes} */ (
        this.groups_[0].attrs
      );

    if (this.variable_) {
      await this.configureDatacube_(attributes, store);
    } else {
      this.configureBands_(attributes);
    }

    if (this.fillValue_ !== null && this.fillValue_ !== undefined) {
      this.bandCount += 1;
      this.nodataBandIndex = this.bandCount;
    }
    if (!this.tileGrid) {
      throw new Error('Could not determine tile grid');
    }

    const extent = this.tileGrid.getExtent();
    setTimeout(() => {
      this.viewResolver({
        showFullExtent: true,
        projection: this.projection,
        resolutions: this.tileGrid.getResolutions(),
        center: toUserCoordinate(getCenter(extent), this.projection),
        extent: toUserExtent(extent, this.projection),
        zoom: 1,
      });
    });
  }

  /**
   * Configuration for the one-array-per-band layout (`bands` option).
   * @param {LegacyDatasetAttributes | DatasetAttributes} attributes The dataset attributes.
   * @private
   */
  configureBands_(attributes) {
    // For multi-group mode, use sub-metadata for the first group so that
    // consolidated metadata keys match the expected relative paths.
    const consolidatedMetadata =
      this.groupPaths_ && this.consolidatedMetadata_
        ? getSubMetadata(this.consolidatedMetadata_, this.groupPaths_[0])
        : this.consolidatedMetadata_;

    let hasTileSizes = false;
    if (
      'zarr_conventions' in attributes &&
      Array.isArray(attributes.zarr_conventions) &&
      REQUIRED_ZARR_CONVENTIONS.every((uuid) =>
        attributes.zarr_conventions.find((c) => c.uuid === uuid),
      ) &&
      'layout' in attributes.multiscales
    ) {
      const {tileGrid, projection, bandsByLevel, fillValue, tileSizes} =
        getTileGridInfoFromAttributes(
          /** @type {DatasetAttributes} */ (attributes),
          consolidatedMetadata,
          this.bands_,
        );
      this.bandsByLevel_ = bandsByLevel;
      this.tileGrid = tileGrid;
      this.projection = projection;
      this.fillValue_ = fillValue;
      hasTileSizes = !!tileSizes;
    }
    if (
      !hasTileSizes &&
      attributes.multiscales &&
      'tile_matrix_set' in attributes.multiscales
    ) {
      // If available, use tile_matrix_set (legacy attributes) to get a tile grid, because it
      // should provide a better mapping of tiles to zarr chunks.
      const {tileGrid, projection} = getTileGridInfoFromLegacyAttributes(
        /** @type {LegacyDatasetAttributes} */ (attributes),
      );
      this.tileGrid = tileGrid;
      if (!this.projection) {
        // If there were no required zarr conventions, we don't have a projection yet
        this.projection = projection;
      }
    }
    if (!this.tileGrid && 'spatial:bbox' in attributes) {
      // Standalone single-scale group: build tile grid directly from
      // spatial:bbox and spatial:shape (or the array shape from metadata).
      let shape = attributes['spatial:shape'];
      if (!shape && consolidatedMetadata) {
        for (const band of this.bands_) {
          if (consolidatedMetadata[band]?.shape) {
            shape = consolidatedMetadata[band].shape;
            break;
          }
        }
      }
      if (shape) {
        const extent = attributes['spatial:bbox'];
        const resolution = (extent[2] - extent[0]) / shape[1];
        if (!this.projection) {
          this.projection = getProjection(attributes['proj:code']);
        }
        if (consolidatedMetadata) {
          this.bandsByLevel_ = {level0: []};
          for (const band of this.bands_) {
            if (consolidatedMetadata[band]) {
              this.bandsByLevel_['level0'].push(band);
              if (this.fillValue_ === undefined) {
                this.fillValue_ = Number(
                  consolidatedMetadata[band]['fill_value'],
                );
              }
            }
          }
        }
        this.tileGrid = new WMTSTileGrid({
          extent: extent,
          origins: [[extent[0], extent[3]]],
          resolutions: [resolution],
          matrixIds: ['level0'],
        });
        for (let i = 0; i < this.bands_.length; ++i) {
          if (this.bandGroupIndex_[i] === 0) {
            this.bandSingleScaleResolution_[i] = resolution;
          }
        }
      }
    }
    // For multi-group: determine which group owns each band and supplement
    // bandsByLevel with bands from additional groups.
    if (this.groupPaths_ && this.consolidatedMetadata_ && this.bandsByLevel_) {
      this.resolveBandOwnership_();
    }
  }

  /**
   * Configuration for the n-dimensional datacube layout (`variable` option).
   * @param {LegacyDatasetAttributes | DatasetAttributes} attributes The dataset attributes.
   * @param {FetchStore} store The store, for metadata requests not covered by
   * consolidated metadata.
   * @private
   */
  async configureDatacube_(attributes, store) {
    const variable = /** @type {string} */ (this.variable_);
    const consolidatedMetadata = this.consolidatedMetadata_;

    // Collect the multiscale levels. Several dialects are found in the wild:
    // - the GeoZarr-style `multiscales` array with dataset entries
    //   (optionally carrying spatial:transform/spatial:shape per level),
    // - the zarr-conventions `multiscales.layout` object,
    // - the ndpyramid form (array with dataset paths but no transforms).
    // Without any of them, the group itself is the only level.
    const multiscales = attributes.multiscales;
    /** @type {Array<{path: string, transform: Array<number>|undefined, shape: Array<number>|undefined}>} */
    const rawLevels = [];
    /** @type {string|null} */
    let crsHint = null;
    if (
      Array.isArray(multiscales) &&
      multiscales.length > 0 &&
      Array.isArray(multiscales[0].datasets)
    ) {
      for (const dataset of multiscales[0].datasets) {
        const path =
          dataset.path === '.' || !dataset.path
            ? ''
            : String(dataset.path).replace(/\/+$/, '');
        rawLevels.push({
          path,
          transform: dataset['spatial:transform'],
          shape: dataset['spatial:shape'],
        });
        if (!crsHint && typeof dataset['crs'] === 'string') {
          crsHint = dataset['crs'];
        }
      }
    } else if (
      multiscales &&
      Array.isArray(/** @type {Multiscales} */ (multiscales).layout)
    ) {
      for (const entry of /** @type {Multiscales} */ (multiscales).layout) {
        rawLevels.push({
          path: String(entry.asset),
          transform: undefined,
          shape: entry['spatial:shape'],
        });
      }
    } else {
      rawLevels.push({
        path: '',
        transform: attributes['spatial:transform'],
        shape: attributes['spatial:shape'],
      });
    }

    // Resolve the variable's array metadata for each level
    /** @type {Array<{path: string, arrayPath: string, meta: any, transform: Array<number>|undefined, shape: Array<number>|undefined}>} */
    let levels = [];
    for (const raw of rawLevels) {
      const arrayPath = raw.path ? `${raw.path}/${variable}` : variable;
      const meta = consolidatedMetadata
        ? consolidatedMetadata[arrayPath]
        : undefined;
      if (consolidatedMetadata && !meta) {
        warn(`Variable "${variable}" not found at level "${raw.path || '.'}"`);
        continue;
      }
      levels.push({
        path: raw.path,
        arrayPath,
        meta,
        transform: raw.transform,
        shape: raw.shape,
      });
    }
    if (levels.length === 0) {
      throw new Error(`Variable "${variable}" not found in any level`);
    }

    // Determine the dimension layout from any level's array metadata
    // (the layout is the same for all levels).
    let meta = levels.find((level) => level.meta)?.meta;
    if (!meta) {
      meta = await getArrayMeta(store, levels[0].arrayPath);
      levels[0].meta = meta;
    }
    if (!meta || !Array.isArray(meta.shape)) {
      throw new Error(`Could not read metadata for variable "${variable}"`);
    }
    const ndim = meta.shape.length;
    let dimensionNames = meta['dimension_names'];
    if (!dimensionNames && meta.attributes) {
      // Zarr v2 convention used by xarray
      dimensionNames = meta.attributes['_ARRAY_DIMENSIONS'];
    }
    if (!dimensionNames) {
      if (ndim === 2) {
        dimensionNames = ['y', 'x'];
      } else {
        throw new Error(
          `Cannot determine dimension names for variable "${variable}"`,
        );
      }
    }
    this.dimensionNames_ = dimensionNames;

    // Locate the spatial dimensions: from spatial:dimensions if given,
    // otherwise assume the last two dimensions are (y, x).
    let yDimIndex = ndim - 2;
    let xDimIndex = ndim - 1;
    const spatialDims = attributes['spatial:dimensions'];
    if (Array.isArray(spatialDims) && spatialDims.length === 2) {
      const yi = dimensionNames.indexOf(spatialDims[0]);
      const xi = dimensionNames.indexOf(spatialDims[1]);
      if (yi >= 0 && xi >= 0) {
        yDimIndex = yi;
        xDimIndex = xi;
      }
    }
    this.yDimIndex_ = yDimIndex;
    this.xDimIndex_ = xDimIndex;

    // Determine the extent and the y axis orientation. Declared metadata
    // (spatial:bbox, per-level transforms) is authoritative; otherwise both
    // are inferred from the spatial coordinate arrays, like xarray does.
    let extent = attributes['spatial:bbox'] || attributes['bounds'];
    let flipY = false;
    let orientationKnown = false;
    const transform0 = levels[0].transform;
    if (
      extent &&
      Array.isArray(transform0) &&
      transform0.length >= 6 &&
      transform0[4] !== 0
    ) {
      flipY = transform0[4] > 0;
      orientationKnown = true;
    } else {
      // Read the first/last values of the (smallest) level's coordinate
      // arrays. All levels share the same extent.
      let coordLevel = levels[0];
      for (const level of levels) {
        if (
          level.meta &&
          coordLevel.meta &&
          level.meta.shape[xDimIndex] < coordLevel.meta.shape[xDimIndex]
        ) {
          coordLevel = level;
        }
      }
      try {
        const [x0, x1, xCount] = await this.readCoordinateEndpoints_(
          coordLevel.path,
          dimensionNames[xDimIndex],
        );
        const [y0, y1, yCount] = await this.readCoordinateEndpoints_(
          coordLevel.path,
          dimensionNames[yDimIndex],
        );
        flipY = y1 > y0;
        orientationKnown = true;
        if (x1 < x0) {
          warn('Descending x coordinates are not supported.');
        }
        if (!extent) {
          // Coordinates are pixel centers; pad by half a pixel.
          const xResolution = Math.abs(x1 - x0) / (xCount - 1);
          const yResolution = Math.abs(y1 - y0) / (yCount - 1);
          extent = [
            Math.min(x0, x1) - xResolution / 2,
            Math.min(y0, y1) - yResolution / 2,
            Math.max(x0, x1) + xResolution / 2,
            Math.max(y0, y1) + yResolution / 2,
          ];
          // Normalize [0, 360]-style longitudes to [-180, 180]
          if (extent[0] >= 0 && extent[2] > 180 && extent[2] <= 360.001) {
            extent = [extent[0] - 360, extent[1], extent[2] - 360, extent[3]];
          }
        }
      } catch (err) {
        if (!extent && !this.fallbackExtent_) {
          throw new Error(
            `Could not determine the extent of variable "${variable}" ` +
              `from metadata or coordinate arrays: ${err.message}`,
          );
        }
      }
    }
    if (!extent) {
      extent = this.fallbackExtent_;
    }
    if (!orientationKnown && this.fallbackFlipY_ !== undefined) {
      flipY = this.fallbackFlipY_;
    }
    this.flipY_ = flipY;

    // Compute the resolution and origin for each level
    const extentWidth = extent[2] - extent[0];
    /** @type {Array<{path: string, arrayPath: string, meta: any, resolution: number, origin: import("ol/coordinate.js").Coordinate}>} */
    const configured = [];
    for (const level of levels) {
      let resolution;
      let origin;
      if (
        Array.isArray(level.transform) &&
        level.transform.length >= 6 &&
        level.transform[4] < 0
      ) {
        resolution = level.transform[0];
        origin = [level.transform[2], level.transform[5]];
      } else if (Array.isArray(level.shape)) {
        resolution = extentWidth / level.shape[1];
        origin = [extent[0], extent[3]];
      } else if (level.meta && Array.isArray(level.meta.shape)) {
        resolution = extentWidth / level.meta.shape[xDimIndex];
        origin = [extent[0], extent[3]];
      } else {
        warn(`No resolution information for level "${level.path || '.'}"`);
        continue;
      }
      configured.push({
        path: level.path,
        arrayPath: level.arrayPath,
        meta: level.meta,
        resolution,
        origin,
      });
    }
    if (configured.length === 0) {
      throw new Error(`No usable level found for variable "${variable}"`);
    }
    configured.sort((a, b) => b.resolution - a.resolution);
    levels = null; // use `configured` from here on

    if (!this.projection) {
      this.projection = this.inferProjection_(attributes, crsHint, extent);
    }

    // Resolve the selector to indices, in dimension order. Labels are
    // resolved against the finest level's coordinate arrays.
    const finestPath = configured[configured.length - 1].path;
    this.selectorSlots_ = [];
    this.multiSlotIndex_ = -1;
    for (let d = 0; d < ndim; ++d) {
      if (d === yDimIndex || d === xDimIndex) {
        continue;
      }
      const dimName = dimensionNames[d];
      let value = this.selector_[dimName];
      if (value === undefined) {
        warn(
          `No selector value given for dimension "${dimName}", using index 0.`,
        );
        value = 0;
      }
      /** @type {Array<number|string>} */
      let values;
      if (Array.isArray(value)) {
        values = value;
        this.multiSlotIndex_ = this.selectorSlots_.length;
      } else {
        values = [value];
      }
      const indices = [];
      for (const v of values) {
        if (typeof v === 'number') {
          indices.push(v);
        } else {
          indices.push(
            await this.resolveCoordinateLabel_(dimName, v, finestPath),
          );
        }
      }
      this.selectorSlots_.push({dimIndex: d, indices});
    }

    this.fillValue_ = parseFillValue(meta['fill_value']);

    // Derive tile sizes from the shard layout or, for unsharded arrays,
    // from the chunk layout. Aligning tiles to chunks matters: every tile
    // request decodes all chunks it touches, so tiles much smaller than a
    // chunk would decode the same chunk over and over.
    const tileSizes = configured.map((level) => {
      if (!level.meta) {
        return undefined;
      }
      const shardInfo = getShardInfo(level.meta);
      if (shardInfo) {
        return /** @type {import("ol/size.js").Size} */ ([
          getTileSizeForShard(
            shardInfo.shardShape[xDimIndex],
            shardInfo.innerChunkShape[xDimIndex],
          ),
          getTileSizeForShard(
            shardInfo.shardShape[yDimIndex],
            shardInfo.innerChunkShape[yDimIndex],
          ),
        ]);
      }
      const chunkShape = level.meta['chunk_grid']?.configuration?.chunk_shape;
      if (Array.isArray(chunkShape)) {
        return /** @type {import("ol/size.js").Size} */ ([
          getTileSizeForChunk(
            chunkShape[xDimIndex],
            level.meta.shape[xDimIndex],
          ),
          getTileSizeForChunk(
            chunkShape[yDimIndex],
            level.meta.shape[yDimIndex],
          ),
        ]);
      }
      return undefined;
    });
    const hasTileSizes = tileSizes.some((s) => s !== undefined);

    this.levels_ = configured.map((level) => ({
      arrayPath: level.arrayPath,
      shapeY:
        level.meta && Array.isArray(level.meta.shape)
          ? level.meta.shape[yDimIndex]
          : undefined,
    }));
    this.tileGrid = new WMTSTileGrid({
      extent: extent,
      origins: configured.map((level) => level.origin),
      resolutions: configured.map((level) => level.resolution),
      matrixIds: configured.map((level, i) => level.path || String(i)),
      ...(hasTileSizes
        ? {tileSizes: tileSizes.map((s) => s || [256, 256])}
        : {}),
    });
  }

  /**
   * Determine the projection from the dataset metadata: the proj: convention,
   * a CRS hint from the multiscale metadata, xarray-style `spatial_ref` /
   * `proj4` attributes, or (for degree-like extents) EPSG:4326.
   * @param {Object} attributes The dataset attributes.
   * @param {string|null} crsHint A CRS code from the multiscale metadata.
   * @param {import("ol/extent.js").Extent} extent The extent, for the degrees heuristic.
   * @return {import("ol/proj/Projection.js").default} The projection.
   * @private
   */
  inferProjection_(attributes, crsHint, extent) {
    const code =
      attributes['proj:code'] ||
      crsHint ||
      (typeof attributes['spatial_ref'] === 'string' &&
      attributes['spatial_ref'].includes(':')
        ? attributes['spatial_ref']
        : null);
    const definition = attributes['proj4'] || attributes['proj4_params'];
    if (code) {
      let projection = getProjection(code);
      if (projection) {
        return projection;
      }
      if (typeof definition === 'string') {
        // Register the provided proj4 definition under the declared code
        proj4.defs(code, definition);
        registerProj4(proj4);
        projection = getProjection(code);
        if (projection) {
          return projection;
        }
      }
      warn(`Unknown projection "${code}"`);
    }
    if (typeof definition === 'string') {
      const name = `ZARR:${btoa(definition).replace(/=+$/, '')}`;
      if (!proj4.defs(name)) {
        proj4.defs(name, definition);
        registerProj4(proj4);
      }
      const projection = getProjection(name);
      if (projection) {
        return projection;
      }
    }
    if (
      extent &&
      extent[0] >= -360 &&
      extent[2] <= 360.001 &&
      extent[1] >= -90 &&
      extent[3] <= 90
    ) {
      // Extent magnitude suggests degrees
      return getProjection('EPSG:4326');
    }
    throw new Error('Could not determine the projection');
  }

  /**
   * Read the first and last value of a 1-dimensional coordinate array.
   * @param {string} levelPath The level group path ('' for the root).
   * @param {string} dimName The dimension (and coordinate array) name.
   * @return {Promise<Array<number>>} The first value, last value, and length.
   * @private
   */
  async readCoordinateEndpoints_(levelPath, dimName) {
    const path = levelPath ? `${levelPath}/${dimName}` : dimName;
    const array = await this.openCachedArray_(path);
    const length = array.shape[0];
    const first = await get(array, [slice(0, 1)]);
    const last = await get(array, [slice(length - 1, length)]);
    return [Number(first.data[0]), Number(last.data[0]), length];
  }

  /**
   * Resolve a coordinate label to its index by reading the dimension's
   * coordinate array.
   * @param {string} dimName The dimension name.
   * @param {string} label The label to resolve.
   * @param {string} [levelPath] The level group path ('' for the root).
   * @return {Promise<number>} The index of the label.
   * @private
   */
  async resolveCoordinateLabel_(dimName, label, levelPath = '') {
    try {
      const path = levelPath ? `${levelPath}/${dimName}` : dimName;
      const array = await this.openCachedArray_(path);
      const chunk = await get(array, [null]);
      const values = Array.from(chunk.data, (v) => String(v));
      const index = values.indexOf(label);
      if (index < 0) {
        throw new Error(
          `Label not found. Available: ${values.slice(0, 10).join(', ')}`,
        );
      }
      return index;
    } catch (err) {
      throw new Error(
        `Could not resolve label "${label}" for dimension "${dimName}": ` +
          `${err.message} Pass a numeric index instead.`,
      );
    }
  }

  /**
   * @param {string} path The array path relative to the first group.
   * @param {number} groupIndex The index of the group in `this.groups_`.
   * @return {Promise<import('zarrita').Array<import('zarrita').DataType, any>>} The opened array.
   * @private
   */
  openCachedArray_(path, groupIndex = 0) {
    const cacheKey = `${groupIndex}:${path}`;
    if (!this.arrayCache_.has(cacheKey)) {
      this.arrayCache_.set(
        cacheKey,
        this.openFn_(this.groups_[groupIndex].resolve(path), {
          kind: 'array',
        }).catch((err) => {
          this.arrayCache_.delete(cacheKey);
          throw err;
        }),
      );
    }
    return this.arrayCache_.get(cacheKey);
  }

  /**
   * @param {number} z The z tile index.
   * @param {number} x The x tile index.
   * @param {number} y The y tile index.
   * @return {Promise} The composed tile data.
   * @private
   */
  async loadTile_(z, x, y) {
    if (this.variable_) {
      return this.loadDatacubeTile_(z, x, y);
    }
    const resolutions = this.tileGrid.getResolutions();
    const tileResolution = this.tileGrid.getResolution(z);
    const tileExtent = this.tileGrid.getTileCoordExtent([z, x, y]);

    // First pass: resolve band metadata (no async)
    const bandInfos = [];
    for (let i = 0, ii = this.bands_.length; i < ii; ++i) {
      const band = this.bands_[i];
      const groupIndex = this.bandGroupIndex_[i];
      let bandMatrixId;
      let bandResolution;
      let bandZ = 0;

      if (!this.bandsByLevel_) {
        // TODO: remove this if we stop supporting legacy attributes
        bandMatrixId = this.tileGrid.getMatrixId(z);
        bandResolution = tileResolution;
        bandZ = z;
      } else {
        for (
          let candidateZ = 0;
          candidateZ < resolutions.length;
          candidateZ += 1
        ) {
          const candidateResolution = resolutions[candidateZ];
          if (bandMatrixId && candidateResolution < tileResolution) {
            break;
          }
          const candidateMatrixId = this.tileGrid.getMatrixId(candidateZ);
          if (this.bandsByLevel_[candidateMatrixId].includes(band)) {
            bandMatrixId = candidateMatrixId;
            bandResolution = this.tileGrid.getResolution(candidateZ);
            bandZ = candidateZ;
          }
        }
      }

      if (!bandMatrixId || !bandResolution) {
        throw new Error(`Could not find available resolution for band ${band}`);
      }

      const isSingleScale = this.bandSingleScaleResolution_[i] !== undefined;
      // For single-scale bands, use the band's own pixel resolution (derived
      // from array shape or spatial metadata) rather than the tile grid level
      // resolution, which may give wrong pixel coordinates.
      if (isSingleScale) {
        bandResolution = this.bandSingleScaleResolution_[i];
      }

      const origin = this.tileGrid.getOrigin(bandZ);
      const minCol = Math.round((tileExtent[0] - origin[0]) / bandResolution);
      const maxCol = Math.round((tileExtent[2] - origin[0]) / bandResolution);
      const minRow = Math.round((origin[1] - tileExtent[3]) / bandResolution);
      const maxRow = Math.round((origin[1] - tileExtent[1]) / bandResolution);

      bandInfos.push({
        path: isSingleScale ? band : `${bandMatrixId}/${band}`,
        groupIndex,
        minRow,
        maxRow,
        minCol,
        maxCol,
        bandResolution,
      });
    }

    // Open all band arrays in parallel (not sequentially)
    const arrays = await Promise.all(
      bandInfos.map((info) =>
        this.openCachedArray_(info.path, info.groupIndex),
      ),
    );

    // Fire all get() calls synchronously so getRange() calls from all bands
    // land in the same macrotask tick and can be batched together.
    const bandResolutions = bandInfos.map((info) => info.bandResolution);
    const bandChunks = await Promise.all(
      arrays.map((array, i) => {
        const info = bandInfos[i];
        return get(array, [
          slice(info.minRow, info.maxRow),
          slice(info.minCol, info.maxCol),
        ]);
      }),
    );
    const [tileColCount, tileRowCount] = toSize(this.tileGrid.getTileSize(z));
    return composeData(
      bandChunks,
      bandResolutions,
      tileColCount,
      tileRowCount,
      tileResolution,
      this.resampleMethod_,
      this.fillValue_,
    );
  }

  /**
   * Load a tile in datacube mode: slice the n-dimensional data array.
   * @param {number} z The z tile index.
   * @param {number} x The x tile index.
   * @param {number} y The y tile index.
   * @return {Promise} The composed tile data.
   * @private
   */
  async loadDatacubeTile_(z, x, y) {
    const level = this.levels_[z];
    const tileResolution = this.tileGrid.getResolution(z);
    const tileExtent = this.tileGrid.getTileCoordExtent([z, x, y]);
    const origin = this.tileGrid.getOrigin(z);
    const minCol = Math.round((tileExtent[0] - origin[0]) / tileResolution);
    const maxCol = Math.round((tileExtent[2] - origin[0]) / tileResolution);
    const minRow = Math.round((origin[1] - tileExtent[3]) / tileResolution);
    const maxRow = Math.round((origin[1] - tileExtent[1]) / tileResolution);

    const array = await this.openCachedArray_(level.arrayPath);
    const ndim = this.dimensionNames_.length;

    // For south-up data (ascending y coordinates), read the vertically
    // mirrored row range and flip the rows afterwards.
    const flip = this.flipY_ && typeof level.shapeY === 'number';
    const rowStart = flip ? Math.max(0, level.shapeY - maxRow) : minRow;
    const rowEnd = flip ? Math.max(0, level.shapeY - minRow) : maxRow;

    const multiSlot =
      this.multiSlotIndex_ === -1
        ? null
        : this.selectorSlots_[this.multiSlotIndex_];
    const count = multiSlot ? multiSlot.indices.length : 1;

    /**
     * @param {number} bandIndex The index into the multi-valued selector.
     * @return {Array<number|import('zarrita').Slice|null>} The zarrita selection.
     */
    const makeSelection = (bandIndex) => {
      const selection = new Array(ndim).fill(null);
      selection[this.yDimIndex_] = slice(rowStart, rowEnd);
      selection[this.xDimIndex_] = slice(minCol, maxCol);
      for (let s = 0; s < this.selectorSlots_.length; ++s) {
        const slot = this.selectorSlots_[s];
        selection[slot.dimIndex] =
          slot === multiSlot ? slot.indices[bandIndex] : slot.indices[0];
      }
      return selection;
    };

    let chunks;
    const contiguous =
      multiSlot &&
      count > 1 &&
      multiSlot.dimIndex < this.yDimIndex_ &&
      multiSlot.dimIndex < this.xDimIndex_ &&
      multiSlot.indices.every(
        (v, i, indices) => i === 0 || v === indices[i - 1] + 1,
      );
    if (contiguous) {
      // All bands live in one contiguous slab of the array leading the
      // spatial dimensions; read them in a single request and split.
      const selection = makeSelection(0);
      selection[multiSlot.dimIndex] = slice(
        multiSlot.indices[0],
        multiSlot.indices[count - 1] + 1,
      );
      const slab = await get(array, selection);
      const [bandCount, rowCount, colCount] = slab.shape;
      const bandSize = rowCount * colCount;
      const slabData = /** @type {Float32Array} */ (slab.data);
      chunks = [];
      for (let b = 0; b < bandCount; ++b) {
        chunks.push({
          data: slabData.subarray(b * bandSize, (b + 1) * bandSize),
          shape: [rowCount, colCount],
          stride: [colCount, 1],
        });
      }
    } else {
      chunks = await Promise.all(
        Array.from({length: count}, (_, b) => get(array, makeSelection(b))),
      );
    }
    if (flip) {
      chunks = chunks.map(flipChunkRows);
    }

    const [tileColCount, tileRowCount] = toSize(this.tileGrid.getTileSize(z));
    return composeData(
      chunks,
      chunks.map(() => tileResolution),
      tileColCount,
      tileRowCount,
      tileResolution,
      this.resampleMethod_,
      this.fillValue_,
    );
  }

  /**
   * For multi-group mode: determine which group owns each band and supplement
   * bandsByLevel with bands from additional groups.
   * @private
   */
  resolveBandOwnership_() {
    const subMetadatas = this.groupPaths_.map((gp) =>
      getSubMetadata(this.consolidatedMetadata_, gp),
    );

    for (let i = 0, ii = this.bands_.length; i < ii; ++i) {
      const band = this.bands_[i];
      const g = this.bandGroupIndex_[i];
      if (g === 0) {
        continue; // primary group bands are already in bandsByLevel_
      }
      let foundAtAnyLevel = false;
      for (const matrixId of Object.keys(this.bandsByLevel_)) {
        const bandMeta = subMetadatas[g][`${matrixId}/${band}`];
        if (bandMeta) {
          foundAtAnyLevel = true;
          if (!this.bandsByLevel_[matrixId].includes(band)) {
            this.bandsByLevel_[matrixId].push(band);
          }
          if (this.fillValue_ === undefined) {
            this.fillValue_ = Number(bandMeta['fill_value']);
          }
        }
      }
      if (!foundAtAnyLevel) {
        // Try single-scale: band lives directly at the group root (no matrixId prefix).
        const bandMeta = subMetadatas[g][band];
        if (bandMeta) {
          for (const matrixId of Object.keys(this.bandsByLevel_)) {
            if (!this.bandsByLevel_[matrixId].includes(band)) {
              this.bandsByLevel_[matrixId].push(band);
            }
          }
          if (this.fillValue_ === undefined) {
            this.fillValue_ = Number(bandMeta['fill_value']);
          }
          // Derive the band's actual pixel resolution from its array shape so
          // that loadTile_ can use correct coordinates regardless of the tile
          // grid zoom level.
          const shape = bandMeta['shape'];
          if (shape && shape[1] > 0) {
            const extent = this.tileGrid.getExtent();
            this.bandSingleScaleResolution_[i] =
              (extent[2] - extent[0]) / shape[1];
          }
          foundAtAnyLevel = true;
        }
      }
      if (!foundAtAnyLevel) {
        warn(
          `Band "${band}" from group "${this.groupPaths_[g]}" is not available at any ` +
            `resolution level compatible with the tile grid.`,
        );
      }
    }
  }
}

/**
 * Parse a Zarr fill value (which may be encoded as a string like "NaN").
 * @param {number|string|null|undefined} value The raw fill value.
 * @return {number|undefined} The fill value as a number, or undefined.
 */
function parseFillValue(value) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return Number(value);
  }
  return undefined;
}

/**
 * Extract a sub-view of consolidated metadata for a specific group path.
 * Keys in the returned object are relative to the group path.
 * @param {Object} rootMetadata The root consolidated metadata.
 * @param {string} groupPath The group path (e.g. 'measurements/reflectance').
 * @return {Object} Sub-metadata with paths relative to the group.
 */
function getSubMetadata(rootMetadata, groupPath) {
  const prefix = groupPath + '/';
  const sub = {};
  for (const key of Object.keys(rootMetadata)) {
    if (key.startsWith(prefix)) {
      sub[key.substring(prefix.length)] = rootMetadata[key];
    }
  }
  return sub;
}

/**
 * Maximum number of chunk requests to keep in the per-source LRU cache.
 * Adjacent tiles often read from the same chunk (in the extreme case, a
 * store with a single chunk per array); without this cache each tile would
 * fetch the chunk again, as zarrita does not cache requests.
 * @type {number}
 */
const MAX_CACHED_CHUNKS = 32;

/**
 * Create a store wrapper that serves Zarr metadata documents from an
 * in-memory cache (filled from consolidated metadata), avoiding per-child
 * HTTP requests, and deduplicates chunk requests with a small LRU cache.
 * @param {import('zarrita').FetchStore} store The underlying store.
 * @param {Map<string, Uint8Array>} cache The cached metadata documents by store key.
 * @return {Object} A store-compatible object.
 */
function createCachedStore(store, cache) {
  /** @type {Map<string, Promise<Uint8Array|undefined>>} */
  const chunkCache = new Map();
  return {
    async get(key, opts) {
      if (cache.has(key)) {
        return cache.get(key);
      }
      if (chunkCache.has(key)) {
        // Re-insert to mark the entry as most recently used
        const cached = chunkCache.get(key);
        chunkCache.delete(key);
        chunkCache.set(key, cached);
        return cached;
      }
      const promise = store.get(key, opts);
      chunkCache.set(key, promise);
      promise.catch(() => chunkCache.delete(key));
      if (chunkCache.size > MAX_CACHED_CHUNKS) {
        chunkCache.delete(chunkCache.keys().next().value);
      }
      return promise;
    },
    getRange: store.getRange?.bind(store),
  };
}

/**
 * Read a single array's metadata directly from the store, for stores
 * without consolidated metadata. Supports Zarr v3 (zarr.json) and
 * Zarr v2 (.zarray + .zattrs).
 * @param {FetchStore} store The store.
 * @param {string} path The array path.
 * @return {Promise<Object|undefined>} The array metadata (v3 shape).
 */
async function getArrayMeta(store, path) {
  const decoder = new TextDecoder();
  let bytes = await store.get(`/${path}/zarr.json`).catch(() => undefined);
  if (bytes) {
    return JSON.parse(decoder.decode(bytes));
  }
  bytes = await store.get(`/${path}/.zarray`).catch(() => undefined);
  if (bytes) {
    const zarray = JSON.parse(decoder.decode(bytes));
    const attrBytes = await store
      .get(`/${path}/.zattrs`)
      .catch(() => undefined);
    const attributes = attrBytes ? JSON.parse(decoder.decode(attrBytes)) : {};
    return {
      shape: zarray['shape'],
      fill_value: zarray['fill_value'],
      dimension_names: attributes['_ARRAY_DIMENSIONS'],
      chunk_grid: {
        name: 'regular',
        configuration: {chunk_shape: zarray['chunks']},
      },
      attributes,
    };
  }
  return undefined;
}

/**
 * Flip the row order of a 2-dimensional chunk (for south-up data).
 * @param {{data: any, shape: Array<number>}} chunk The chunk.
 * @return {{data: any, shape: Array<number>}} The flipped chunk.
 */
function flipChunkRows(chunk) {
  const [rowCount, colCount] = chunk.shape;
  const source = chunk.data;
  const data = new source.constructor(source.length);
  for (let row = 0; row < rowCount; ++row) {
    data.set(
      source.subarray(
        (rowCount - 1 - row) * colCount,
        (rowCount - row) * colCount,
      ),
      row * colCount,
    );
  }
  return {data, shape: chunk.shape};
}

/**
 * Normalize Zarr v2 consolidated metadata (.zmetadata entries like
 * `path/.zarray` and `path/.zattrs`) into the Zarr v3 shape that the rest of
 * this source reads (one object per array path with `shape`, `fill_value`,
 * `dimension_names` and `attributes`).
 * @param {Object<string, *>} v2Metadata The .zmetadata `metadata` entries.
 * @return {Object<string, *>} Array metadata by path.
 */
function normalizeV2Metadata(v2Metadata) {
  const normalized = {};
  for (const [key, value] of Object.entries(v2Metadata)) {
    if (!key.endsWith('/.zarray')) {
      continue;
    }
    const path = key.slice(0, -'/.zarray'.length);
    const attributes = v2Metadata[`${path}/.zattrs`] || {};
    normalized[path] = {
      shape: value['shape'],
      fill_value: value['fill_value'],
      dimension_names: attributes['_ARRAY_DIMENSIONS'],
      chunk_grid: {
        name: 'regular',
        configuration: {chunk_shape: value['chunks']},
      },
      attributes,
    };
  }
  return normalized;
}

/***
 * @typedef {{
 *   multiscales: Multiscales,
 *   zarr_conventions: Array<{uuid: string}>,
 *   'spatial:bbox': import("ol/extent.js").Extent,
 *   'spatial:shape': Array<number>,
 *   'spatial:transform': Array<number>,
 *   'spatial:dimensions': Array<string>,
 *   'proj:code': string,
 * }} DatasetAttributes
 */

/**
 * @typedef {Object} Multiscales
 * @property {Object} layout The layout.
 */

/**
 * @typedef {Object} LegacyDatasetAttributes
 * @property {LegacyMultiscales} multiscales The multiscales attribute.
 */

/**
 * @typedef {Object} LegacyMultiscales
 * @property {any} tile_matrix_limits The tile matrix limits.
 * @property {any} tile_matrix_set The tile matrix set.
 */

/**
 * @typedef {Object} TileGridInfo
 * @property {WMTSTileGrid} tileGrid The tile grid.
 * @property {import("ol/proj/Projection.js").default} projection The projection.
 * @property {Object<string, Array<string>>} [bandsByLevel] Available bands by level.
 * @property {number} [fillValue] The fill value.
 * @property {Array<import("ol/size.js").Size>|undefined} [tileSizes] The tile sizes for each level, if available.
 */

/**
 * Maximum tile size for rendering.
 * @type {number}
 */
const MAX_TILE_SIZE = 512;

/**
 * Minimum tile size when sharding is used.
 * @type {number}
 */
const MIN_TILE_SIZE = 64;

/**
 * @typedef {Object} ShardInfo
 * @property {Array<number>} shardShape The shard (outer chunk) shape.
 * @property {Array<number>} innerChunkShape The inner chunk shape.
 */

/**
 * FIXME Remove this when GeoZarr datasets provide correct TileMatrixSet info or similar.
 *
 * Get the shard and inner chunk shapes from the Zarr v3 array metadata.
 * Only returns info when a `sharding_indexed` codec is present, meaning
 * `chunk_grid.configuration.chunk_shape` represents the shard (outer chunk) size.
 * @param {Object} arrayMeta The Zarr v3 array metadata from consolidated metadata.
 * @return {ShardInfo|undefined} The shard info, or undefined.
 */
function getShardInfo(arrayMeta) {
  const chunkGrid = arrayMeta['chunk_grid'];
  if (!chunkGrid || chunkGrid['name'] !== 'regular') {
    return undefined;
  }
  const codecs = arrayMeta['codecs'];
  if (!Array.isArray(codecs)) {
    return undefined;
  }
  const shardingCodec = codecs.find((c) => c['name'] === 'sharding_indexed');
  if (!shardingCodec) {
    return undefined;
  }
  return {
    shardShape: chunkGrid['configuration']['chunk_shape'],
    innerChunkShape: shardingCodec['configuration']['chunk_shape'],
  };
}

/**
 * FIXME Remove this when GeoZarr datasets provide correct TileMatrixSet info or similar.
 *
 * Compute a tile size that is a multiple of the inner chunk size, evenly divides
 * the shard size, is at most MAX_TILE_SIZE, and is at least MIN_TILE_SIZE.
 * Aligning with inner chunk boundaries avoids fetching the same inner chunk
 * data for adjacent tiles.
 * @param {number} shardSize The shard size in pixels along one dimension.
 * @param {number} innerChunkSize The inner chunk size in pixels along one dimension.
 * @return {number} The tile size.
 */
function getTileSizeForShard(shardSize, innerChunkSize) {
  if (innerChunkSize > MAX_TILE_SIZE) {
    // Inner chunks are larger than the maximum tile size: use the largest
    // divisor of the inner chunk size that fits, so that a whole number of
    // tiles covers each inner chunk.
    for (
      let candidate = MAX_TILE_SIZE;
      candidate >= MIN_TILE_SIZE;
      --candidate
    ) {
      if (innerChunkSize % candidate === 0) {
        return candidate;
      }
    }
    return MAX_TILE_SIZE;
  }
  // Find the largest multiple of innerChunkSize that divides shardSize
  // and is within [MIN_TILE_SIZE, MAX_TILE_SIZE].
  const maxChunks = Math.floor(MAX_TILE_SIZE / innerChunkSize);
  for (let n = maxChunks; n >= 1; --n) {
    const candidate = n * innerChunkSize;
    if (candidate >= MIN_TILE_SIZE && shardSize % candidate === 0) {
      return candidate;
    }
  }
  // No ideal size found. Use shard size itself when it fits, otherwise
  // use the largest chunk-aligned size that fits within MAX_TILE_SIZE.
  if (shardSize <= MAX_TILE_SIZE && shardSize >= MIN_TILE_SIZE) {
    return shardSize;
  }
  if (shardSize < MIN_TILE_SIZE) {
    return MIN_TILE_SIZE;
  }
  return Math.max(maxChunks * innerChunkSize, MIN_TILE_SIZE);
}

/**
 * Maximum tile size when tiles are aligned to (unsharded) chunks. Larger
 * than MAX_TILE_SIZE because decoding one big chunk into a single tile is
 * cheaper than decoding it once per covering tile.
 * @type {number}
 */
const MAX_CHUNK_TILE_SIZE = 2048;

/**
 * Compute a tile size for an unsharded array from its chunk size along one
 * dimension: a multiple of the chunk size when chunks are small, or (a cap
 * of) the chunk size itself when chunks are large, so that a tile decodes
 * as few chunks as possible.
 * @param {number} chunkSize The chunk size in pixels along one dimension.
 * @param {number} arraySize The array size in pixels along the same dimension.
 * @return {number} The tile size.
 */
function getTileSizeForChunk(chunkSize, arraySize) {
  let size;
  if (chunkSize >= MAX_TILE_SIZE) {
    size = Math.min(chunkSize, MAX_CHUNK_TILE_SIZE);
  } else {
    // Largest multiple of the chunk size within MAX_TILE_SIZE
    size = Math.floor(MAX_TILE_SIZE / chunkSize) * chunkSize;
  }
  return Math.max(MIN_TILE_SIZE, Math.min(size, arraySize));
}

/**
 * @param {DatasetAttributes} attributes The dataset attributes.
 * @param {any} consolidatedMetadata The consolidated metadata.
 * @param {Array<string>} wantedBands The wanted bands.
 * @return {TileGridInfo} The tile grid info.
 */
function getTileGridInfoFromAttributes(
  attributes,
  consolidatedMetadata,
  wantedBands,
) {
  const multiscales = attributes.multiscales;
  const extent = attributes['spatial:bbox'];
  const projection = getProjection(attributes['proj:code']);
  const extentWidth = extent[2] - extent[0];
  const origin = [extent[0], extent[3]];
  /** @type {Array<{matrixId: string, resolution: number, origin: import("ol/coordinate.js").Coordinate, tileSize: import("ol/size.js").Size|undefined}>} */
  const groupInfo = [];
  const bandsByLevel = consolidatedMetadata ? {} : null;
  let fillValue;
  for (const groupMetadata of multiscales.layout) {
    const matrixId = groupMetadata.asset;
    const resolution = extentWidth / groupMetadata['spatial:shape'][1];
    /** @type {import("ol/size.js").Size|undefined} */
    let tileSize;
    if (consolidatedMetadata) {
      const availableBands = [];
      for (const band of wantedBands) {
        const bandArray = consolidatedMetadata[`${matrixId}/${band}`];
        if (bandArray) {
          availableBands.push(band);
          if (fillValue === undefined) {
            fillValue = Number(bandArray['fill_value']);
          }
          //FIXME Remove this when GeoZarr datasets provide correct TileMatrixSet info or similar
          if (!tileSize) {
            const shardInfo = getShardInfo(bandArray);
            if (shardInfo) {
              tileSize = [
                getTileSizeForShard(
                  shardInfo.shardShape[1],
                  shardInfo.innerChunkShape[1],
                ),
                getTileSizeForShard(
                  shardInfo.shardShape[0],
                  shardInfo.innerChunkShape[0],
                ),
              ];
            }
          }
        }
      }
      bandsByLevel[matrixId] = availableBands;
    }
    groupInfo.push({
      matrixId,
      resolution,
      origin,
      tileSize,
    });
  }
  groupInfo.sort((a, b) => b.resolution - a.resolution);

  const tileSizes = groupInfo.map((g) => g.tileSize);
  const hasTileSizes = tileSizes.some((s) => s !== undefined);

  const tileGrid = new WMTSTileGrid({
    extent: extent,
    origins: groupInfo.map((g) => g.origin),
    resolutions: groupInfo.map((g) => g.resolution),
    matrixIds: groupInfo.map((g) => g.matrixId),
    ...(hasTileSizes ? {tileSizes: tileSizes.map((s) => s || [256, 256])} : {}),
  });

  return {tileGrid, projection, bandsByLevel, fillValue, tileSizes};
}

/**
 * @param {LegacyDatasetAttributes} attributes The dataset attributes.
 * @return {TileGridInfo} The tile grid info.
 */
function getTileGridInfoFromLegacyAttributes(attributes) {
  const multiscales = attributes.multiscales;
  const tileMatrixSet = multiscales.tile_matrix_set;
  const tileMatrixLimitsObject = multiscales.tile_matrix_limits;

  const numMatrices = tileMatrixSet.tileMatrices.length;
  const tileMatrixLimits = new Array(numMatrices);
  let overrideTileSize = false;
  for (let i = 0; i < numMatrices; i += 1) {
    const tileMatrix = tileMatrixSet.tileMatrices[i];
    const tilematrixId = tileMatrix.id;
    if (tileMatrix.tileWidth > 512 || tileMatrix.tileHeight > 512) {
      // Avoid tile sizes that are too large for rendering
      overrideTileSize = true;
    }
    tileMatrixLimits[i] = tileMatrixLimitsObject[tilematrixId];
  }

  const info = parseTileMatrixSet(
    {},
    tileMatrixSet,
    undefined,
    tileMatrixLimits,
  );

  let tileGrid = info.grid;

  // Tile size sanity
  if (overrideTileSize) {
    tileGrid = new WMTSTileGrid({
      tileSize: 512,
      extent: tileGrid.getExtent(),
      origins: tileGrid.getOrigins(),
      resolutions: tileGrid.getResolutions(),
      matrixIds: tileGrid.getMatrixIds(),
    });
  }
  return {tileGrid, projection: info.projection};
}

/**
 * @param {Array<{data: any, shape: Array<number>}>} chunks The input chunks.
 * @param {Array<number>} chunkResolutions The resolutions for each band.
 * @param {number} tileColCount The number of columns in the output data.
 * @param {number} tileRowCount The number of rows in the output data.
 * @param {number} tileResolution The tile resolution.
 * @param {ResampleMethod} resampleMethod The resampling method.
 * @param {number} fillValue The fill value.
 * @return {Float32Array} The tile data.
 */
function composeData(
  chunks,
  chunkResolutions,
  tileColCount,
  tileRowCount,
  tileResolution,
  resampleMethod,
  fillValue,
) {
  const chunkCount = chunks.length;
  const addAlpha = fillValue !== null && fillValue !== undefined;
  const isNoDataValue = isNaN(fillValue)
    ? (v) => isNaN(v)
    : (v) => v === fillValue;
  const bandCount = chunkCount + (addAlpha ? 1 : 0);
  const tileData = new Float32Array(tileColCount * tileRowCount * bandCount);
  for (let tileRow = 0; tileRow < tileRowCount; tileRow++) {
    for (let tileCol = 0; tileCol < tileColCount; tileCol++) {
      let hasData = false;
      for (let chunkIndex = 0; chunkIndex < chunkCount; ++chunkIndex) {
        const chunk = chunks[chunkIndex];
        const chunkRowCount = chunk.shape[0];
        const chunkColCount = chunk.shape[1];
        const scaleFactor = tileResolution / chunkResolutions[chunkIndex];
        let value = 0;
        let inBounds = false;
        if (scaleFactor === 1) {
          if (tileRow < chunkRowCount && tileCol < chunkColCount) {
            inBounds = true;
            value = chunk.data[tileRow * chunkColCount + tileCol];
          }
        } else {
          const chunkRow = tileRow * scaleFactor;
          const chunkCol = tileCol * scaleFactor;
          switch (resampleMethod) {
            case 'nearest': {
              const valueRow = Math.round(chunkRow);
              const valueCol = Math.round(chunkCol);
              if (valueRow < chunkRowCount && valueCol < chunkColCount) {
                inBounds = true;
                value = chunk.data[valueRow * chunkColCount + valueCol];
              }
              break;
            }
            case 'linear': {
              const row0 = Math.floor(chunkRow);
              const col0 = Math.floor(chunkCol);
              if (row0 < chunkRowCount && col0 < chunkColCount) {
                inBounds = true;
                const row1 = Math.min(row0 + 1, chunkRowCount - 1);
                const col1 = Math.min(col0 + 1, chunkColCount - 1);

                const v00 = chunk.data[row0 * chunkColCount + col0];
                const v01 = chunk.data[row0 * chunkColCount + col1];
                const v10 = chunk.data[row1 * chunkColCount + col0];
                const v11 = chunk.data[row1 * chunkColCount + col1];

                const dx = chunkCol - col0;
                const dy = chunkRow - row0;

                value =
                  (1 - dy) * ((1 - dx) * v00 + dx * v01) +
                  dy * ((1 - dx) * v10 + dx * v11);
              }
              break;
            }
            default: {
              throw new Error(`Unsupported resample method: ${resampleMethod}`);
            }
          }
        }
        if (inBounds && !isNoDataValue(value)) {
          hasData = true;
        }
        if (isNaN(value)) {
          value = 0;
        }
        tileData[bandCount * (tileRow * tileColCount + tileCol) + chunkIndex] =
          value;
      }
      if (addAlpha) {
        tileData[bandCount * (tileRow * tileColCount + tileCol) + chunkCount] =
          hasData ? 1 : 0;
      }
    }
  }
  return tileData;
}

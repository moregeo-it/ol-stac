/**
 * @module ol/layer/STAC
 */
import * as pmtiles from 'pmtiles';
import ErrorEvent from '../events/ErrorEvent.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import GeoTIFF from 'ol/source/GeoTIFF.js';
import ImageLayer from 'ol/layer/Image.js';
import LayerGroup from 'ol/layer/Group.js';
import SourceType from '../source/type.js';
import StaticImage from 'ol/source/ImageStatic.js';
import TileJSON from 'ol/source/TileJSON.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import VectorTileLayer from 'ol/layer/VectorTile.js';
import VectorTileSource from 'ol/source/VectorTile.js';
import WMS from 'ol/source/TileWMS.js';
import WMTS, {optionsFromCapabilities} from 'ol/source/WMTS.js';
import WMTSCapabilities from 'ol/format/WMTSCapabilities.js';
import WebGLTileLayer from 'ol/layer/WebGLTile.js';
import XYZ from 'ol/source/XYZ.js';
import create, {
  APICollection,
  Asset,
  Item,
  ItemCollection,
  STAC,
} from 'stac-js';
import {
  LABEL_EXTENSION,
  defaultBoundsStyle,
  defaultCollectionStyle,
  getBoundsStyle,
  getGeoTiffSourceInfoFromAsset,
  getProjection,
  getSpecificWebMapUrl,
} from '../util.js';
import {PMTilesRasterSource, PMTilesVectorSource} from 'ol-pmtiles';
import {fixGeoJson, toGeoJSON, unionBoundingBox} from 'stac-js/src/geo.js';
import {geojsonMediaType} from 'stac-js/src/mediatypes.js';
import {isEmpty} from 'ol/extent.js';
import {isObject} from 'stac-js/src/utils.js';
import {transformExtent} from 'ol/proj.js';
/**
 * @typedef {import("ol/extent.js").Extent} Extent
 */
/**
 * @typedef {import("ol/layer/Layer.js").default} Layer
 */
/**
 * @typedef {import("stac-js").Link} Link
 */
/**
 * @typedef {import("ol/Map.js").default} Map
 */
/**
 * @typedef {import('ol/style/Style.js').default} Style
 */
/**
 * @typedef {import('../source/type.js').SourceOptions} SourceOptions
 */

/**
 * @typedef {Object} Options
 * @property {string} [url] The STAC URL. Any of `url` and `data` must be provided.
 * Can also be used as url for data, if it is absolute and doesn't contain a self link.
 * Don't use this is you pass in a stac-js object as `data`, set the url manually through
 * `setAbsoluteUrl` on the stac-js object before passing it in.
 * @property {STAC|Asset|Object} [data] The STAC metadata. Any of `url` and `data` must be provided.
 * `data` take precedence over `url`.
 * @property {ItemCollection|Object|Array<STAC|Object>|null} [children=null] For STAC Catalogs and Collections, any child entites
 * to show. Can be STAC ItemCollections (as ItemCollection or GeoJSON FeatureCollection) or a list of STAC entities.
 * @property {Options} [childrenOptions={}] The the given children, apply the given options.
 * @property {Array<string|Asset>|null} [assets=null] The selector for the assets to be rendered,
 * only for STAC Items and Collections.
 * This can be an array of strings corresponding to asset keys or Asset objects.
 * null shows the default asset, an empty array shows no asset.
 * @property {Array<number>} [bands] The (one-based) bands to show.
 * @property {function(SourceType, SourceOptions, (Asset|Link)):(SourceOptions|Promise<SourceOptions>)} [getSourceOptions]
 * Optional function that can be used to configure the underlying sources. The function can do any additional work
 * and return the completed options or a promise for the same. The function will be called with the current source options
 * and the STAC Asset or Link.
 * This can be useful for adding auth information such as an API token, either via query parameter or HTTP headers.
 * Please be aware that sending HTTP headers may not be supported by all sources.
 * @property {boolean} [displayFootprint=true] Allows to hide the footprints (bounding box/geometry) of the STAC object
 * by default.
 * @property {boolean} [displayGeoTiffByDefault=false] Allow to choose non-cloud-optimized GeoTiffs as default image to show,
 * which might not work well for larger files or larger amounts of files.
 * @property {boolean} [displayPreview=false] Allow to display preview images that a browser can display (e.g. PNG, JPEG),
 * i.e. assets with any of the roles `thumbnail`, `overview`, or a link with relation type `preview`.
 * The previews are usually not covering the full extents and as such may be placed incorrectly on the map.
 * For performance reasons, it is recommended to enable this option if you pass in STAC API Items instead of `displayOverview`.
 * @property {boolean} [displayOverview=true] Allow to display COGs and, if `displayGeoTiffByDefault` is enabled, GeoTiffs,
 * usually an asset with role `overview` or `visual`.
 * @property {string|boolean|Array<Link|string>} [displayWebMapLink=false] Allow to display a layer
 * based on the information provided through the web map links extension.
 * If an array of links or link ids (property `id` in a Link Object) is provided, all corresponding layers will be shown.
 * If set to true or to a specific type of web map link (`pmtiles`, `tilejson`, `wms`, `wmts`, `xyz`),
 * it lets this library choose a web map link to show, but only if no other data is shown.
 * To disable the functionality set this to `false`.
 * @property {Style} [boundsStyle] The style for the overall bounds / footprint.
 * @property {Style} [collectionStyle] The style for individual children in a list of STAC Items or Collections.
 * @property {null|string} [crossOrigin] For thumbnails: The `crossOrigin` attribute for loaded images / tiles.
 * See https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image for more detail.
 * @property {function((Asset|Link)):Promise<string>|string|null} [buildTileUrlTemplate=null] A function that generates a URL template for a tile server (XYZ),
 * which will be used instead of the client-side GeoTIFF rendering (except if `useTileLayerAsFallback` is `true`).
 * The function provided can return a promise (i.e. be async) or a string.
 * @property {boolean} [useTileLayerAsFallback=false] Uses the given URL template only when the client-side GeoTIFF rendering fails.
 * @property {number} [opacity=1] Opacity (0, 1).
 * @property {boolean} [visible=true] Visibility.
 * @property {Extent} [extent] The bounding extent for layer rendering.  The layer will not be
 * rendered outside of this extent.
 * @property {number} [zIndex] The z-index for layer rendering.  At rendering time, the layers
 * will be ordered, first by Z-index and then by position. When `undefined`, a `zIndex` of 0 is assumed
 * for layers that are added to the map's `layers` collection, or `Infinity` when the layer's `setMap()`
 * method was used.
 * @property {number} [minResolution] The minimum resolution (inclusive) at which this layer will be
 * visible.
 * @property {number} [maxResolution] The maximum resolution (exclusive) below which this layer will
 * be visible.
 * @property {number} [minZoom] The minimum view zoom level (exclusive) above which this layer will be
 * visible.
 * @property {number} [maxZoom] The maximum view zoom level (inclusive) at which this layer will
 * be visible.
 * @property {Object<string, *>} [properties] Arbitrary observable properties. Can be accessed with `#get()` and `#set()`. `stac` and `bounds` are reserved and may be overridden.
 * @property {boolean} [disableMigration=false] Disable the migration of the STAC object to the latest version.
 * Only enable this if you are sure that the STAC object is already in the latest version.
 * @property {function(string,string):(*)} [httpRequestFn=null] Sets a custom function to make HTTP requests with.
 * The first parameter is the URL to request and the output is a promise that resolves with the response body.
 * The second parameter is the return type, either `json` (default) or `text`.
 */

/**
 * @classdesc
 * Renders STAC entities such as STAC Items, Collectons or lists of them as returned by APIs.
 * The layers created by this LayerGroup all have a 'stac' value that can be retrieved using `layer.get('stac')`.
 *
 * @extends LayerGroup
 * @fires sourceready
 * @fires layersready
 * @fires ErorEvent#event:error
 * @api
 */
class STACLayer extends LayerGroup {
  /**
   * @param {Options} options Layer options.
   * @api
   */
  constructor(options) {
    const superOptions = {};
    [
      'opacity',
      'visible',
      'zIndex',
      'minResolution',
      'maxResolution',
      'minZoom',
      'maxZoom',
      'properties',
    ].forEach((key) => (superOptions[key] = options[key]));

    super(superOptions);

    /**
     * @type {function(SourceType, SourceOptions, (Asset|Link)):(SourceOptions|Promise<SourceOptions>)}
     * @private
     */
    this.getSourceOptions_ = options.getSourceOptions;

    /**
     * @type {Array<STAC>|null}
     * @private
     */
    this.children_ = null;

    /**
     * @type {Options}
     * @private
     */
    this.childrenOptions_ = options.childrenOptions || {};

    /**
     * @type {Array<Asset>|null}
     * @private
     */
    this.assets_ = null;

    /**
     * @type {Array<number>}
     * @private
     */
    this.bands_ = [];

    /**
     * @type {string|null}
     * @private
     */
    this.crossOrigin_ = options.crossOrigin || null;

    /**
     * @type {boolean}
     * @private
     */
    this.displayFootprint_ = options.displayFootprint === false ? false : true;

    /**
     * @type {boolean}
     * @private
     */
    this.displayGeoTiffByDefault_ = Boolean(options.displayGeoTiffByDefault);

    /**
     * @type {boolean}
     * @private
     */
    this.displayPreview_ = Boolean(options.displayPreview);

    /**
     * @type {boolean}
     * @private
     */
    this.displayOverview_ = options.displayOverview === false ? false : true;

    /**
     * @type {string|boolean|Array<Link|string>}
     */
    this.displayWebMapLink_ = options.displayWebMapLink || false;

    /**
     * @type {function((Asset|Link)):Promise<string>|string|null}
     * @private
     */
    this.buildTileUrlTemplate_ = options.buildTileUrlTemplate || null;

    /**
     * @type {boolean}
     * @private
     */
    this.useTileLayerAsFallback_ = options.useTileLayerAsFallback || false;

    /**
     * @type {Style}
     * @private
     */
    this.boundsStyle_ = options.boundsStyle || defaultBoundsStyle;

    /**
     * @type {Style}
     * @private
     */
    this.collectionStyle_ = options.collectionStyle || defaultCollectionStyle;

    /**
     * @type {VectorLayer|null}
     * @private
     */
    this.boundsLayer_ = null;

    /**
     * @type {boolean}
     * @private
     */
    this.disableMigration_ = options.disableMigration || false;

    /**
     * @type {Map|null}
     * @private
     */
    this.map_ = null;

    /**
     * @type {Array<string|ErrorEvent>}
     * @private
     */
    this.eventQueue_ = [];

    if (options.httpRequestFn) {
      this.fetch_ = options.httpRequestFn;
    }

    if (options.data) {
      try {
        this.configure_(
          options.data,
          options.url,
          options.children,
          options.assets,
          options.bands
        );
      } catch (error) {
        this.handleError_(error);
      }
      return;
    }

    if (!options.url) {
      throw new Error('Either url or data must be provided');
    }

    this.fetch_(options.url)
      .then((data) =>
        this.configure_(
          data,
          options.url,
          options.children,
          options.assets,
          options.bands
        )
      )
      .catch((error) => this.handleError_(error));
  }

  /**
   * Default function make HTTP requests with.
   *
   * @param {string} url The URL to request and the output is a promise that resolves with the response body.
   * @param {string} responseType The return type, either `json` (default) or `text`.
   * @return {Promise<*>} The (parsed) response body.
   */
  async fetch_(url, responseType = 'json') {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Unexpected response from ${url}: ${response.status}`);
    }
    if (responseType === 'json') {
      return await response.json();
    }
    if (responseType === 'text') {
      return await response.text();
    }
    return null;
  }

  /**
   * Returns the vector layer that visualizes the bounds / footprint.
   * @return {VectorLayer|null} The vector layer for the bounds
   * @api
   */
  getBoundsLayer() {
    return this.boundsLayer_;
  }

  /**
   * Returns `true` if the layer shows nothing.
   *
   * This method should be called after the layersready event only.
   *
   * @return {boolean} Is the layer empty?
   * @api
   */
  isEmpty() {
    const count = this.getLayers().getLength();
    if (count > 1) {
      return false;
    }
    const bbox = this.getData()?.getBoundingBox();
    if (!bbox || isEmpty(bbox)) {
      return true;
    }
    return !this.boundsLayer_ || !this.displayFootprint_;
  }

  /**
   * @param {Error} error The error.
   * @private
   */
  handleError_(error) {
    /**
     * Error event.
     *
     * @event ErorEvent#event:error
     * @type {Object}
     * @property {Error} error - Provides the original error.
     */
    this.dispatch_(new ErrorEvent(error));
  }

  /**
   * @param {STAC|Asset|Object} data The STAC data.
   * @param {string} url The url to the data.
   * @param {ItemCollection|Object|Array<STAC>|string|null} children The child STAC entities to show.
   * @param {Array<Asset|string>|null} assets The assets to show.
   * @param {Array<number>} bands The (one-based) bands to show.
   * @private
   */
  configure_(data, url = null, children = null, assets = null, bands = []) {
    let stac;
    if (data instanceof Asset || data instanceof STAC) {
      stac = data;
    } else {
      stac = create(data, !this.disableMigration_);
      if (url && url.includes('://')) {
        stac.setAbsoluteUrl(url);
      }
    }
    this.set('stac', stac);
    this.bands_ = bands;

    this.boundsLayer_ = this.addFootprint_();
    const updateBoundsStyle = () => {
      if (this.boundsLayer_) {
        this.boundsLayer_.setStyle(getBoundsStyle(this.boundsStyle_, this));
      }
    };
    this.getLayers().on('add', updateBoundsStyle);
    this.getLayers().on('remove', updateBoundsStyle);

    const errorHandler = (error) => this.handleError_(error);
    const promises = [];
    if (children) {
      promises.push(this.setChildren(children).catch(errorHandler));
    }
    if (assets) {
      promises.push(this.setAssets(assets).catch(errorHandler));
    }
    if (promises.length === 0) {
      promises.push(this.updateLayers_().catch(errorHandler));
    }
    Promise.all(promises).then(() => {
      /**
       * Invoked once all layers are shown on the map.
       *
       * @event layersready
       */
      return this.dispatch_('layersready');
    });

    /**
     * Invoked once the STAC entity is loaded and available.
     *
     * @event sourceready
     */
    this.dispatch_('sourceready');
  }

  /**
   * Dispatch an event.
   * Move it to the queue if the map is not yet set.
   * This is necessary as otherwise some events would be
   * dispatched before someone could listen to them.
   *
   * @param {string|ErrorEvent} event The event.
   * @private
   */
  dispatch_(event) {
    this.eventQueue_.push(event);
    this.flush_();
  }

  /**
   * Flush all events.
   * @private
   */
  flush_() {
    if (this.map_) {
      for (const event of this.eventQueue_) {
        this.dispatchEvent(event);
      }
      this.eventQueue_ = [];
    }
  }

  /**
   * Set the map and flush all events.
   * The events should only be flushed once the map is set, otherwise some
   * functions such as getExtent() return no meaningul values.
   *
   * @param {Map} map The map
   */
  setMap_(map) {
    if (this.map_ === map) {
      return;
    }
    this.map_ = map;
    this.flush_();
  }

  /**
   * @param {Array<STAC>} collection The list of STAC entities to show.
   * @param {Options} [options] Options for the children.
   * @return {Promise} Resolves when complete.
   * @private
   */
  async addChildren_(collection, options = {}) {
    const promises = collection.map((obj) => {
      const defaultOptions = {
        data: obj,
        crossOrigin: this.crossOrigin_,
        boundsStyle: this.collectionStyle_,
        displayGeoTiffByDefault: this.displayGeoTiffByDefault_,
        displayOverview: this.displayOverview_,
        displayPreview: this.displayPreview_,
        displayFootprint: this.displayFootprint_,
        useTileLayerAsFallback: this.useTileLayerAsFallback_,
        buildTileUrlTemplate: this.buildTileUrlTemplate_,
      };
      const subgroup = new STACLayer(Object.assign(defaultOptions, options));
      // If no data is given, but items are provided, then we don't get a map from the
      // footprint layer so we need to get it from this new STAC Layer so that extent
      // calculations etc. work.
      // @ts-ignore
      subgroup.on('sourceready', () => {
        if (subgroup.map_) {
          this.setMap_(subgroup.map_);
        }
      });
      this.addLayer_(subgroup, null);
      return subgroup;
    });
    return await Promise.all(promises);
  }

  /**
   * @param {Asset|Link} [image] A STAC Link or Asset
   * @return {Promise<ImageLayer|undefined>} Resolves with am ImageLayer or udnefined when complete.
   * @private
   */
  async addPreviewImage_(image) {
    const projection = await getProjection(image, 'EPSG:4326');
    const bboxes = image.getContext().getBoundingBoxes();
    if (bboxes.length !== 1) {
      return;
    }
    const bbox = bboxes[0];
    /**
     * @type {import("ol/source/ImageStatic.js").Options}
     */
    let options = {
      url: image.getAbsoluteUrl(),
      projection,
      imageExtent: transformExtent(bbox, 'EPSG:4326', projection),
      crossOrigin: this.crossOrigin_,
    };
    if (this.getSourceOptions_) {
      // @ts-ignore
      options = await this.getSourceOptions_(
        SourceType.ImageStatic,
        options,
        image
      );
    }
    const layer = new ImageLayer({
      source: new StaticImage(options),
    });
    this.addLayer_(layer, image);
    return layer;
  }

  /**
   * Adds a layer for a link that implements the web-map-links extension.
   * Supports: PMTiles, TileJSON, WMS, WMTS, XYZ
   * @see https://github.com/stac-extensions/web-map-links
   * @param {Link} link A web map link
   * @return {Promise<Array<Layer>|undefined>} Resolves with a list of layers or undefined when complete.
   * @api
   */
  async addLayerForLink(link) {
    // Replace any occurances of {s} if possible, otherwise return
    const url = getSpecificWebMapUrl(link);
    if (!url) {
      return;
    }

    const options = {
      attributions:
        link.getMetadata('attribution') ||
        this.getData().getMetadata('attribution'),
      crossOrigin: this.crossOrigin_,
      url,
    };

    const updateOptions = async (type, options) => {
      if (this.getSourceOptions_) {
        options = await this.getSourceOptions_(type, options, link);
      }
      return options;
    };

    const sources = [];
    switch (link.rel) {
      case 'pmtiles':
        const p = new pmtiles.PMTiles(options.url);
        const headers = await p.getHeader();
        let source;
        switch (headers.tileType) {
          case pmtiles.TileType.Mvt:
            source = new PMTilesVectorSource(
              await updateOptions(SourceType.PMTilesVector, options)
            );
            break;
          case pmtiles.TileType.Avif:
          case pmtiles.TileType.Jpeg:
          case pmtiles.TileType.Png:
          case pmtiles.TileType.Webp:
            source = new PMTilesRasterSource(
              await updateOptions(SourceType.PMTilesRaster, options)
            );
            break;
          default:
            return; // Unsupported
        }
        sources.push(source);
        break;
      case 'tilejson':
        sources.push(
          new TileJSON(await updateOptions(SourceType.TileJSON, options))
        );
        break;
      case 'wms':
        if (!Array.isArray(link['wms:layers'])) {
          break;
        }
        for (const i in link['wms:layers']) {
          const layers = link['wms:layers'][i] || '';
          let styles = '';
          if (
            Array.isArray(link['wms:styles']) &&
            typeof link['wms:styles'][i] === 'string'
          ) {
            styles = link['wms:styles'][i];
          }
          const params = Object.assign(
            {
              LAYERS: layers,
              STYLES: styles,
            },
            link['wms:dimensions']
          );
          if (typeof link['wms:transparent'] === 'boolean') {
            params.TRANSPARENT = String(link['wms:transparent']);
          }
          if (
            typeof link['type'] === 'string' &&
            link['type'].startsWith('image/')
          ) {
            params.FORMAT = link['type'];
          }
          const wmsOptions = await updateOptions(
            SourceType.TileWMS,
            Object.assign({}, options, {params})
          );
          sources.push(new WMS(wmsOptions));
        }
        break;
      case 'wmts':
        const wmtsCapabilities = await this.getWmtsCapabilities_(url);
        if (!wmtsCapabilities) {
          return;
        }
        let layers = [];
        if (Array.isArray(link['wmts:layer'])) {
          layers = link['wmts:layer'];
        } else if (typeof link['wmts:layer'] === 'string') {
          layers = [link['wmts:layer']];
        }
        for (const layer of layers) {
          let wmtsOptions = Object.assign({}, options, {layer});
          if (
            typeof link['type'] === 'string' &&
            link['type'].startsWith('image/')
          ) {
            wmtsOptions.format = link['type'];
          }
          wmtsOptions = await updateOptions(SourceType.WMTS, wmtsOptions);
          const opts = optionsFromCapabilities(wmtsCapabilities, wmtsOptions);
          if (opts !== null) {
            sources.push(new WMTS(opts));
          }
        }
        break;
      case 'xyz':
        sources.push(new XYZ(await updateOptions(SourceType.XYZ, options)));
        break;
      default:
        return;
    }

    return sources.map((source) => {
      let layer;
      if (source instanceof VectorTileSource) {
        layer = new VectorTileLayer({
          source,
          declutter: true,
        });
      } else if (source instanceof PMTilesRasterSource) {
        layer = new WebGLTileLayer({source});
      } else {
        layer = new TileLayer({source});
      }
      this.addLayer_(layer, link);
      return layer;
    });
  }

  /**
   * @param {Asset} [asset] A STAC Asset
   * @return {Promise<Layer|undefined>} Resolves with a Layer or undefined when complete.
   * @private
   */
  async addGeoTiff_(asset) {
    if (this.buildTileUrlTemplate_ && !this.useTileLayerAsFallback_) {
      return await this.addTileLayerForImagery_(asset);
    }

    const sourceInfo = getGeoTiffSourceInfoFromAsset(asset, this.bands_);

    /**
     * @type {import("ol/source/GeoTIFF.js").Options}
     */
    let options = {
      sources: [sourceInfo],
      convertToRGB: 'auto',
    };

    const projection = await getProjection(asset);
    if (projection) {
      options.projection = projection;
    }

    if (this.getSourceOptions_) {
      // @ts-ignore
      options = await this.getSourceOptions_(
        SourceType.GeoTIFF,
        options,
        asset
      );
    }

    const source = new GeoTIFF(options);
    const status = new Promise((resolve, reject) => {
      source.on('error', reject);
      source.on('change', () => {
        // see https://github.com/openlayers/openlayers/issues/14926
        if (source.getState() === 'error') {
          reject(source.getError());
        } else {
          resolve();
        }
      });
    });
    try {
      await status;
      const layer = new WebGLTileLayer({source});
      this.addLayer_(layer, asset);
      return layer;
    } catch (error) {
      if (this.useTileLayerAsFallback_) {
        return await this.addTileLayerForImagery_(asset);
      }
      this.handleError_(error);
    }
  }

  /**
   * @param {Asset|Link} [data] A STAC Asset or Link
   * @return {Promise<TileLayer>} Resolves with a TileLayer when complete.
   * @private
   */
  async addTileLayerForImagery_(data) {
    let url = this.buildTileUrlTemplate_(data);
    if (url instanceof Promise) {
      url = await url;
    }
    /**
     * @type {import("ol/source/XYZ.js").Options}
     */
    let options = {
      crossOrigin: this.crossOrigin_,
      url,
    };
    if (this.getSourceOptions_) {
      options = await this.getSourceOptions_(SourceType.XYZ, options, data);
    }
    const layer = new TileLayer({
      source: new XYZ(options),
    });
    this.addLayer_(layer, data);
    return layer;
  }

  /**
   * @param {Layer|LayerGroup} [layer] A Layer to add to the LayerGroup
   * @param {import("stac-js").STACObject} [data] The STAC object, can be any class exposed by stac-js
   * @param {number} [zIndex=0] The z-index for the layer
   * @private
   */
  addLayer_(layer, data = null, zIndex = 0) {
    if (data) {
      layer.set('stac', data);
    }
    layer.setZIndex(zIndex);
    this.getLayers().push(layer);
  }

  /**
   * @return {VectorLayer|null} The vector layer showing the geometry/bbox.
   * @private
   */
  addFootprint_() {
    let geojson = null;
    const data = this.getData();
    if (data.isItemCollection() || data.isCollectionCollection()) {
      geojson = toGeoJSON(data.getBoundingBox());
    } else {
      geojson = data.toGeoJSON();
    }

    if (geojson) {
      const layer = this.createGeoJsonLayer_(
        geojson,
        getBoundsStyle(this.boundsStyle_, this),
        this.displayFootprint_
      );
      layer.set('bounds', true);
      layer.on('change', () => this.setMap_(layer.getMapInternal()));
      this.addLayer_(layer, data, 1);
      return layer;
    }

    return null;
  }

  /**
   * @param {Asset} [asset] A STAC Asset
   * @return {Promise<Layer|undefined>} Resolves with a Layer or undefined when complete.
   * @private
   */
  async addGeoJson_(asset) {
    try {
      const geojson = await this.fetch_(asset.getAbsoluteUrl());
      const layer = this.createGeoJsonLayer_(geojson);
      this.addLayer_(layer, asset);
      return layer;
    } catch (error) {
      this.handleError_(error);
    }
  }

  /**
   * Creates a GeoJSON vector layer from the given GeoJSON object.
   *
   * @param {GeoJSON} [geojson] The GeoJSON object.
   * @param {Style} [style] The style for the layer.
   * @param {boolean} [visible] Whether the layer is visible.
   * @return {VectorLayer} The new vector layer.
   * @private
   */
  createGeoJsonLayer_(geojson, style = null, visible = true) {
    const format = new GeoJSON();
    const source = new VectorSource({
      format,
      loader: (extent, resolution, projection) => {
        geojson = fixGeoJson(geojson);
        const features = format.readFeatures(geojson, {
          featureProjection: projection,
        });
        source.addFeatures(features);
      },
    });
    if (!style) {
      style = defaultCollectionStyle;
    }
    return new VectorLayer({source, style, visible});
  }

  /**
   * Adds GeoJSON labels and GeoTIFF source imagery to the map based on the label extension.
   *
   * @return {Promise<Layer|undefined>} The layer added to the map.
   * @private
   */
  async addLabelExtension_() {
    const data = this.getData();
    if (!(data instanceof Item)) {
      return;
    }
    // determine the asset with the geojson labels
    let assets = data.getAssetsWithRoles(['labels', 'labels-vector'], true);
    let labelAsset;
    if (assets.length > 1) {
      labelAsset = assets.find((asset) =>
        asset.roles.includes('labels-vector')
      );
    }
    if (!labelAsset) {
      labelAsset = data.getAsset('vector_labels');
    }
    if (!labelAsset) {
      assets = data
        .getAssets()
        .filter((asset) => asset.type === geojsonMediaType && !asset.roles);
      if (assets.length === 1) {
        labelAsset = assets[0];
      }
    }

    // Add the source imagery
    const sourceLinks = data.getLinksWithRels(['source']);
    if (labelAsset && sourceLinks.length > 0) {
      const promises = sourceLinks.map(async (link) => {
        try {
          const response = await this.fetch_(link.getAbsoluteUrl());
          const stac = create(response);
          return stac;
        } catch (error) {
          this.handleError_(error);
          return null;
        }
      });
      const items = (await Promise.all(promises)).filter(
        (item) => item instanceof STAC
      );
      await this.addChildren_(items, {displayFootprint: false});
    }

    // Add the GeoJSON labels
    try {
      await this.addGeoJson_(labelAsset);
    } catch (error) {
      this.handleError_(error);
    }
  }

  /**
   * @private
   */
  async updateLayers_() {
    // Remove old layers
    const oldLayers = this.getLayers();
    for (let i = oldLayers.getLength() - 1; i >= 0; i--) {
      const layer = oldLayers.item(i);
      if (layer.get('stac') && !layer.get('bounds')) {
        oldLayers.removeAt(i);
      }
    }

    // Add layers by priority
    const data = this.getData();

    // Show the web map links provided by the user
    if (Array.isArray(this.displayWebMapLink_)) {
      const promises = this.getWebMapLinks().map(
        async (link) => await this.addLayerForLink(link)
      );
      await Promise.all(promises);
    }

    // Show children if provided
    if (this.children_) {
      await this.addChildren_(this.children_, this.childrenOptions_);
    }

    // Show the assets provided by the user
    const assets = this.getAssets();
    if (assets) {
      const promises = assets.map(async (ref) => {
        if (!ref) {
          return;
        }
        if (ref.type === geojsonMediaType) {
          return await this.addGeoJson_(ref);
        }
        if (ref.isGeoTIFF()) {
          return await this.addGeoTiff_(ref);
        }
        if (ref.canBrowserDisplayImage()) {
          return await this.addPreviewImage_(ref);
        }
      });
      await Promise.all(promises);
    }

    // If the user didn't provide any specific asset/map link/children to show,
    // choose a sensible default visualization
    if (this.hasOnlyBounds()) {
      // Show the ItemCollection/CollectionCollection entries
      if (data instanceof APICollection) {
        await this.addChildren_(data.getAll(), this.childrenOptions_);
      } else if (data instanceof STAC) {
        // Show label extension
        if (
          data.isItem() &&
          data.supportsExtension(LABEL_EXTENSION) &&
          data.getMetadata('label:type') === 'vector'
        ) {
          await this.addLabelExtension_();
          return;
        }
        // Show web map links
        const links = this.getWebMapLinks();
        if (links.length > 0) {
          await this.addLayerForLink(links[0]);
        } else {
          // Find an asset that we can visualize
          const geotiff = data.getDefaultGeoTIFF(
            true,
            !this.displayGeoTiffByDefault_
          );
          let layer;
          // Try to visualize the default GeoTIFF first
          if (geotiff && this.displayOverview_) {
            layer = await this.addGeoTiff_(geotiff);
          }
          // If no GeoTIFF is available or it can't be shown (e.g. error),
          // try to visualize the default thumbnail
          if (this.displayPreview_ && (!geotiff || !layer)) {
            // This may return Links or Assets
            const thumbnails = data.getThumbnails(true, 'overview');
            if (thumbnails.length > 0) {
              await this.addPreviewImage_(thumbnails[0]);
            }
          }
        }
      }
    }
  }

  /**
   * Indicates whether the LayerGroup shows only the bounds layer (i.e. no imagery/tile layers).
   * @return {boolean} `true` if only the bounds layer is shown, `false` otherwise.
   * @api
   */
  hasOnlyBounds() {
    const boundsLayer = this.getBoundsLayer();
    const imgLayer = this.getLayersArray().find(
      (layer) => layer !== boundsLayer
    );
    return typeof imgLayer === 'undefined';
  }

  /**
   * Returns all potential web map links based on the given value for `displayWebMapLink`.
   * @return {Array<Link>} An array of links.
   * @api
   */
  getWebMapLinks() {
    const data = this.getData();
    if (data instanceof Asset) {
      return [];
    }

    let types = ['xyz', 'tilejson', 'pmtiles', 'wmts', 'wms']; // This also defines the priority
    if (typeof this.displayWebMapLink_ === 'string') {
      types = [this.displayWebMapLink_];
    }
    let mapLinks = data.getLinksWithRels(types);

    if (Array.isArray(this.displayWebMapLink_)) {
      mapLinks = this.displayWebMapLink_
        .map((link) => {
          if (typeof link === 'string') {
            const match = mapLinks.find((candidate) => candidate.id === link);
            if (match) {
              return match;
            }
            return null;
          }
          return link;
        })
        .filter((link) => !!link);
    } else {
      mapLinks.sort((a, b) => {
        const prioA = types.indexOf(a.rel);
        const prioB = types.indexOf(b.rel);
        return prioA - prioB;
      });
    }
    return mapLinks;
  }

  /**
   * Update the assets to be rendered.
   * @param {Array<string|Asset>|null} assets The assets to show.
   * @return {Promise} Resolves when all assets are rendered.
   * @api
   */
  async setAssets(assets) {
    if (assets === this.assets_) {
      return;
    }
    if (Array.isArray(assets)) {
      const data = this.getData();
      this.assets_ = assets.map((asset) => {
        if (data instanceof STAC && typeof asset === 'string') {
          return data.getAsset(asset);
        }
        if (!(asset instanceof Asset)) {
          return new Asset(asset);
        }
        return asset;
      });
    } else {
      this.assets_ = null;
    }
    await this.updateLayers_();
  }

  /**
   * Updates the children STAC entities to be rendered.
   *
   * If an object is passed, it must be a GeoJSON FeatureCollection.
   *
   * @param {ItemCollection|Object|Array<STAC|Object>|null} childs The children to show.
   * @param {Options|null} [options=null] Optionally, new STACLayer options for the children. Only applies if `children` are given.
   * @return {Promise} Resolves when all items are rendered.
   * @api
   */
  async setChildren(childs, options = null) {
    if (childs instanceof ItemCollection) {
      this.children_ = childs.getAll();
    } else if (isObject(childs) && childs.type === 'FeatureCollection') {
      this.children_ = create(childs, !this.disableMigration_).getAll();
    } else if (Array.isArray(childs)) {
      this.children_ = childs.map((child) => {
        if (child instanceof STAC) {
          return child;
        }
        return create(child, !this.disableMigration_);
      });
    } else {
      this.children_ = null; // Invalid input
    }
    if (this.children_ && this.children_.length === 0) {
      this.children_ = null;
    }
    if (this.children_ && isObject(options)) {
      this.childrenOptions_ = options;
    }
    await this.updateLayers_();
  }

  /**
   * Get the STAC object.
   *
   * @return {STAC|Asset} The STAC object.
   * @api
   */
  getData() {
    return this.get('stac');
  }

  /**
   * Get the children STAC entities.
   *
   * @return {Array<STAC>} The STAC child entities.
   * @api
   */
  getChildren() {
    return this.children_;
  }

  /**
   * Get the STAC assets shown.
   *
   * @return {Array<Asset>} The STAC assets.
   * @api
   */
  getAssets() {
    return this.assets_;
  }

  /**
   * Get the extent of the layer.
   * If `displayFootprint` is set to `false`, the extent is always returned in
   * EPSG:4326 instead of the map projection. Make sure to transform it with the
   * ol.proj.transformExtent function if needed.
   *
   * @return {Extent|undefined} The layer extent.
   * @api
   */
  getExtent() {
    if (!this.map_) {
      return;
    }

    const view = this.map_.getView();
    if (!view) {
      return;
    }

    // todo: In general it might be better to get the actual extent of the layers/sources.
    // Unfortunately, the extent is requested before it is available
    // at least for the footprint layer due to the use of the GeoJSON loader.
    // So we stick to the bounding box of the STAC entity for now,
    // which sometimes is too small.
    // See https://github.com/radiantearth/stac-browser/issues/634 for details.

    let bbox;
    const data = this.getData();
    if (data) {
      bbox = data.getBoundingBox();
    }

    const items = this.getChildren();
    if (items) {
      const bboxes = items.map((item) => item.getBoundingBox());
      bbox = unionBoundingBox(bboxes);
    }

    if (bbox) {
      return transformExtent(bbox, 'EPSG:4326', view.getProjection());
    }
  }

  getLayerState() {
    const state = super.getLayerState();
    // Fixes the issue that the view is clipped based on the extent of the layer.
    // The extent is usually the bbox, but sometimes there are even items outside of the bbox.
    // See https://github.com/radiantearth/stac-browser/issues/634 for details.
    state.extent = undefined;
    return state;
  }

  /**
   * Get the attributions of the STAC entity assigned to this layer.
   *
   * @return {Array<string>} Attributions for this layer.
   * @api
   */
  getAttributions() {
    const attribution = [];
    const stac = this.getData();
    if (stac) {
      const attribution = stac.getMetadata('attribution');
      if (attribution) {
        attribution.push(attribution);
      }
    }
    return attribution;
  }

  /**
   * Get the layer source.
   * @return {SourceType|null} The layer source (or `null` if not yet set).
   */
  getSource() {
    return null;
  }

  /**
   * Gets the WMTS capabilities from the given web-map-links URL.
   * @param {string} url Base URL for the WMTS
   * @return {Promise<Object|null>} Resolves with the WMTS Capabilities object
   * @private
   */
  async getWmtsCapabilities_(url) {
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.set('service', 'wmts');
      urlObj.searchParams.set('request', 'GetCapabilities');
      const response = await this.fetch_(urlObj.toString(), 'text');
      return new WMTSCapabilities().read(response);
    } catch (error) {
      return null;
    }
  }
}

export default STACLayer;

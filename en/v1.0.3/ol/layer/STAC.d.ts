export default STACLayer;
export type Extent = import("ol/extent.js").Extent;
export type Layer = import("ol/layer/Layer.js").default;
export type Link = any;
export type Map = import("ol/Map.js").default;
export type Style = import('ol/style/Style.js').default;
export type SourceOptions = import('../source/type.js').SourceOptions;
export type Options = {
    /**
     * The STAC URL. Any of `url` and `data` must be provided.
     * Can also be used as url for data, if it is absolute and doesn't contain a self link.
     * Don't use this is you pass in a stac-js object as `data`, set the url manually through
     * `setAbsoluteUrl` on the stac-js object before passing it in.
     */
    url?: string | undefined;
    /**
     * The STAC metadata. Any of `url` and `data` must be provided.
     * `data` take precedence over `url`.
     */
    data?: STAC | Asset | any;
    /**
     * For STAC Catalogs and Collections, any child entites
     * to show. Can be STAC ItemCollections (as ItemCollection or GeoJSON FeatureCollection) or a list of STAC entities.
     */
    children?: ItemCollection | any | Array<STAC | any> | null;
    /**
     * The the given children, apply the given options.
     */
    childrenOptions?: Options | undefined;
    /**
     * The selector for the assets to be rendered,
     * only for STAC Items and Collections.
     * This can be an array of strings corresponding to asset keys or Asset objects.
     * null shows the default asset, an empty array shows no asset.
     */
    assets?: any[] | null | undefined;
    /**
     * The (one-based) bands to show.
     */
    bands?: number[] | undefined;
    /**
     * Optional function that can be used to configure the underlying sources. The function can do any additional work
     * and return the completed options or a promise for the same. The function will be called with the current source options
     * and the STAC Asset or Link.
     * This can be useful for adding auth information such as an API token, either via query parameter or HTTP headers.
     * Please be aware that sending HTTP headers may not be supported by all sources.
     */
    getSourceOptions?: ((arg0: SourceType, arg1: SourceOptions, arg2: (Asset | Link)) => (SourceOptions | Promise<SourceOptions>)) | undefined;
    /**
     * Allows to hide the footprints (bounding box/geometry) of the STAC object
     * by default.
     */
    displayFootprint?: boolean | undefined;
    /**
     * Allow to choose non-cloud-optimized GeoTiffs as default image to show,
     * which might not work well for larger files or larger amounts of files.
     */
    displayGeoTiffByDefault?: boolean | undefined;
    /**
     * Allow to display preview images that a browser can display (e.g. PNG, JPEG),
     * i.e. assets with any of the roles `thumbnail`, `overview`, or a link with relation type `preview`.
     * The previews are usually not covering the full extents and as such may be placed incorrectly on the map.
     * For performance reasons, it is recommended to enable this option if you pass in STAC API Items instead of `displayOverview`.
     */
    displayPreview?: boolean | undefined;
    /**
     * Allow to display COGs and, if `displayGeoTiffByDefault` is enabled, GeoTiffs,
     * usually an asset with role `overview` or `visual`.
     */
    displayOverview?: boolean | undefined;
    /**
     * Allow to display a layer
     * based on the information provided through the web map links extension.
     * If an array of links or link ids (property `id` in a Link Object) is provided, all corresponding layers will be shown.
     * If set to true or to a specific type of web map link (`pmtiles`, `tilejson`, `wms`, `wmts`, `xyz`),
     * it lets this library choose a web map link to show, but only if no other data is shown.
     * To disable the functionality set this to `false`.
     */
    displayWebMapLink?: string | boolean | any[] | undefined;
    /**
     * The style for the overall bounds / footprint.
     */
    boundsStyle?: import("ol/style/Style.js").default | undefined;
    /**
     * The style for individual children in a list of STAC Items or Collections.
     */
    collectionStyle?: import("ol/style/Style.js").default | undefined;
    /**
     * For thumbnails: The `crossOrigin` attribute for loaded images / tiles.
     * See https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image for more detail.
     */
    crossOrigin?: string | null | undefined;
    /**
     * A function that generates a URL template for a tile server (XYZ),
     * which will be used instead of the client-side GeoTIFF rendering (except if `useTileLayerAsFallback` is `true`).
     * The function provided can return a promise (i.e. be async) or a string.
     */
    buildTileUrlTemplate?: ((arg0: (Asset | Link)) => Promise<string> | string | null) | undefined;
    /**
     * Uses the given URL template only when the client-side GeoTIFF rendering fails.
     */
    useTileLayerAsFallback?: boolean | undefined;
    /**
     * Opacity (0, 1).
     */
    opacity?: number | undefined;
    /**
     * Visibility.
     */
    visible?: boolean | undefined;
    /**
     * The bounding extent for layer rendering.  The layer will not be
     * rendered outside of this extent.
     */
    extent?: import("ol/extent.js").Extent | undefined;
    /**
     * The z-index for layer rendering.  At rendering time, the layers
     * will be ordered, first by Z-index and then by position. When `undefined`, a `zIndex` of 0 is assumed
     * for layers that are added to the map's `layers` collection, or `Infinity` when the layer's `setMap()`
     * method was used.
     */
    zIndex?: number | undefined;
    /**
     * The minimum resolution (inclusive) at which this layer will be
     * visible.
     */
    minResolution?: number | undefined;
    /**
     * The maximum resolution (exclusive) below which this layer will
     * be visible.
     */
    maxResolution?: number | undefined;
    /**
     * The minimum view zoom level (exclusive) above which this layer will be
     * visible.
     */
    minZoom?: number | undefined;
    /**
     * The maximum view zoom level (inclusive) at which this layer will
     * be visible.
     */
    maxZoom?: number | undefined;
    /**
     * Arbitrary observable properties. Can be accessed with `#get()` and `#set()`. `stac` and `bounds` are reserved and may be overridden.
     */
    properties?: {
        [x: string]: any;
    } | undefined;
    /**
     * Disable the migration of the STAC object to the latest version.
     * Only enable this if you are sure that the STAC object is already in the latest version.
     */
    disableMigration?: boolean | undefined;
    /**
     * Sets a custom function to make HTTP requests with.
     * The first parameter is the URL to request and the output is a promise that resolves with the response body.
     * The second parameter is the return type, either `json` (default) or `text`.
     */
    httpRequestFn?: ((arg0: string, arg1: string) => (any)) | undefined;
};
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
declare class STACLayer extends LayerGroup {
    /**
     * @param {Options} options Layer options.
     * @api
     */
    constructor(options: Options);
    /**
     * @type {function(SourceType, SourceOptions, (Asset|Link)):(SourceOptions|Promise<SourceOptions>)}
     * @private
     */
    private getSourceOptions_;
    /**
     * @type {Array<STAC>|null}
     * @private
     */
    private children_;
    /**
     * @type {Options}
     * @private
     */
    private childrenOptions_;
    /**
     * @type {Array<Asset>|null}
     * @private
     */
    private assets_;
    /**
     * @type {Array<number>}
     * @private
     */
    private bands_;
    /**
     * @type {string|null}
     * @private
     */
    private crossOrigin_;
    /**
     * @type {boolean}
     * @private
     */
    private displayFootprint_;
    /**
     * @type {boolean}
     * @private
     */
    private displayGeoTiffByDefault_;
    /**
     * @type {boolean}
     * @private
     */
    private displayPreview_;
    /**
     * @type {boolean}
     * @private
     */
    private displayOverview_;
    /**
     * @type {string|boolean|Array<Link|string>}
     */
    displayWebMapLink_: string | boolean | Array<Link | string>;
    /**
     * @type {function((Asset|Link)):Promise<string>|string|null}
     * @private
     */
    private buildTileUrlTemplate_;
    /**
     * @type {boolean}
     * @private
     */
    private useTileLayerAsFallback_;
    /**
     * @type {Style}
     * @private
     */
    private boundsStyle_;
    /**
     * @type {Style}
     * @private
     */
    private collectionStyle_;
    /**
     * @type {VectorLayer|null}
     * @private
     */
    private boundsLayer_;
    /**
     * @type {boolean}
     * @private
     */
    private disableMigration_;
    /**
     * @type {Map|null}
     * @private
     */
    private map_;
    /**
     * @type {Array<string|ErrorEvent>}
     * @private
     */
    private eventQueue_;
    /**
     * Default function make HTTP requests with.
     *
     * @param {string} url The URL to request and the output is a promise that resolves with the response body.
     * @param {string} responseType The return type, either `json` (default) or `text`.
     * @return {Promise<*>} The (parsed) response body.
     */
    fetch_(url: string, responseType?: string): Promise<any>;
    /**
     * Returns the vector layer that visualizes the bounds / footprint.
     * @return {VectorLayer|null} The vector layer for the bounds
     * @api
     */
    getBoundsLayer(): VectorLayer | null;
    /**
     * Returns `true` if the layer shows nothing.
     *
     * This method should be called after the layersready event only.
     *
     * @return {boolean} Is the layer empty?
     * @api
     */
    isEmpty(): boolean;
    /**
     * @param {Error} error The error.
     * @private
     */
    private handleError_;
    /**
     * @param {STAC|Asset|Object} data The STAC data.
     * @param {string} url The url to the data.
     * @param {ItemCollection|Object|Array<STAC>|string|null} children The child STAC entities to show.
     * @param {Array<Asset|string>|null} assets The assets to show.
     * @param {Array<number>} bands The (one-based) bands to show.
     * @private
     */
    private configure_;
    /**
     * Dispatch an event.
     * Move it to the queue if the map is not yet set.
     * This is necessary as otherwise some events would be
     * dispatched before someone could listen to them.
     *
     * @param {string|ErrorEvent} event The event.
     * @private
     */
    private dispatch_;
    /**
     * Flush all events.
     * @private
     */
    private flush_;
    /**
     * Set the map and flush all events.
     * The events should only be flushed once the map is set, otherwise some
     * functions such as getExtent() return no meaningul values.
     *
     * @param {Map} map The map
     */
    setMap_(map: Map): void;
    /**
     * @param {Array<STAC>} collection The list of STAC entities to show.
     * @param {Options} [options] Options for the children.
     * @return {Promise} Resolves when complete.
     * @private
     */
    private addChildren_;
    /**
     * @param {Asset|Link} [image] A STAC Link or Asset
     * @return {Promise<ImageLayer|undefined>} Resolves with am ImageLayer or udnefined when complete.
     * @private
     */
    private addPreviewImage_;
    /**
     * Adds a layer for a link that implements the web-map-links extension.
     * Supports: PMTiles, TileJSON, WMS, WMTS, XYZ
     * @see https://github.com/stac-extensions/web-map-links
     * @param {Link} link A web map link
     * @return {Promise<Array<Layer>|undefined>} Resolves with a list of layers or undefined when complete.
     * @api
     */
    addLayerForLink(link: any): Promise<Array<Layer> | undefined>;
    /**
     * @param {Asset} [asset] A STAC Asset
     * @return {Promise<Layer|undefined>} Resolves with a Layer or undefined when complete.
     * @private
     */
    private addGeoTiff_;
    /**
     * @param {Asset|Link} [data] A STAC Asset or Link
     * @return {Promise<TileLayer>} Resolves with a TileLayer when complete.
     * @private
     */
    private addTileLayerForImagery_;
    /**
     * @param {Layer|LayerGroup} [layer] A Layer to add to the LayerGroup
     * @param {import("stac-js").STACObject} [data] The STAC object, can be any class exposed by stac-js
     * @param {number} [zIndex=0] The z-index for the layer
     * @private
     */
    private addLayer_;
    /**
     * @return {VectorLayer|null} The vector layer showing the geometry/bbox.
     * @private
     */
    private addFootprint_;
    /**
     * @param {Asset} [asset] A STAC Asset
     * @return {Promise<Layer|undefined>} Resolves with a Layer or undefined when complete.
     * @private
     */
    private addGeoJson_;
    /**
     * Creates a GeoJSON vector layer from the given GeoJSON object.
     *
     * @param {GeoJSON} [geojson] The GeoJSON object.
     * @param {Style} [style] The style for the layer.
     * @param {boolean} [visible] Whether the layer is visible.
     * @return {VectorLayer} The new vector layer.
     * @private
     */
    private createGeoJsonLayer_;
    /**
     * Adds GeoJSON labels and GeoTIFF source imagery to the map based on the label extension.
     *
     * @return {Promise<Layer|undefined>} The layer added to the map.
     * @private
     */
    private addLabelExtension_;
    /**
     * @private
     */
    private updateLayers_;
    /**
     * Indicates whether the LayerGroup shows only the bounds layer (i.e. no imagery/tile layers).
     * @return {boolean} `true` if only the bounds layer is shown, `false` otherwise.
     * @api
     */
    hasOnlyBounds(): boolean;
    /**
     * Returns all potential web map links based on the given value for `displayWebMapLink`.
     * @return {Array<Link>} An array of links.
     * @api
     */
    getWebMapLinks(): Array<Link>;
    /**
     * Update the assets to be rendered.
     * @param {Array<string|Asset>|null} assets The assets to show.
     * @return {Promise} Resolves when all assets are rendered.
     * @api
     */
    setAssets(assets: Array<string | Asset> | null): Promise<any>;
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
    setChildren(childs: ItemCollection | any | Array<STAC | any> | null, options?: Options | null | undefined): Promise<any>;
    /**
     * Get the STAC object.
     *
     * @return {STAC|Asset} The STAC object.
     * @api
     */
    getData(): STAC | Asset;
    /**
     * Get the children STAC entities.
     *
     * @return {Array<STAC>} The STAC child entities.
     * @api
     */
    getChildren(): Array<STAC>;
    /**
     * Get the STAC assets shown.
     *
     * @return {Array<Asset>} The STAC assets.
     * @api
     */
    getAssets(): Array<Asset>;
    getLayerState(): import("ol/layer/Layer.js").State;
    /**
     * Get the attributions of the STAC entity assigned to this layer.
     *
     * @return {Array<string>} Attributions for this layer.
     * @api
     */
    getAttributions(): Array<string>;
    /**
     * Get the layer source.
     * @return {SourceType|null} The layer source (or `null` if not yet set).
     */
    getSource(): SourceType | null;
    /**
     * Gets the WMTS capabilities from the given web-map-links URL.
     * @param {string} url Base URL for the WMTS
     * @return {Promise<Object|null>} Resolves with the WMTS Capabilities object
     * @private
     */
    private getWmtsCapabilities_;
}
import SourceType from '../source/type.js';
import LayerGroup from 'ol/layer/Group.js';
import VectorLayer from 'ol/layer/Vector.js';
//# sourceMappingURL=STAC.d.ts.map
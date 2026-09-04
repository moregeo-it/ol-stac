export default STACLayer;
export type Extent = import("ol/extent.js").Extent;
export type Layer = import("ol/layer/Layer.js").default;
export type APICollection = any;
export type Link = any;
export type STAC = any;
export type STACObject = any;
export type Map = import("ol/Map.js").default;
export type Style = import("ol/style/Style.js").default;
export type SourceOptions = import("../source/type.js").SourceOptions;
export type LayerOptions = import("./type.js").LayerOptions;
export type GetHeadersFn = import("../http.js").GetHeadersFn;
export type OnErrorFn = import("../http.js").OnErrorFn;
export type LoadFunction = (arg0: (import("ol/Image.js").default | import("ol/Tile.js").default), arg1: string) => void;
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
    children?: APICollection | any | Array<STAC | any> | null;
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
     * The bands to show. One-based index of the band, or the name of the band.
     */
    bands?: (string | number)[] | undefined;
    /**
     * Optional function that can be used to configure the underlying sources. The function can do any additional work
     * and return the completed options or a promise for the same. The function will be called with the current source options
     * and the STAC Asset or Link.
     * This can be useful for advanced per-source customization such as signed URLs.
     * To add credentials via query parameters, use the `getRequestUrl` option instead;
     * to send credentials via HTTP headers, use the `getRequestHeaders` option instead.
     */
    getSourceOptions?: ((arg0: SourceType, arg1: SourceOptions, arg2: (Asset | Link)) => (SourceOptions | Promise<SourceOptions>)) | undefined;
    /**
     * Optional function that can be used to configure the individual layers that are created for the assets and links.
     * The function can do any additional (asynchronous) work and return the completed options or a promise for the same.
     * The function will be called with the layer type, the current layer options and the STAC Asset or Link.
     * This can be useful to customize the layers, e.g. to apply a style to a GeoTIFF or GeoZarr layer that is
     * loaded from the STAC metadata.
     */
    getLayerOptions?: ((arg0: LayerType, arg1: LayerOptions, arg2: (Asset | Link)) => (LayerOptions | Promise<LayerOptions>)) | undefined;
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
     * Allow to display COGs, Zarr and, if `displayGeoTiffByDefault` is enabled, GeoTiffs,
     * usually an asset with role `overview` or `visual`.
     * Zarr assets other than Web-Optimized Zarr are only displayed if the STAC metadata declares what to render
     * (see the datacube extension) and the store is within the `maxDisplayPixels` limit.
     */
    displayOverview?: boolean | undefined;
    /**
     * The maximum number of pixels the coarsest resolution level
     * of a GeoTIFF or Zarr asset may have to be displayed client-side, as displaying the full extent of an asset
     * loads every tile of that level. Files without (sufficient) overviews can easily exceed this limit.
     * Larger assets are not chosen for the default visualization, and selecting one explicitly through `assets`
     * reports an error through the `error` event (or renders through the tile server if `buildTileUrlTemplate`
     * and `useTileLayerAsFallback` are set). Set to `Infinity` to display assets of any size.
     */
    maxDisplayPixels?: number | undefined;
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
     * The style for GeoTIFF and GeoZarr layers (WebGLTileLayer style).
     */
    style?: import("ol/layer/WebGLTile.js").Style | null | undefined;
    /**
     * The colors of the colormap
     * that is used for continuous single-band data when neither the STAC metadata nor the `style` option define
     * a coloring. The colors are evenly distributed over the value range of the data (e.g. from the STAC
     * `statistics`). If not set, the data is stretched to grayscale.
     */
    defaultColormap?: (string | import("ol/color.js").Color)[] | null | undefined;
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
     * The function can return `null` to not pass the given asset or link to the tile server,
     * e.g. to filter by media type or protocol. In this case client-side rendering is used instead.
     */
    buildTileUrlTemplate?: ((arg0: (Asset | Link)) => Promise<string | null> | string | null) | undefined;
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
     * The STAC Asset or Link the request is made for is passed as third parameter, if available.
     */
    httpRequestFn?: ((arg0: string, arg1: string) => (any)) | undefined;
    /**
     * The HTTP headers (e.g. for authentication) to send with the requests made by this layer,
     * either as a plain object or as a function that returns the headers (or `null` for none) and
     * is called with the STAC Asset or Link that is shown (if available) and the URL that is requested.
     * Use a function to restrict the headers to specific hosts, as tile server URLs and asset URLs
     * may point to hosts that should not receive the credentials.
     * The headers are attached to requests made by the default `httpRequestFn`, to GeoTIFF, GeoZarr
     * and PMTiles requests, and via image/tile load functions (through the Fetch API and object URLs)
     * to preview images and XYZ, TileJSON, WMS and WMTS tiles.
     */
    getRequestHeaders?: {
        [x: string]: string;
    } | ((arg0: (Asset | Link | STACObject | null), arg1: string) => ({
        [x: string]: string;
    } | null)) | undefined;
    /**
     * Rewrites a URL before a request is made or a source is created, e.g. to append query
     * parameters for authentication (signed URLs, API keys). The function is called with the
     * STAC Asset or Link that is shown (if available), the URL, and whether the URL is a
     * tile URL template. It returns the new URL or `null` to keep the URL unchanged.
     * The rewrite is applied to the initial source URL before `getSourceOptions` is called;
     * templates discovered in fetched documents (TileJSON manifests, WMTS capabilities) are
     * rewritten afterwards and are not passed to `getSourceOptions`.
     * For tiled sources the tile URL template is rewritten, not the individual tile URLs.
     * URL templates originate from XYZ web map links, TileJSON manifests, WMTS links
     * (`uriTemplate`) and capabilities, and `buildTileUrlTemplate`. The returned URL must keep
     * the template placeholders such as `{z}` unchanged, i.e. they must not be percent-encoded
     * (e.g. through URL normalization).
     */
    getRequestUrl?: ((arg0: (Asset | Link | STACObject | null), arg1: string, arg2: boolean) => (string | null)) | undefined;
};
/**
 * @typedef {import("ol/extent.js").Extent} Extent
 */
/**
 * @typedef {import("ol/layer/Layer.js").default} Layer
 */
/**
 * @typedef {import('stac-js').APICollection} APICollection
 */
/**
 * @typedef {import("stac-js").Link} Link
 */
/**
 * @typedef {import('stac-js').STAC} STAC
 */
/**
 * @typedef {import('stac-js').STACObject} STACObject
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
 * @typedef {import('./type.js').LayerOptions} LayerOptions
 */
/**
 * @typedef {import('../http.js').GetHeadersFn} GetHeadersFn
 */
/**
 * @typedef {import('../http.js').OnErrorFn} OnErrorFn
 */
/**
 * @typedef {function((import("ol/Image.js").default|import("ol/Tile.js").default), string): void} LoadFunction
 */
/**
 * @typedef {Object} Options
 * @property {string} [url] The STAC URL. Any of `url` and `data` must be provided.
 * Can also be used as url for data, if it is absolute and doesn't contain a self link.
 * Don't use this is you pass in a stac-js object as `data`, set the url manually through
 * `setAbsoluteUrl` on the stac-js object before passing it in.
 * @property {STAC|Asset|Object} [data] The STAC metadata. Any of `url` and `data` must be provided.
 * `data` take precedence over `url`.
 * @property {APICollection|Object|Array<STAC|Object>|null} [children=null] For STAC Catalogs and Collections, any child entites
 * to show. Can be STAC ItemCollections (as ItemCollection or GeoJSON FeatureCollection) or a list of STAC entities.
 * @property {Options} [childrenOptions={}] The the given children, apply the given options.
 * @property {Array<string|Asset>|null} [assets=null] The selector for the assets to be rendered,
 * only for STAC Items and Collections.
 * This can be an array of strings corresponding to asset keys or Asset objects.
 * null shows the default asset, an empty array shows no asset.
 * @property {Array<number|string>} [bands] The bands to show. One-based index of the band, or the name of the band.
 * @property {function(SourceType, SourceOptions, (Asset|Link)):(SourceOptions|Promise<SourceOptions>)} [getSourceOptions]
 * Optional function that can be used to configure the underlying sources. The function can do any additional work
 * and return the completed options or a promise for the same. The function will be called with the current source options
 * and the STAC Asset or Link.
 * This can be useful for advanced per-source customization such as signed URLs.
 * To add credentials via query parameters, use the `getRequestUrl` option instead;
 * to send credentials via HTTP headers, use the `getRequestHeaders` option instead.
 * @property {function(LayerType, LayerOptions, (Asset|Link)):(LayerOptions|Promise<LayerOptions>)} [getLayerOptions]
 * Optional function that can be used to configure the individual layers that are created for the assets and links.
 * The function can do any additional (asynchronous) work and return the completed options or a promise for the same.
 * The function will be called with the layer type, the current layer options and the STAC Asset or Link.
 * This can be useful to customize the layers, e.g. to apply a style to a GeoTIFF or GeoZarr layer that is
 * loaded from the STAC metadata.
 * @property {boolean} [displayFootprint=true] Allows to hide the footprints (bounding box/geometry) of the STAC object
 * by default.
 * @property {boolean} [displayGeoTiffByDefault=false] Allow to choose non-cloud-optimized GeoTiffs as default image to show,
 * which might not work well for larger files or larger amounts of files.
 * @property {boolean} [displayPreview=false] Allow to display preview images that a browser can display (e.g. PNG, JPEG),
 * i.e. assets with any of the roles `thumbnail`, `overview`, or a link with relation type `preview`.
 * The previews are usually not covering the full extents and as such may be placed incorrectly on the map.
 * For performance reasons, it is recommended to enable this option if you pass in STAC API Items instead of `displayOverview`.
 * @property {boolean} [displayOverview=true] Allow to display COGs, Zarr and, if `displayGeoTiffByDefault` is enabled, GeoTiffs,
 * usually an asset with role `overview` or `visual`.
 * Zarr assets other than Web-Optimized Zarr are only displayed if the STAC metadata declares what to render
 * (see the datacube extension) and the store is within the `maxDisplayPixels` limit.
 * @property {number} [maxDisplayPixels=16777216] The maximum number of pixels the coarsest resolution level
 * of a GeoTIFF or Zarr asset may have to be displayed client-side, as displaying the full extent of an asset
 * loads every tile of that level. Files without (sufficient) overviews can easily exceed this limit.
 * Larger assets are not chosen for the default visualization, and selecting one explicitly through `assets`
 * reports an error through the `error` event (or renders through the tile server if `buildTileUrlTemplate`
 * and `useTileLayerAsFallback` are set). Set to `Infinity` to display assets of any size.
 * @property {string|boolean|Array<Link|string>} [displayWebMapLink=false] Allow to display a layer
 * based on the information provided through the web map links extension.
 * If an array of links or link ids (property `id` in a Link Object) is provided, all corresponding layers will be shown.
 * If set to true or to a specific type of web map link (`pmtiles`, `tilejson`, `wms`, `wmts`, `xyz`),
 * it lets this library choose a web map link to show, but only if no other data is shown.
 * To disable the functionality set this to `false`.
 * @property {import("ol/layer/WebGLTile.js").Style|null} [style=null] The style for GeoTIFF and GeoZarr layers (WebGLTileLayer style).
 * @property {Array<import("ol/color.js").Color|string>|null} [defaultColormap=null] The colors of the colormap
 * that is used for continuous single-band data when neither the STAC metadata nor the `style` option define
 * a coloring. The colors are evenly distributed over the value range of the data (e.g. from the STAC
 * `statistics`). If not set, the data is stretched to grayscale.
 * @property {Style} [boundsStyle] The style for the overall bounds / footprint.
 * @property {Style} [collectionStyle] The style for individual children in a list of STAC Items or Collections.
 * @property {null|string} [crossOrigin] For thumbnails: The `crossOrigin` attribute for loaded images / tiles.
 * See https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image for more detail.
 * @property {function((Asset|Link)):Promise<string|null>|string|null} [buildTileUrlTemplate=null] A function that generates a URL template for a tile server (XYZ),
 * which will be used instead of the client-side GeoTIFF rendering (except if `useTileLayerAsFallback` is `true`).
 * The function provided can return a promise (i.e. be async) or a string.
 * The function can return `null` to not pass the given asset or link to the tile server,
 * e.g. to filter by media type or protocol. In this case client-side rendering is used instead.
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
 * The STAC Asset or Link the request is made for is passed as third parameter, if available.
 * @property {Object<string, string>|function((Asset|Link|STACObject|null), string):(Object<string, string>|null)} [getRequestHeaders=null]
 * The HTTP headers (e.g. for authentication) to send with the requests made by this layer,
 * either as a plain object or as a function that returns the headers (or `null` for none) and
 * is called with the STAC Asset or Link that is shown (if available) and the URL that is requested.
 * Use a function to restrict the headers to specific hosts, as tile server URLs and asset URLs
 * may point to hosts that should not receive the credentials.
 * The headers are attached to requests made by the default `httpRequestFn`, to GeoTIFF, GeoZarr
 * and PMTiles requests, and via image/tile load functions (through the Fetch API and object URLs)
 * to preview images and XYZ, TileJSON, WMS and WMTS tiles.
 * @property {function((Asset|Link|STACObject|null), string, boolean):(string|null)} [getRequestUrl=null]
 * Rewrites a URL before a request is made or a source is created, e.g. to append query
 * parameters for authentication (signed URLs, API keys). The function is called with the
 * STAC Asset or Link that is shown (if available), the URL, and whether the URL is a
 * tile URL template. It returns the new URL or `null` to keep the URL unchanged.
 * The rewrite is applied to the initial source URL before `getSourceOptions` is called;
 * templates discovered in fetched documents (TileJSON manifests, WMTS capabilities) are
 * rewritten afterwards and are not passed to `getSourceOptions`.
 * For tiled sources the tile URL template is rewritten, not the individual tile URLs.
 * URL templates originate from XYZ web map links, TileJSON manifests, WMTS links
 * (`uriTemplate`) and capabilities, and `buildTileUrlTemplate`. The returned URL must keep
 * the template placeholders such as `{z}` unchanged, i.e. they must not be percent-encoded
 * (e.g. through URL normalization).
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
     * @type {function(LayerType, LayerOptions, (Asset|Link)):(LayerOptions|Promise<LayerOptions>)}
     * @private
     */
    private getLayerOptions_;
    /**
     * @type {Object<string, string>|function((Asset|Link|STACObject|null), string):(Object<string, string>|null)|null}
     * @private
     */
    private getRequestHeaders_;
    /**
     * @type {function((Asset|Link|STACObject|null), string, boolean):(string|null)|null}
     * @private
     */
    private getRequestUrl_;
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
     * @type {Array<number|string>}
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
     * @type {number|undefined}
     * @private
     */
    private maxDisplayPixels_;
    /**
     * @type {function((Asset|Link)):Promise<string|null>|string|null}
     * @private
     */
    private buildTileUrlTemplate_;
    /**
     * @type {boolean}
     * @private
     */
    private useTileLayerAsFallback_;
    /**
     * @type {import("ol/layer/WebGLTile.js").Style|null}
     * @private
     */
    private style_;
    /**
     * @type {Array<import("ol/color.js").Color|string>|null}
     * @private
     */
    private defaultColormap_;
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
     * @param {Asset|Link|STACObject|null} [ref] The STAC Asset or Link the request is made for, if available.
     * @return {Promise<*>} The (parsed) response body.
     */
    fetch_(url: string, responseType?: string, ref?: Asset | Link | STACObject | null): Promise<any>;
    /**
     * Rewrites the given URL based on the `getRequestUrl` option.
     *
     * @param {string} url The URL that is requested.
     * @param {Asset|Link|STACObject|null} [ref] The STAC Asset or Link that is shown, if available.
     * @param {boolean} [isTemplate] Whether the URL is a tile URL template with placeholders such as `{z}`.
     * @return {string} The rewritten URL, or the given URL if it is not rewritten.
     */
    getRequestUrlFor_(url: string, ref?: Asset | Link | STACObject | null, isTemplate?: boolean): string;
    /**
     * Returns the HTTP headers to send for the given URL, based on the
     * `getRequestHeaders` option.
     *
     * @param {string} url The URL that is requested.
     * @param {Asset|Link|STACObject|null} [ref] The STAC Asset or Link that is shown, if available.
     * @return {Object<string, string>|null} The headers, or `null` if there are none.
     */
    getRequestHeadersFor_(url: string, ref?: Asset | Link | STACObject | null): {
        [x: string]: string;
    } | null;
    /**
     * Creates a load function for images or tiles that attaches the headers
     * from the `getRequestHeaders` option and reports errors through the
     * layer's error event, or `undefined` if no headers are configured.
     *
     * @param {function(GetHeadersFn, OnErrorFn=):LoadFunction} factory `createImageLoadFunction` or `createTileLoadFunction`.
     * @param {Asset|Link|STACObject|null} ref The STAC Asset or Link that is shown, if available.
     * @return {LoadFunction|undefined} The load function.
     */
    createLoadFunction_(factory: (arg0: GetHeadersFn, arg1: OnErrorFn | undefined) => LoadFunction, ref: Asset | Link | STACObject | null): LoadFunction | undefined;
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
     * @param {APICollection|Object|Array<STAC>|string|null} children The child STAC entities to show.
     * @param {Array<Asset|string>|null} assets The assets to show.
     * @param {Array<number|string>} bands The bands to show.
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
    addLayerForLink(link: Link): Promise<Array<Layer> | undefined>;
    /**
     * @param {Asset} [asset] A STAC Asset
     * @param {boolean} [autoDisplay] Whether the asset was chosen automatically
     * (not explicitly requested): skip it silently instead of reporting an
     * error when it can't be displayed within the configured limits.
     * @return {Promise<Layer|undefined>} Resolves with a Layer or undefined when complete.
     * @private
     */
    private addGeoTiff_;
    /**
     * @param {Asset|Link} [data] A STAC Asset or Link
     * @return {Promise<TileLayer|undefined>} Resolves with a TileLayer, or undefined if no tile server URL was provided.
     * @private
     */
    private addTileLayerForImagery_;
    /**
     * Passes the layer options through the `getLayerOptions` function, if given.
     *
     * @param {LayerType} type The type of the layer that is going to be created.
     * @param {LayerOptions} options The layer options.
     * @param {Asset|Link} reference The STAC Asset or Link the layer is created for.
     * @return {Promise<*>} The updated layer options.
     * @private
     */
    private updateLayerOptions_;
    /**
     * @param {Layer|LayerGroup} [layer] A Layer to add to the LayerGroup
     * @param {STACObject} [data] The STAC object, can be any class exposed by stac-js
     * @param {number} [zIndex] The z-index for the layer
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
     * Creates the options for a GeoJSON vector layer from the given GeoJSON object.
     *
     * @param {GeoJSON} [geojson] The GeoJSON object.
     * @param {Style} [style] The style for the layer.
     * @param {boolean} [visible] Whether the layer is visible.
     * @return {import("ol/layer/Vector.js").Options} The vector layer options.
     * @private
     */
    private getGeoJsonLayerOptions_;
    /**
     * Adds GeoJSON labels and GeoTIFF source imagery to the map based on the label extension.
     *
     * @return {Promise<Layer|undefined>} The layer added to the map.
     * @private
     */
    private addLabelExtension_;
    /**
     * Checks the `maxDisplayPixels` limit for the given source.
     * Returns `true` when the layer must not be added: automatically chosen
     * assets are limited silently, for explicitly requested assets an error
     * is thrown so that callers can fall back or report it.
     * @param {import('ol/source/Tile.js').default} source The configured (ready) source.
     * @param {Asset} asset The asset the source was created for.
     * @param {boolean} autoDisplay Whether the asset was chosen automatically.
     * @return {boolean} `true` if the asset must not be displayed.
     * @private
     */
    private checkDisplayLimit_;
    /**
     * Adds a layer for a GeoZarr asset.
     * @param {Asset} asset The Zarr asset to show.
     * @param {boolean} [autoDisplay] Whether the asset was chosen automatically
     * (not explicitly requested): skip it silently instead of reporting an
     * error when it doesn't declare what to render or can't be displayed
     * within the configured limits.
     * @return {Promise<Layer|undefined>} The layer, if one was added.
     * @private
     */
    private addGeoZarr_;
    /**
     * Update the layers shown manually based on the current configuration.
     * Usually this doesn't need to be called manually.
     * @param {boolean} [emit] Whether to emit the `layersready` event once the layers are updated.
     * @return {Promise} Resolves once the layers are updated.
     * @api
     */
    updateLayers(emit?: boolean): Promise<any>;
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
     * Set the style for GeoTIFF and GeoZarr layers (WebGLTileLayer style).
     * @param {import("ol/layer/WebGLTile.js").Style|null} style The style to apply.
     * @api
     */
    setStyle(style: import("ol/layer/WebGLTile.js").Style | null): void;
    /**
     * Set the colors of the colormap that is used for continuous single-band
     * data when neither the STAC metadata nor the `style` option define a
     * coloring. The colors are evenly distributed over the value range of the
     * data (e.g. from the STAC `statistics`). Set to `null` to stretch the
     * data to grayscale instead.
     * @param {Array<import("ol/color.js").Color|string>|null} colormap The colors of the colormap.
     * @return {Promise} Resolves once the layers are updated.
     * @api
     */
    setDefaultColormap(colormap: Array<import("ol/color.js").Color | string> | null): Promise<any>;
    /**
     * Update the assets to be rendered.
     * @param {Array<string|Asset>|null} assets The assets to show.
     * @param {boolean} [updateLayers] Whether to update the layers right away.
     * @return {Promise} Resolves when all assets are rendered.
     * @api
     */
    setAssets(assets: Array<string | Asset> | null, updateLayers?: boolean): Promise<any>;
    /**
     * Updates the children STAC entities to be rendered.
     *
     * If an object is passed, it must be a GeoJSON FeatureCollection.
     *
     * @param {APICollection|Object|Array<STAC|Object>|null} childs The children to show.
     * @param {Options|null} [options] Optionally, new STACLayer options for the children. Only applies if `children` are given.
     * @param {boolean} [updateLayers] Whether to update the layers right away.
     * @return {Promise} Resolves when all items are rendered.
     * @api
     */
    setChildren(childs: APICollection | any | Array<STAC | any> | null, options?: Options | null, updateLayers?: boolean): Promise<any>;
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
     * @param {Link} link The web map link the request is made for.
     * @param {string} [encoding] The request encoding, either `kvp` (default) or `rest`.
     * @return {Promise<Object|null>} Resolves with the WMTS Capabilities object
     * @private
     */
    private getWmtsCapabilities_;
}
import SourceType from '../source/type.js';
import LayerType from './type.js';
import LayerGroup from 'ol/layer/Group.js';
import VectorLayer from 'ol/layer/Vector.js';
//# sourceMappingURL=STAC.d.ts.map
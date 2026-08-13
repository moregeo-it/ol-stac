/**
 * Makes a bounding box continuous for use as an (OpenLayers) extent.
 *
 * Bounding boxes that cross the antimeridian have a western longitude that is
 * larger than the eastern longitude (as defined by RFC 7946, section 5.2).
 * For those, the eastern longitude is shifted by +360 so that the extent is
 * continuous across the antimeridian (i.e. `minX <= maxX`).
 *
 * Accepts both 2D (four values) and 3D (six values) bounding boxes and always
 * returns a 2D extent (four values).
 *
 * @param {Array<number>} bbox The bounding box in lon/lat degrees.
 * @return {Array<number>} The continuous 2D bounding box.
 * @api
 */
export function toContinuousBBox(bbox: Array<number>): Array<number>;
/**
 * Converts a lon/lat (EPSG:4326) bounding box into a continuous OpenLayers
 * extent in the given projection.
 *
 * Handles antimeridian-crossing bounding boxes (west > east), see
 * {@link toContinuousBBox}.
 *
 * When fitting an antimeridian-crossing extent, configure the OpenLayers
 * `View` with `multiWorld: true`; otherwise the default world constraint may
 * clamp the fitted view and clip the wrapped portion.
 *
 * @param {Array<number>} bbox The bounding box in lon/lat degrees (EPSG:4326).
 * @param {import("ol/proj.js").ProjectionLike} projection The target projection.
 * @return {Array<number>} The extent in the target projection.
 * @api
 */
export function toOlExtent(bbox: Array<number>, projection: import("ol/proj.js").ProjectionLike): Array<number>;
/**
 * Creates a style for visualization.
 *
 * @param {ColorLike} strokeColor Stroke color
 * @param {number} strokeWidth Stroke with
 * @param {ColorLike} fillColor Fill color
 * @param {number} circleRadius Circle/Point radius
 * @return {Style} The style for visualization.
 * @api
 */
export function getStyle(strokeColor: ColorLike, strokeWidth: number, fillColor?: ColorLike, circleRadius?: number): Style;
/**
 * Get the STAC objects associated with this event, if any. Excludes API Collections.
 * @param {import('ol/MapBrowserEvent.js').default} event The asset to read the information from.
 * @param {STAC} [exclude] Excludes the given STAC entity from the list.
 * @param {Collection<Feature>} [selectedFeatures] A collection to add the selected features to.
 * @param {number} [hitTolerance] The hit tolerance in pixels.
 * @return {Promise<Array<STAC>>} A list of STAC objects
 * @api
 */
export function getStacObjectsForEvent(event: import('ol/MapBrowserEvent.js').default, exclude?: any, selectedFeatures?: import("ol/Collection.js").default<any> | undefined, hitTolerance?: number | undefined): Promise<Array<STAC>>;
/**
 * Get the source info for the GeoTiff from the asset.
 * @param {import('stac-js').Asset} asset The asset to read the information from.
 * @param {Array<number|string>} selectedBands The bands to show. One-based index of the band, or the name of the band.
 * @return {import('ol/source/GeoTIFF.js').SourceInfo} The source info for the GeoTiff asset
 */
export function getGeoTiffSourceInfoFromAsset(asset: any, selectedBands: Array<number | string>): import('ol/source/GeoTIFF.js').SourceInfo;
/**
 * Returns the style for the footprint.
 * Removes the fill if anything is meant to be shown in the bounds.
 *
 * @param {Style} [originalStyle] The original style for the footprint.
 * @param {import('./layer/STAC.js').default} [layerGroup] The associated STAC layergroup to check.
 * @return {Style} The adapted style for the footprint.
 * @api
 */
export function getBoundsStyle(originalStyle?: Style | undefined, layerGroup?: import("./layer/STAC.js").default | undefined): Style;
/**
 * Parse the GeoZarr source options from an asset.
 *
 * If the asset (or its containing Item/Collection) describes the store
 * through the datacube extension (`cube:variables` and `cube:dimensions`),
 * the store is treated as an n-dimensional datacube: the data variable and a
 * selector for its non-spatial dimensions are derived from the metadata.
 * Otherwise, each band is expected to be a separate array in the store,
 * addressed by the band names from the STAC `bands` field.
 *
 * @param {Asset} asset The asset to read the information from.
 * @param {Array<number|string>} selectedBands The bands to show. One-based index of the band, or the name of the band.
 * @return {Object} The GeoZarr source options
 * @api
 */
export function getGeoZarrSourceOptionsFromAsset(asset: any, selectedBands: Array<number | string>): any;
/**
 * Returns the number of pixels of the coarsest resolution level of a
 * configured tile source (e.g. GeoTIFF or GeoZarr). This is the amount of
 * data that displaying the full extent of the asset requires to load.
 * @param {import('ol/source/Tile.js').default} source The configured (ready) source.
 * @return {number} The number of pixels, or `Infinity` if unknown.
 * @api
 */
export function getDisplayPixels(source: import('ol/source/Tile.js').default): number;
/**
 * Checks whether displaying the full extent of a configured tile source at
 * the coarsest available resolution requires excessive tile loads.
 * @param {import('ol/source/Tile.js').default} source The configured (ready) source.
 * @param {number} [maxPixels] The pixel limit for the coarsest resolution level.
 * @return {boolean} `true` if the source exceeds the limit.
 * @api
 */
export function exceedsDisplayLimit(source: import('ol/source/Tile.js').default, maxPixels?: number | undefined): boolean;
/**
 * Returns the render (from the render extension's `renders` field) that
 * applies to the given asset: the first render that lists the asset's key
 * in its `assets` field, or the first render without an `assets` field.
 *
 * @param {Asset} asset The asset to find the render for.
 * @return {Object|null} The render object, or `null`.
 * @api
 */
export function getRenderForAsset(asset: any): any | null;
/**
 * Creates a WebGLTileLayer style for a GeoZarr layer from the STAC metadata.
 *
 * A usable render from the render extension (see {@link isUsableRender})
 * defines the complete visualization: the value range comes from its
 * `rescale` and single-band colors from its `colormap` (see
 * {@link createColormapStyle} for the supported forms).
 *
 * Without a usable render, a default visualization is derived from the
 * general STAC metadata: the value range to stretch comes from the
 * `statistics` of the rendered bands (or the asset), the classification
 * extension (`classification:classes`) provides the coloring for
 * single-band categorical data (not applied to floating point data, which
 * is assumed to be continuous), and continuous data is stretched to
 * grayscale (consistent with single-band COGs).
 *
 * @param {Asset} asset The asset to read the metadata from.
 * @param {Object} sourceOptions The GeoZarr source options (to determine the rendered bands).
 * @return {Object|null} A WebGLTileLayer style, or `null` if the metadata provides none.
 * @api
 */
export function getGeoZarrStyleFromAsset(asset: any, sourceOptions: any): any | null;
/**
 * Get a URL from a web-map-link that is specific enough, i.e.
 * replaces any occurances of {s} if possible, otherwise returns null.
 * @param {import('./layer/STAC.js').Link} link The web map link.
 * @return {string|null} Specific URL
 */
export function getSpecificWebMapUrl(link: any): string | null;
/**
 * Checks whether the given value is a scalar (string, number, boolean).
 * @param {*} value The value to check
 * @return {boolean} `true` is the value is a scalar, `false` otherwise
 */
export function isScalar(value: any): boolean;
/**
 * Returns the `classification:classes` array from a STAC Asset,
 * checking band-level and asset-level metadata.
 *
 * @param {import('stac-js').Asset} asset The STAC asset
 * @param {Array<number>} [bands] The selected bands (one-based)
 * @return {Array<Object>|null} The classification classes, or null
 * @api
 */
export function getClassificationClasses(asset: any, bands?: number[] | undefined): Array<any> | null;
/**
 * Builds a WebGL tile layer style for classified raster data based on
 * `classification:classes` from a STAC Asset.
 *
 * Returns `null` if the asset has no classification classes with color hints.
 *
 * @param {import('stac-js').Asset} asset The STAC asset
 * @param {Array<number>} [bands] The selected bands (one-based)
 * @param {number} [styleBand] The one-based band to style, if it differs
 * from the selected band (e.g. when the source only loads the selected band)
 * @return {Object|null} A WebGL tile layer style object, or null
 * @api
 */
export function getClassificationStyle(asset: any, bands?: number[] | undefined, styleBand?: number | undefined): any | null;
/**
 * Creates a WebGLTileLayer style for a GeoTIFF layer from the STAC metadata.
 *
 * A usable render from the render extension (see {@link isUsableRender})
 * defines the complete visualization: for single-band data its `colormap`
 * provides the colors (see {@link createColormapStyle} for the supported
 * forms), applied over the range from its `rescale`.
 *
 * Without a usable render, the classification extension
 * (`classification:classes`) provides the coloring for single-band
 * categorical data (not applied to floating point data, which is assumed
 * to be continuous).
 *
 * When no style is returned, the value ranges from
 * {@link getGeoTiffSourceInfoFromAsset} stretch the data (to grayscale for
 * a single band) instead. The returned styles operate on the raw data
 * values, i.e. the GeoTIFF source must be configured with
 * `normalize: false`.
 *
 * @param {import('stac-js').Asset} asset The STAC asset
 * @param {import('ol/source/GeoTIFF.js').SourceInfo} sourceInfo The source info
 * (for the selected bands).
 * @return {Object|null} A WebGL tile layer style object, or null
 * @api
 */
export function getGeoTiffStyleFromAsset(asset: any, sourceInfo: import('ol/source/GeoTIFF.js').SourceInfo): any | null;
/**
 * @typedef {import('ol/colorlike.js').ColorLike} ColorLike
 */
/**
 * @typedef {import('ol/Collection.js').default} Collection
 * @template T
 */
/**
 * @typedef {import('ol/Feature.js').default} Feature
 */
/**
 * @typedef {import('stac-js').Asset} Asset
 */
/**
 * @todo use import('stac-js').Band once exported from stac-js
 * @typedef {import('stac-js/src/band.js').default} Band
 */
/**
 * @typedef {import('stac-js').STAC} STAC
 */
/**
 * The pattern for the supported versions of the label extension.
 * @type {string}
 */
export const LABEL_EXTENSION: string;
/**
 * The default style for rendering bounds of the STAC main entities.
 * @type {Style}
 * @api
 */
export const defaultBoundsStyle: Style;
/**
 * The default style for rendering collection list children.
 * @type {Style}
 * @api
 */
export const defaultCollectionStyle: Style;
/**
 * The default maximum number of pixels of the coarsest resolution level for
 * an asset to be shown. Showing the full extent of an asset loads every
 * tile of the coarsest level, so files without (sufficient) overviews
 * would trigger excessive tile loads.
 * @type {number}
 */
export const MAX_DEFAULT_DISPLAY_PIXELS: number;
/**
 * Information for rendering a datacube asset.
 */
export type DatacubeRenderingInfo = {
    /**
     * The name of the data variable to render.
     */
    variable: string;
    /**
     * The
     * bands dimension of the variable with its ordered values, if any.
     */
    bandDimension: {
        name: string;
        values: Array<string>;
    } | null;
    /**
     * All
     * other non-spatial dimensions of the variable with the index to show by
     * default (the most recent value for temporal dimensions, otherwise 0).
     */
    extraDimensions: Array<{
        name: string;
        defaultIndex: number;
    }>;
    /**
     * The extent of the spatial dimensions
     * (in their reference system), if declared.
     */
    extent: Array<number> | null;
};
export type ColorLike = import('ol/colorlike.js').ColorLike;
export type Collection<T> = import("ol/Collection.js").default<any>;
export type Feature = import('ol/Feature.js').default;
export type Asset = any;
export type Band = any;
export type STAC = any;
import Style from 'ol/style/Style.js';
//# sourceMappingURL=util.d.ts.map
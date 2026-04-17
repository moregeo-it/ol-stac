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
 * @param {Asset} asset The asset to read the information from.
 * @param {Array<number|string>} selectedBands The bands to show. One-based index of the band, or the name of the band.
 * @return {Object} The GeoZarr source options
 * @api
 */
export function getGeoZarrSourceOptionsFromAsset(asset: any, selectedBands: Array<number | string>): any;
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
 * @return {Object|null} A WebGL tile layer style object, or null
 * @api
 */
export function getClassificationStyle(asset: any, bands?: number[] | undefined): any | null;
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
export type ColorLike = import('ol/colorlike.js').ColorLike;
export type Collection<T> = import("ol/Collection.js").default<any>;
export type Feature = import('ol/Feature.js').default;
export type Asset = any;
export type Band = any;
export type STAC = any;
import Style from 'ol/style/Style.js';
//# sourceMappingURL=util.d.ts.map
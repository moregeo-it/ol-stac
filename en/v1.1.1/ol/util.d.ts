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
 * @param {Array<number>} selectedBands The (one-based) bands to show.
 * @return {import('ol/source/GeoTIFF.js').SourceInfo} The source info for the GeoTiff asset
 */
export function getGeoTiffSourceInfoFromAsset(asset: any, selectedBands: Array<number>): import('ol/source/GeoTIFF.js').SourceInfo;
/**
 * Load the projection for the given projection code from the internet.
 *
 * @param {string} code Projection code, e.g. 'EPSG:1234'
 * @return {Promise<Projection|null>} The loaded projection
 */
export function loadProjection(code: string): Promise<Projection | null>;
/**
 * Gets the projection from the asset or link.
 * @param {import('stac-js').STACReference} reference The asset or link to read the information from.
 * @param {ProjectionLike} defaultProjection A default projection to use.
 * @return {Promise<ProjectionLike>} The projection, if any.
 */
export function getProjection(reference: any, defaultProjection?: ProjectionLike): Promise<ProjectionLike>;
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
 * @typedef {import('ol/proj.js').Projection} Projection
 */
/**
 * @typedef {import('ol/proj.js').ProjectionLike} ProjectionLike
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
export type Projection = import('ol/proj.js').Projection;
export type ProjectionLike = import('ol/proj.js').ProjectionLike;
import Style from 'ol/style/Style.js';
//# sourceMappingURL=util.d.ts.map
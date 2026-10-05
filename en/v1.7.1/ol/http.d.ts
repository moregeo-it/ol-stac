/**
 * Creates an `imageLoadFunction` (e.g. for `ol/source/ImageStatic`) that
 * attaches the headers returned by the given function to the image requests.
 * See {@link module:ol/http~load} for details.
 *
 * @param {GetHeadersFn} getHeaders Returns the headers to send for a URL.
 * @param {OnErrorFn|null} [onError] Called when a request failed.
 * @return {function(import('ol/Image.js').default, string): void} The image load function.
 * @api
 */
export function createImageLoadFunction(getHeaders: GetHeadersFn, onError?: OnErrorFn | null): (arg0: import("ol/Image.js").default, arg1: string) => void;
/**
 * Creates a `tileLoadFunction` for image tile sources (e.g. `ol/source/XYZ`)
 * that attaches the headers returned by the given function to the tile
 * requests. The headers are requested per tile URL.
 * See {@link module:ol/http~load} for details.
 *
 * @param {GetHeadersFn} getHeaders Returns the headers to send for a URL.
 * @param {OnErrorFn|null} [onError] Called when a request failed.
 * @return {function(import('ol/Tile.js').default, string): void} The tile load function.
 * @api
 */
export function createTileLoadFunction(getHeaders: GetHeadersFn, onError?: OnErrorFn | null): (arg0: import("ol/Tile.js").default, arg1: string) => void;
/**
 * A function that returns the HTTP headers to send for the given URL,
 * or `null` if no additional headers should be sent.
 */
export type GetHeadersFn = (arg0: string) => ({
    [x: string]: string;
} | null);
/**
 * A function that is called when a request has failed.
 */
export type OnErrorFn = (arg0: Error) => void;
//# sourceMappingURL=http.d.ts.map
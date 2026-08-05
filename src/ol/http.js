/**
 * @module ol/http
 */

/**
 * A function that returns the HTTP headers to send for the given URL,
 * or `null` if no additional headers should be sent.
 * @typedef {function(string): (Object<string, string>|null)} GetHeadersFn
 */

/**
 * A function that is called when a request has failed.
 * @typedef {function(Error): void} OnErrorFn
 */

/**
 * Checks whether the given headers are a non-empty object.
 * @param {*} headers The headers to check.
 * @return {boolean} `true` if there's at least one header, `false` otherwise.
 */
function hasHeaders(headers) {
  return (
    typeof headers === 'object' &&
    headers !== null &&
    Object.keys(headers).length > 0
  );
}

/**
 * Loads the given source into the image element.
 *
 * If headers are returned for the source URL, the source is requested
 * through the Fetch API with the headers attached and the response is
 * assigned to the image element as an object URL, which is revoked once
 * the image has loaded. Otherwise, the source is assigned directly.
 *
 * On request failure, the error is reported and the source is assigned
 * directly as a fallback, so that errors are reported through the image
 * element as usual.
 *
 * @param {HTMLImageElement} img The image element to load the source into.
 * @param {string} src The source URL.
 * @param {GetHeadersFn} getHeaders Returns the headers to send for a URL.
 * @param {OnErrorFn|null} onError Called when the request failed.
 */
function load(img, src, getHeaders, onError) {
  const headers = getHeaders(src);
  if (!hasHeaders(headers)) {
    img.src = src;
    return;
  }
  fetch(src, {headers})
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Unexpected response from ${src}: ${response.status}`);
      }
      return response.blob();
    })
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      const revoke = () => URL.revokeObjectURL(objectUrl);
      img.addEventListener('load', revoke, {once: true});
      img.addEventListener('error', revoke, {once: true});
      img.src = objectUrl;
    })
    .catch((error) => {
      if (onError) {
        onError(error);
      }
      img.src = src;
    });
}

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
export function createImageLoadFunction(getHeaders, onError = null) {
  return (image, src) => {
    const img = /** @type {HTMLImageElement} */ (image.getImage());
    load(img, src, getHeaders, onError);
  };
}

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
export function createTileLoadFunction(getHeaders, onError = null) {
  return (tile, src) => {
    const img = /** @type {HTMLImageElement} */ (
      /** @type {import('ol/ImageTile.js').default} */ (tile).getImage()
    );
    load(img, src, getHeaders, onError);
  };
}

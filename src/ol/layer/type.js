/**
 * @module ol/layer/type
 */

/**
 * @typedef {import("ol/layer/BaseImage.js").Options<import("ol/source/Image.js").default>} ImageOptions
 * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_layer_Image-ImageLayer.html}
 */
/**
 * @typedef {import("ol/layer/BaseTile.js").Options<import("ol/source/Tile.js").default>} TileOptions
 * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_layer_Tile-TileLayer.html}
 */
/**
 * @typedef {import("ol/layer/Vector.js").Options} VectorOptions
 * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_layer_Vector-VectorLayer.html}
 */
/**
 * @typedef {import("ol/layer/VectorTile.js").Options} VectorTileOptions
 * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_layer_VectorTile-VectorTileLayer.html}
 */
/**
 * @typedef {import("ol/layer/WebGLTile.js").Options} WebGLTileOptions
 * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_layer_WebGLTile-WebGLTileLayer.html}
 */
/**
 * @typedef {ImageOptions|TileOptions|VectorOptions|VectorTileOptions|WebGLTileOptions|Object<string, *>} LayerOptions
 */

/**
 * @classdesc
 * The layer type for `getLayerOptions`.
 * @api
 */
class LayerType {
  /**
   * Image layer (`ImageLayer`), used for preview images.
   * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_layer_Image-ImageLayer.html}
   * @api
   */
  static Image = new LayerType('Image');
  /**
   * Tile layer (`TileLayer`), used for XYZ, TileJSON, WMS and WMTS sources.
   * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_layer_Tile-TileLayer.html}
   * @api
   */
  static Tile = new LayerType('Tile');
  /**
   * Vector layer (`VectorLayer`), used for GeoJSON assets.
   * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_layer_Vector-VectorLayer.html}
   * @api
   */
  static Vector = new LayerType('Vector');
  /**
   * Vector tile layer (`VectorTileLayer`), used for PMTiles vector sources.
   * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_layer_VectorTile-VectorTileLayer.html}
   * @api
   */
  static VectorTile = new LayerType('VectorTile');
  /**
   * WebGL tile layer (`WebGLTileLayer`), used for GeoTIFF, GeoZarr and
   * PMTiles raster sources.
   * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_layer_WebGLTile-WebGLTileLayer.html}
   * @api
   */
  static WebGLTile = new LayerType('WebGLTile');

  /**
   * Creates a new LayerType.
   * @param {string} name The internal string identifier.
   * @protected
   * @api
   */
  constructor(name) {
    this.name = name;
  }

  /**
   * Converts to a string.
   * @return {string} The internal string identifier.
   * @api
   */
  toString() {
    return this.name;
  }
}

export default LayerType;

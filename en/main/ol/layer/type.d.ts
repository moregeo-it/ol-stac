export default LayerType;
export type ImageOptions = import("ol/layer/BaseImage.js").Options<import("ol/source/Image.js").default>;
export type TileOptions = import("ol/layer/BaseTile.js").Options<import("ol/source/Tile.js").default>;
export type VectorOptions = import("ol/layer/Vector.js").Options;
export type VectorTileOptions = import("ol/layer/VectorTile.js").Options;
export type WebGLTileOptions = import("ol/layer/WebGLTile.js").Options;
export type LayerOptions = ImageOptions | TileOptions | VectorOptions | VectorTileOptions | WebGLTileOptions | {
    [x: string]: any;
};
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
declare class LayerType {
    /**
     * Image layer (`ImageLayer`), used for preview images.
     * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_layer_Image-ImageLayer.html}
     * @api
     */
    static Image: LayerType;
    /**
     * Tile layer (`TileLayer`), used for XYZ, TileJSON, WMS and WMTS sources.
     * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_layer_Tile-TileLayer.html}
     * @api
     */
    static Tile: LayerType;
    /**
     * Vector layer (`VectorLayer`), used for GeoJSON assets.
     * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_layer_Vector-VectorLayer.html}
     * @api
     */
    static Vector: LayerType;
    /**
     * Vector tile layer (`VectorTileLayer`), used for PMTiles vector sources.
     * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_layer_VectorTile-VectorTileLayer.html}
     * @api
     */
    static VectorTile: LayerType;
    /**
     * WebGL tile layer (`WebGLTileLayer`), used for GeoTIFF, GeoZarr and
     * PMTiles raster sources.
     * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_layer_WebGLTile-WebGLTileLayer.html}
     * @api
     */
    static WebGLTile: LayerType;
    /**
     * Creates a new LayerType.
     * @param {string} name The internal string identifier.
     * @protected
     * @api
     */
    protected constructor();
    name: string;
    /**
     * Converts to a string.
     * @return {string} The internal string identifier.
     * @api
     */
    toString(): string;
}
//# sourceMappingURL=type.d.ts.map
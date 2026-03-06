export default SourceType;
export type GeoTIFFOptions = import("ol/source/GeoTIFF.js").Options;
export type ImageStaticOptions = import("ol/source/ImageStatic.js").Options;
export type TileJSONOptions = import("ol/source/TileJSON.js").Options;
export type TileWMSOptions = import("ol/source/TileWMS.js").Options;
export type WMTSOptions = import("ol/source/WMTS.js").Options;
export type XYZOptions = import("ol/source/XYZ.js").Options;
export type SourceOptions = GeoTIFFOptions | ImageStaticOptions | TileJSONOptions | TileWMSOptions | WMTSOptions | XYZOptions | {
    [x: string]: any;
};
/**
 * @module ol/source/type
 */
/**
 * @typedef {import("ol/source/GeoTIFF.js").Options} GeoTIFFOptions
 * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_GeoTIFF-GeoTIFFSource.html}
 */
/**
 * @typedef {import("ol/source/ImageStatic.js").Options} ImageStaticOptions
 * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_ImageStatic-Static.html}
 */
/**
 * @typedef {import("ol/source/TileJSON.js").Options} TileJSONOptions
 * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_TileJSON-TileJSON.html}
 */
/**
 * @typedef {import("ol/source/TileWMS.js").Options} TileWMSOptions
 * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_TileWMS-TileWMS.html}
 */
/**
 * @typedef {import("ol/source/WMTS.js").Options} WMTSOptions
 * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_WMTS-WMTS.html}
 */
/**
 * @typedef {import("ol/source/XYZ.js").Options} XYZOptions
 * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_XYZ-XYZ.html}
 */
/**
 * @typedef {GeoTIFFOptions|ImageStaticOptions|TileJSONOptions|TileWMSOptions|WMTSOptions|XYZOptions|Object<string, *>} SourceOptions
 */
/**
 * @classdesc
 * The source type for `getSourceOptions`.
 * @api
 */
declare class SourceType {
    /**
     * GeoTiff
     * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_GeoTIFF.html}
     * @api
     */
    static GeoTIFF: SourceType;
    /**
     * Static Image (`ImageStatic`)
     * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_ImageStatic.html}
     * @api
     */
    static ImageStatic: SourceType;
    /**
     * PMTilesRaster
     * @see {@link https://protomaps.com/docs/pmtiles/}
     * @api
     */
    static PMTilesRaster: SourceType;
    /**
     * GeoTiff
     * @see {@link https://protomaps.com/docs/pmtiles/}
     * @api
     */
    static PMTilesVector: SourceType;
    /**
     * TileJSON
     * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_TileJSON.html}
     * @api
     */
    static TileJSON: SourceType;
    /**
     * WMS (`TileWMS`)
     * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_TileWMS.html}
     * @api
     */
    static TileWMS: SourceType;
    /**
     * WMTS
     * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_WMTS.html}
     * @api
     */
    static WMTS: SourceType;
    /**
     * XYZ
     * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_XYZ.html}
     * @api
     */
    static XYZ: SourceType;
    /**
     * Creates a new SourceType.
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
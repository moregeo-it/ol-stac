export default SourceType;
export type GeoTIFFOptions = import("ol/source/GeoTIFF.js").Options;
export type GeoZarrOptions = import("./GeoZarr.js").Options;
export type ImageStaticOptions = import("ol/source/ImageStatic.js").Options;
export type TileJSONOptions = import("ol/source/TileJSON.js").Options;
export type TileWMSOptions = import("ol/source/TileWMS.js").Options;
export type WMTSOptions = import("ol/source/WMTS.js").Options;
export type XYZOptions = import("ol/source/XYZ.js").Options;
export type SourceOptions = GeoTIFFOptions | GeoZarrOptions | ImageStaticOptions | TileJSONOptions | TileWMSOptions | WMTSOptions | XYZOptions | {
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
 * @typedef {import("./GeoZarr.js").Options} GeoZarrOptions
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
 * @typedef {GeoTIFFOptions|GeoZarrOptions|ImageStaticOptions|TileJSONOptions|TileWMSOptions|WMTSOptions|XYZOptions|Object<string, *>} SourceOptions
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
     * GeoZarr
     * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_GeoZarr.html}
     * @api
     */
    static GeoZarr: SourceType;
    /**
     * Static Image (`ImageStatic`)
     * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_ImageStatic.html}
     * @api
     */
    static ImageStatic: SourceType;
    /**
     * PMTiles.
     * Used before the tile type (raster or vector) has been determined,
     * i.e. `options.url` applies to both raster and vector tiles.
     * @see {@link https://protomaps.com/docs/pmtiles/}
     * @api
     */
    static PMTiles: SourceType;
    /**
     * PMTilesRaster
     * @see {@link https://protomaps.com/docs/pmtiles/}
     * @deprecated Use {@link SourceType.PMTiles} instead, `getSourceOptions` is
     * called with it before the tile type is known. For backward compatibility,
     * callbacks that leave the options unchanged for {@link SourceType.PMTiles}
     * are still called with this type after the tile type has been determined.
     * This fallback will be removed in 2.0.0.
     * @api
     */
    static PMTilesRaster: SourceType;
    /**
     * PMTilesVector
     * @see {@link https://protomaps.com/docs/pmtiles/}
     * @deprecated Use {@link SourceType.PMTiles} instead, `getSourceOptions` is
     * called with it before the tile type is known. For backward compatibility,
     * callbacks that leave the options unchanged for {@link SourceType.PMTiles}
     * are still called with this type after the tile type has been determined.
     * This fallback will be removed in 2.0.0.
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
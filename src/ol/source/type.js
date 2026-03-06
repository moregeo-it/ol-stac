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
class SourceType {
  /**
   * GeoTiff
   * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_GeoTIFF.html}
   * @api
   */
  static GeoTIFF = new SourceType('GeoTIFF');
  /**
   * GeoZarr
   * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_GeoZarr.html}
   * @api
   */
  static GeoZarr = new SourceType('GeoZarr');
  /**
   * Static Image (`ImageStatic`)
   * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_ImageStatic.html}
   * @api
   */
  static ImageStatic = new SourceType('ImageStatic');
  /**
   * PMTilesRaster
   * @see {@link https://protomaps.com/docs/pmtiles/}
   * @api
   */
  static PMTilesRaster = new SourceType('PMTilesRaster');
  /**
   * PMTilesVector
   * @see {@link https://protomaps.com/docs/pmtiles/}
   * @api
   */
  static PMTilesVector = new SourceType('PMTilesVector');
  /**
   * TileJSON
   * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_TileJSON.html}
   * @api
   */
  static TileJSON = new SourceType('TileJSON');
  /**
   * WMS (`TileWMS`)
   * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_TileWMS.html}
   * @api
   */
  static TileWMS = new SourceType('TileWMS');
  /**
   * WMTS
   * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_WMTS.html}
   * @api
   */
  static WMTS = new SourceType('WMTS');
  /**
   * XYZ
   * @see {@link https://openlayers.org/en/latest/apidoc/module-ol_source_XYZ.html}
   * @api
   */
  static XYZ = new SourceType('XYZ');

  /**
   * Creates a new SourceType.
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

export default SourceType;

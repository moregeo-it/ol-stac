/**
 * @module ol/shim/ogcTileUtil
 */
import * as ogcTileUtil from 'ol/source/ogcTileUtil.js';
/**
 * `parseTileMatrixSet` from `ol/source/ogcTileUtil.js`, which is not
 * exported by older OpenLayers versions.
 * @param {*} sourceInfo The source info.
 * @param {*} tileMatrixSet Tile matrix set.
 * @param {string} [tileUrlTemplate] Tile URL template.
 * @param {Array<*>} [tileMatrixSetLimits] Tile matrix set limits.
 * @return {*} Tile set info.
 */
export function parseTileMatrixSet(sourceInfo, tileMatrixSet, tileUrlTemplate, tileMatrixSetLimits) {
    if (!ogcTileUtil.parseTileMatrixSet) {
        throw new Error('GeoZarr stores with a legacy `tile_matrix_set` attribute require a newer OpenLayers version');
    }
    return ogcTileUtil.parseTileMatrixSet(sourceInfo, tileMatrixSet, tileUrlTemplate, tileMatrixSetLimits);
}
//# sourceMappingURL=ogcTileUtil.js.map
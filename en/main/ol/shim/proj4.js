/**
 * @module ol/shim/proj4
 */
import * as olProj4 from 'ol/proj/proj4.js';
import { get as getProjection } from 'ol/proj.js';
import proj4 from 'proj4';
/**
 * `fromProjectionDefinition` from `ol/proj/proj4.js`, with a fallback for
 * OpenLayers versions that do not provide it (< 10.10): the definition is
 * registered through this package's own proj4 dependency.
 * @param {*} def Projection definition.
 * @return {import("ol/proj/Projection.js").default|null} The projection.
 */
export function fromProjectionDefinition(def) {
    if (olProj4.fromProjectionDefinition) {
        return olProj4.fromProjectionDefinition(def);
    }
    if (!olProj4.isRegistered()) {
        throw new Error('Proj4 must be registered first with register(proj4)');
    }
    const code = typeof def === 'string' ? def : JSON.stringify(def);
    if (!proj4.defs(code)) {
        proj4.defs(code, def);
        olProj4.register(proj4);
    }
    return getProjection(code);
}
//# sourceMappingURL=proj4.js.map
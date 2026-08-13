/**
 * @typedef {import('ol/proj.js').ProjectionLike} ProjectionLike
 */
/**
 * @typedef {import('ol/proj/Projection.js').default} Projection
 */
/**
 * Returns a projection usable in OpenLayers for a given projection (Code, PROJJSON or WKT2).
 *
 * @param {string|Object} proj The projection
 * @param {string} type The type of the projection definition (`code`, `projjson` or `wkt2`).
 * @param {Function|null} lookup A function to lookup the projection definition (usually only required for `code` type).
 * @return {Promise<Projection>} The projection.
 * @throws {Error} If proj4 is not registered or if a lookup function is required but not provided.
 */
export function registerProjection(proj: string | any, type: string, lookup?: Function | null): Promise<Projection>;
/**
 * Gets the projection from the asset or link.
 * @param {import('stac-js').STACReference} reference The asset or link to read the information from.
 * @param {ProjectionLike} defaultProjection A default projection to use.
 * @return {Promise<ProjectionLike>} The projection, if any.
 */
export function getProjection(reference: any, defaultProjection?: ProjectionLike): Promise<ProjectionLike>;
export type ProjectionLike = import('ol/proj.js').ProjectionLike;
export type Projection = import('ol/proj/Projection.js').default;
//# sourceMappingURL=proj.d.ts.map
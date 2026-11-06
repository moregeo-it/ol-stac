/**
 * `fromProjectionDefinition` from `ol/proj/proj4.js`, with a fallback for
 * OpenLayers versions that do not provide it (< 10.10): the definition is
 * registered through this package's own proj4 dependency.
 * @param {*} def Projection definition.
 * @return {import("ol/proj/Projection.js").default|null} The projection.
 */
export function fromProjectionDefinition(def: any): import("ol/proj/Projection.js").default | null;
//# sourceMappingURL=proj4.d.ts.map
/**
 * @module ol-stac/proj
 */

import {
  isRegistered as isProj4Registered,
  register as registerProj4,
} from 'ol/proj/proj4.js';
import {get as getCachedProjection} from 'ol/proj/projections.js';
import proj4 from 'proj4';
import {isObject} from 'stac-js/src/utils.js';

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
export async function registerProjection(proj, type, lookup = null) {
  if (!proj4) {
    throw new Error('Proj4 must be registered first with register(proj4)');
  }

  const code = type === 'code' ? proj : getCustomProjectionName(proj);
  if (proj4.defs(code)) {
    return getCachedProjection(code);
  }

  if (type === 'code' && !lookup) {
    throw new Error(
      'A lookup function must be provided to resolve projection definitions from codes',
    );
  }

  const definition = type === 'code' ? await lookup(proj) : proj;
  proj4.defs(code, definition);
  registerProj4(proj4);

  return getCachedProjection(code);
}

/**
 * Gets the projection from the asset or link.
 * @param {import('stac-js').STACReference} reference The asset or link to read the information from.
 * @param {ProjectionLike} defaultProjection A default projection to use.
 * @return {Promise<ProjectionLike>} The projection, if any.
 */
export async function getProjection(reference, defaultProjection = undefined) {
  let projection;
  if (isProj4Registered()) {
    const code = reference.getMetadata('proj:code');
    const projjson = reference.getMetadata('proj:projjson');
    const wkt2 = reference.getMetadata('proj:wkt2');
    if (projjson) {
      projection = await registerProjection(projjson, 'projjson');
    } else if (wkt2) {
      projection = await registerProjection(wkt2, 'wkt2');
    } else if (code) {
      try {
        const lookup = await getLookupFn();
        projection = await registerProjection(code, 'code', lookup);
      } catch {
        // Ignore errors and fallback to default projection
      }
    }
  }
  return projection || defaultProjection;
}

/**
 * Creates a custom projection name for a given PROJJSON object or WKT2 string.
 *
 * @param {string|Object} projDef The PROJJSON object or WKT2 string to create the projection name for.
 * @return {string} The custom projection name.
 */
function getCustomProjectionName(projDef) {
  if (isObject(projDef)) {
    const id = projDef.id;
    if (isObject(id) && id.authority && id.code) {
      return `${id.authority}:${id.code}`;
    }

    projDef = JSON.stringify(projDef);
  }
  // Get a base64 hash of the string to create a unique projection name
  return `CUSTOM:${btoa(projDef)}`;
}

async function getLookupFn() {
  try {
    const olProj = await import('ol/proj/proj4.js');
    const {getProjectionCodeLookup, getEPSGLookup} = olProj;
    if (getProjectionCodeLookup) {
      return getProjectionCodeLookup;
    }
    if (getEPSGLookup) {
      return (code) => {
        if (code.startsWith('EPSG:')) {
          const epsgCode = code.split(':')[1];
          const epsgLookup = getEPSGLookup();
          return epsgLookup(epsgCode);
        }
        return null;
      };
    }
  } catch {
    // Don't resolve projections form external sources
  }
  return null;
}

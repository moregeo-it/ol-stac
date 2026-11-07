/**
 * @module ol/proj
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
 * Returns the horizontal part of a compound coordinate reference system,
 * as proj4 can't parse compound reference systems.
 * @param {string} wkt WKT1 or WKT2
 * @return {string} The horizontal reference system.
 */
export function getHorizontalWkt(wkt) {
  wkt = wkt.trim();
  if (!/^(COMPD_CS|COMPOUNDCRS)\s*\[/i.test(wkt)) {
    return wkt;
  }
  // Not within other keywords such as BASEGEOGCRS
  const match =
    /(?<![A-Z_])(PROJCS|PROJCRS|PROJECTEDCRS|GEOGCS|GEOGCRS|GEOGRAPHICCRS|GEODCRS|GEODETICCRS)\s*\[/i.exec(
      wkt.substring(1),
    );
  if (!match) {
    return wkt;
  }
  const start = match.index + 1;
  let depth = 0;
  for (let i = start; i < wkt.length; i++) {
    if (wkt[i] === '[') {
      depth++;
    } else if (wkt[i] === ']' && --depth === 0) {
      return wkt.substring(start, i + 1);
    }
  }
  return wkt;
}

/**
 * Returns the horizontal part of a compound coordinate reference system,
 * as proj4 can't parse compound reference systems.
 * @param {Object} projjson PROJJSON
 * @return {Object} The horizontal reference system.
 */
export function getHorizontalProjjson(projjson) {
  if (projjson.type !== 'CompoundCRS' || !Array.isArray(projjson.components)) {
    return projjson;
  }
  const horizontal = projjson.components.find(
    (component) => isObject(component) && component.type !== 'VerticalCRS',
  );
  return horizontal || projjson;
}

/**
 * Returns a projection usable in OpenLayers for a given projection (Code, PROJJSON or WKT2).
 * For compound reference systems, the horizontal reference system is used.
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

  if (type === 'projjson' && isObject(proj)) {
    proj = getHorizontalProjjson(proj);
  } else if (type === 'wkt2' && typeof proj === 'string') {
    proj = getHorizontalWkt(proj);
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
    const code =
      reference.getMetadata('proj:code') ||
      getDatacubeReferenceSystem(reference);
    const projjson = reference.getMetadata('proj:projjson');
    const wkt2 = reference.getMetadata('proj:wkt2');
    if (projjson) {
      projection = await registerProjection(projjson, 'projjson');
    } else if (wkt2) {
      projection = await registerProjection(wkt2, 'wkt2');
    } else if (isObject(code)) {
      // PROJJSON from a datacube reference system
      projection = await registerProjection(code, 'projjson');
    } else if (typeof code === 'string' && /^[A-Z]+CR?S[\s[]/.test(code)) {
      // WKT2 from a datacube reference system
      projection = await registerProjection(code, 'wkt2');
    } else if (code) {
      try {
        const lookup = await getLookupFn();
        projection = await registerProjection(String(code), 'code', lookup);
      } catch (error) {
        // Fall back to the default projection, but let users know
        // eslint-disable-next-line no-console
        console.warn(`Failed to resolve projection ${code}`, error);
      }
    }
  }
  return projection || defaultProjection;
}

/**
 * Gets the common reference system of the spatial dimensions of a datacube
 * (the datacube extension's `cube:dimensions`), if declared.
 * @param {import('stac-js').STACReference} reference The asset or link to read the information from.
 * @return {number|string|Object|undefined} The reference system (EPSG code,
 * WKT2 or PROJJSON), or `undefined`.
 */
function getDatacubeReferenceSystem(reference) {
  const dimensions = reference.getMetadata('cube:dimensions');
  if (!isObject(dimensions)) {
    return undefined;
  }
  let referenceSystem;
  for (const name in dimensions) {
    const dimension = dimensions[name];
    if (!isObject(dimension) || dimension.type !== 'spatial') {
      continue;
    }
    if (dimension.axis !== 'x' && dimension.axis !== 'y') {
      continue;
    }
    if (referenceSystem === undefined) {
      referenceSystem = dimension.reference_system;
    } else if (
      JSON.stringify(referenceSystem) !==
      JSON.stringify(dimension.reference_system)
    ) {
      // The axes disagree; leave the projection to other means
      return undefined;
    }
  }
  if (typeof referenceSystem === 'number') {
    return `EPSG:${referenceSystem}`;
  }
  return referenceSystem;
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
      return getProjectionCodeLookup();
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

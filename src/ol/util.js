/**
 * @module ol/util
 */

import VectorLayer from 'ol/layer/Vector.js';
import {transformExtent} from 'ol/proj.js';
import Circle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Style from 'ol/style/Style.js';
import {VERSION} from 'ol/util.js';
import {isObject} from 'stac-js/src/utils.js';

/**
 * @typedef {import('ol/colorlike.js').ColorLike} ColorLike
 */
/**
 * @typedef {import('ol/Collection.js').default} Collection
 * @template T
 */
/**
 * @typedef {import('ol/Feature.js').default} Feature
 */
/**
 * @typedef {import('stac-js').Asset} Asset
 */
/**
 * @todo use import('stac-js').Band once exported from stac-js
 * @typedef {import('stac-js/src/band.js').default} Band
 */
/**
 * @typedef {import('stac-js').STAC} STAC
 */

/**
 * The pattern for the supported versions of the label extension.
 * @type {string}
 */
export const LABEL_EXTENSION =
  'https://stac-extensions.github.io/label/v1.*/schema.json';

/**
 * Makes a bounding box continuous for use as an (OpenLayers) extent.
 *
 * Bounding boxes that cross the antimeridian have a western longitude that is
 * larger than the eastern longitude (as defined by RFC 7946, section 5.2).
 * For those, the eastern longitude is shifted by +360 so that the extent is
 * continuous across the antimeridian (i.e. `minX <= maxX`).
 *
 * Accepts both 2D (four values) and 3D (six values) bounding boxes and always
 * returns a 2D extent (four values).
 *
 * @param {Array<number>} bbox The bounding box in lon/lat degrees.
 * @return {Array<number>} The continuous 2D bounding box.
 * @api
 */
export function toContinuousBBox(bbox) {
  // STAC bounding boxes may contain a third dimension, i.e. six values
  // (west, south, minZ, east, north, maxZ). Extract the horizontal 2D extent.
  const hasZ = bbox.length >= 6;
  const west = bbox[0];
  const south = bbox[1];
  const east = bbox[hasZ ? 3 : 2];
  const north = bbox[hasZ ? 4 : 3];
  if (west > east) {
    return [west, south, east + 360, north];
  }
  return [west, south, east, north];
}

/**
 * Converts a lon/lat (EPSG:4326) bounding box into a continuous OpenLayers
 * extent in the given projection.
 *
 * Handles antimeridian-crossing bounding boxes (west > east), see
 * {@link toContinuousBBox}.
 *
 * When fitting an antimeridian-crossing extent, configure the OpenLayers
 * `View` with `multiWorld: true`; otherwise the default world constraint may
 * clamp the fitted view and clip the wrapped portion.
 *
 * @param {Array<number>} bbox The bounding box in lon/lat degrees (EPSG:4326).
 * @param {import("ol/proj.js").ProjectionLike} projection The target projection.
 * @return {Array<number>} The extent in the target projection.
 * @api
 */
export function toOlExtent(bbox, projection) {
  return transformExtent(toContinuousBBox(bbox), 'EPSG:4326', projection);
}

const transparentFill = new Fill({color: 'rgba(0,0,0,0)'});

/**
 * Check whether the installed OL version is at least the given version.
 * Returns true for dev builds ('latest').
 *
 * @param {string} minVersion The minimum version string (e.g. '10.9.0').
 * @return {boolean} `true` if the OL version is >= minVersion.
 */
function olVersionAtLeast(minVersion) {
  if (!VERSION || VERSION === 'latest') {
    return true;
  }
  const current = VERSION.split('.').map(Number);
  const required = minVersion.split('.').map(Number);
  for (let i = 0; i < required.length; i++) {
    if ((current[i] || 0) > required[i]) {
      return true;
    }
    if ((current[i] || 0) < required[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Creates a style for visualization.
 *
 * @param {ColorLike} strokeColor Stroke color
 * @param {number} strokeWidth Stroke with
 * @param {ColorLike} fillColor Fill color
 * @param {number} circleRadius Circle/Point radius
 * @return {Style} The style for visualization.
 * @api
 */
export function getStyle(
  strokeColor,
  strokeWidth,
  fillColor = 'rgba(255,255,255,0.4)',
  circleRadius = 5,
) {
  let fill = transparentFill;
  if (fillColor) {
    fill = new Fill({
      color: fillColor,
    });
  }
  const stroke = new Stroke({
    color: strokeColor,
    width: strokeWidth,
  });
  return new Style({
    image: new Circle({
      fill,
      stroke,
      radius: circleRadius,
    }),
    fill,
    stroke,
  });
}

/**
 * The default style for rendering bounds of the STAC main entities.
 * @type {Style}
 * @api
 */
export const defaultBoundsStyle = getStyle('#3399CC', 3);

/**
 * The default style for rendering collection list children.
 * @type {Style}
 * @api
 */
export const defaultCollectionStyle = getStyle('#ff9933', 2, null);

/**
 * Get the STAC objects associated with this event, if any. Excludes API Collections.
 * @param {import('ol/MapBrowserEvent.js').default} event The asset to read the information from.
 * @param {STAC} [exclude] Excludes the given STAC entity from the list.
 * @param {Collection<Feature>} [selectedFeatures] A collection to add the selected features to.
 * @param {number} [hitTolerance] The hit tolerance in pixels.
 * @return {Promise<Array<STAC>>} A list of STAC objects
 * @api
 */
export async function getStacObjectsForEvent(
  event,
  exclude = null,
  selectedFeatures = null,
  hitTolerance = 0,
) {
  const objects = new Set();
  event.map.forEachFeatureAtPixel(
    event.pixel,
    // Callback for all features that were found
    (feature, layer) => {
      if (selectedFeatures) {
        selectedFeatures.push(feature);
      }
      objects.add(layer.get('stac'));
    },
    {
      // Options for forEachFeatureAtPixel
      hitTolerance,
      // Filter the layers upfront, this ensures the presence of a STAC object
      // so that we don't need to check in the callback above
      layerFilter(layer) {
        if (layer instanceof VectorLayer && layer.get('bounds') === true) {
          const stac = layer.get('stac');
          if (stac && stac.isSTAC && (!exclude || !stac.is(exclude))) {
            return true;
          }
        }
        return false;
      },
    },
  );
  return [...objects];
}

/**
 * Get the source info for the GeoTiff from the asset.
 * @param {import('stac-js').Asset} asset The asset to read the information from.
 * @param {Array<number|string>} selectedBands The bands to show. One-based index of the band, or the name of the band.
 * @return {import('ol/source/GeoTIFF.js').SourceInfo} The source info for the GeoTiff asset
 */
export function getGeoTiffSourceInfoFromAsset(asset, selectedBands) {
  const sourceInfo = {
    url: asset.getAbsoluteUrl(),
  };

  const bands = asset.getBands();
  const sources = bands.length > 0 ? bands : [asset];
  const perBand = sources.length > 1 && olVersionAtLeast('10.9.0');
  const assetNodata = asset.getNoDataValues();
  const bandCount = perBand
    ? Math.max(...bands.map((b) => b.getIndex())) + 1
    : 1;

  const minValues = new Array(bandCount).fill(undefined);
  const maxValues = new Array(bandCount).fill(undefined);
  const nodataValues = new Array(bandCount).fill(undefined);

  let index = 0;
  for (const source of sources) {
    const stats = source.getStatistics();
    let {minimum, maximum} = stats;
    const {mean, stddev} = stats;

    // Use mean ± 2σ for a better visualization stretch (~95% of values)
    if (typeof mean === 'number' && typeof stddev === 'number' && stddev > 0) {
      const stretchMin = mean - 2 * stddev;
      const stretchMax = mean + 2 * stddev;
      minimum =
        typeof minimum === 'number'
          ? Math.max(minimum, stretchMin)
          : stretchMin;
      maximum =
        typeof maximum === 'number'
          ? Math.min(maximum, stretchMax)
          : stretchMax;
    }

    if (typeof minimum === 'number') {
      minValues[index] = minimum;
    }
    if (typeof maximum === 'number') {
      maxValues[index] = maximum;
    }

    const nodata = source.getNoDataValues();
    if (nodata.length > 0) {
      nodataValues[index] = nodata[0];
    } else if (assetNodata.length > 0) {
      nodataValues[index] = assetNodata[0];
    }
    index++;
  }

  const defined = (v) => v !== undefined;
  if (minValues.some(defined)) {
    sourceInfo.min = perBand
      ? minValues
      : Math.min(...minValues.filter(defined));
  }
  if (maxValues.some(defined)) {
    sourceInfo.max = perBand
      ? maxValues
      : Math.max(...maxValues.filter(defined));
  }
  if (nodataValues.some(defined)) {
    if (perBand) {
      sourceInfo.nodata = nodataValues;
    } else {
      const unique = new Set(nodataValues.filter(defined));
      if (unique.size === 1) {
        sourceInfo.nodata = [...unique][0];
      }
    }
  }

  if (selectedBands.length > 0) {
    sourceInfo.bands = selectedBands
      .map((band) => {
        if (typeof band === 'number') {
          return band;
        }
        const b = asset.findBand(band);
        if (b) {
          return b.getIndex() + 1;
        }
        // eslint-disable-next-line no-console
        console.error(
          `Band with name ${band} not found in asset ${asset.getKey()}`,
        );
        return null;
      })
      .filter((band) => band !== null);
  } else {
    const visualBands = asset.findVisualBands();
    if (visualBands) {
      sourceInfo.bands = [
        visualBands.red.getIndex() + 1,
        visualBands.green.getIndex() + 1,
        visualBands.blue.getIndex() + 1,
      ];
    }
  }

  return sourceInfo;
}

/**
 * Returns the style for the footprint.
 * Removes the fill if anything is meant to be shown in the bounds.
 *
 * @param {Style} [originalStyle] The original style for the footprint.
 * @param {import('./layer/STAC.js').default} [layerGroup] The associated STAC layergroup to check.
 * @return {Style} The adapted style for the footprint.
 * @api
 */
export function getBoundsStyle(originalStyle, layerGroup) {
  const style = originalStyle.clone();
  if (!layerGroup.hasOnlyBounds()) {
    style.setFill(transparentFill);
  }
  return style;
}

/**
 * Parse the GeoZarr source options from an asset.
 *
 * If the asset (or its containing Item/Collection) describes the store
 * through the datacube extension (`cube:variables` and `cube:dimensions`),
 * the store is treated as an n-dimensional datacube: the data variable and a
 * selector for its non-spatial dimensions are derived from the metadata.
 * Otherwise, each band is expected to be a separate array in the store,
 * addressed by the band names from the STAC `bands` field.
 *
 * @param {Asset} asset The asset to read the information from.
 * @param {Array<number|string>} selectedBands The bands to show. One-based index of the band, or the name of the band.
 * @return {Object} The GeoZarr source options
 * @api
 */
export function getGeoZarrSourceOptionsFromAsset(asset, selectedBands) {
  const options = {
    url: asset.getAbsoluteUrl(),
  };

  const cube = getDatacubeRenderingInfo(asset);
  if (cube) {
    options.variable = cube.variable;
    options.selector = {};
    if (cube.bandDimension) {
      const indices = getDatacubeBandIndices(
        cube.bandDimension.values,
        selectedBands,
        asset,
      );
      if (indices.length > 0) {
        options.selector[cube.bandDimension.name] = indices;
      }
    }
    for (const dimension of cube.extraDimensions) {
      options.selector[dimension.name] = dimension.defaultIndex;
    }
    if (cube.extent) {
      options.extent = cube.extent;
    }
    const projBBox = asset.getMetadata('proj:bbox');
    if (Array.isArray(projBBox) && projBBox.length >= 4) {
      // proj:bbox may be 3D (xmin, ymin, zmin, xmax, ymax, zmax)
      options.extent =
        projBBox.length >= 6
          ? [projBBox[0], projBBox[1], projBBox[3], projBBox[4]]
          : projBBox.slice(0, 4);
    }
    const projTransform = asset.getMetadata('proj:transform');
    if (
      Array.isArray(projTransform) &&
      projTransform.length >= 6 &&
      projTransform[4] > 0
    ) {
      options.flipY = true;
    }
    return options;
  }

  if (selectedBands.length > 0) {
    options.bands = selectedBands
      .map((band) => {
        if (typeof band === 'string') {
          return band;
        }
        const bands = asset.getBands();
        const bandObj = bands[band - 1];
        if (isObject(bandObj) && typeof bandObj.name === 'string') {
          return bandObj.name;
        }
        return null;
      })
      .filter(Boolean);
  } else {
    const render = getRenderForAsset(asset);
    if (render && Array.isArray(render.bands) && render.bands.length > 0) {
      options.bands = render.bands;
    } else {
      const bands = asset.findVisualBands();
      if (bands) {
        options.bands = [
          bands.red.name,
          bands.green.name,
          bands.blue.name,
        ].filter(Boolean);
      }
    }
  }
  if (!Array.isArray(options.bands)) {
    options.bands = [];
  }

  return options;
}

/**
 * Returns the render (from the render extension's `renders` field) that
 * applies to the given asset: the first render that lists the asset's key
 * in its `assets` field, or the first render without an `assets` field.
 *
 * @param {Asset} asset The asset to find the render for.
 * @return {Object|null} The render object, or `null`.
 * @api
 */
export function getRenderForAsset(asset) {
  const renders = asset.getMetadata('renders');
  if (!isObject(renders)) {
    return null;
  }
  const key = asset.getKey();
  let fallback = null;
  for (const name in renders) {
    const render = renders[name];
    if (!isObject(render)) {
      continue;
    }
    if (Array.isArray(render.assets)) {
      if (render.assets.includes(key)) {
        return render;
      }
    } else if (!fallback) {
      fallback = render;
    }
  }
  return fallback;
}

/**
 * Creates a WebGLTileLayer style for a GeoZarr layer from the render
 * extension (`renders`): `rescale` provides the value range(s) to stretch
 * and `colormap` provides the coloring for single-band data.
 *
 * The `colormap` follows the (rio-tiler) conventions referenced by the
 * render extension and is fully self-contained (`colormap_name` is not
 * supported, as the available names are not standardized):
 * - an object mapping values to colors. With `rescale`, the values are the
 *   0-255 indices that the data is rescaled to (continuous data, where
 *   values without an entry use the closest lower entry); without
 *   `rescale`, the values are the raw data values (categorical data,
 *   matched exactly).
 * - an array of intervals `[[[min, max], color], ...]`, applied to the raw
 *   data values.
 * Colors are `[r, g, b]` or `[r, g, b, a]` arrays (alpha in 0-255).
 *
 * @param {Asset} asset The asset to read the render information from.
 * @param {Object} sourceOptions The GeoZarr source options (to determine the number of rendered bands).
 * @return {Object|null} A WebGLTileLayer style, or `null` if the metadata provides none.
 * @api
 */
export function getGeoZarrStyleFromAsset(asset, sourceOptions) {
  const render = getRenderForAsset(asset);
  if (!render) {
    return null;
  }

  let bandCount = 1;
  if (sourceOptions.variable) {
    if (isObject(sourceOptions.selector)) {
      for (const key in sourceOptions.selector) {
        if (Array.isArray(sourceOptions.selector[key])) {
          bandCount = sourceOptions.selector[key].length;
        }
      }
    }
  } else if (Array.isArray(sourceOptions.bands)) {
    bandCount = sourceOptions.bands.length || 1;
  }

  const rescale = Array.isArray(render.rescale) ? render.rescale : [];
  const rangeFor = (index) => {
    if (Array.isArray(rescale[index]) && rescale[index].length >= 2) {
      return rescale[index];
    }
    if (Array.isArray(rescale[0]) && rescale[0].length >= 2) {
      return rescale[0];
    }
    return null;
  };

  const stretch = (band, range) => [
    'interpolate',
    ['linear'],
    ['band', band],
    range[0],
    0,
    range[1],
    255,
  ];

  if (bandCount >= 3) {
    if (!rangeFor(0)) {
      return null;
    }
    return {
      color: [
        'color',
        stretch(1, rangeFor(0)),
        stretch(2, rangeFor(1)),
        stretch(3, rangeFor(2)),
      ],
    };
  }

  // Single band
  const colormap = render['colormap'];
  if (Array.isArray(colormap)) {
    // Interval form: [[[min, max], color], ...], applied to raw values
    const cases = [];
    for (const entry of colormap) {
      if (!Array.isArray(entry) || !Array.isArray(entry[0])) {
        continue;
      }
      cases.push(['between', ['band', 1], entry[0][0], entry[0][1]]);
      cases.push(toColor(entry[1]));
    }
    if (cases.length > 0) {
      return {color: ['case', ...cases, [0, 0, 0, 0]]};
    }
  } else if (isObject(colormap)) {
    const range = rangeFor(0);
    if (range) {
      // Continuous data: the values are the 0-255 indices that the data is
      // rescaled to; values without an entry use the closest lower entry.
      const keys = Object.keys(colormap)
        .map(Number)
        .filter((key) => Number.isInteger(key) && key >= 0 && key < 256)
        .sort((a, b) => a - b);
      if (keys.length > 0) {
        const palette = new Array(256);
        /** @type {Array<number>|string} */
        let color = [0, 0, 0, 0]; // transparent below the first entry
        let keyIndex = 0;
        for (let i = 0; i < 256; i++) {
          while (keyIndex < keys.length && keys[keyIndex] <= i) {
            color = toColor(colormap[keys[keyIndex]]);
            keyIndex++;
          }
          palette[i] = color;
        }
        const index = [
          'interpolate',
          ['linear'],
          ['band', 1],
          range[0],
          0,
          range[1],
          255,
        ];
        return {color: ['palette', index, palette]};
      }
    } else {
      // Categorical data: the values are the raw data values (which may be
      // negative or sparse)
      const cases = [];
      for (const key of Object.keys(colormap)) {
        const value = Number(key);
        if (!isNaN(value)) {
          cases.push(['==', ['band', 1], value], toColor(colormap[key]));
        }
      }
      if (cases.length > 0) {
        return {color: ['case', ...cases, [0, 0, 0, 0]]};
      }
    }
  }
  if (rangeFor(0)) {
    const gray = stretch(1, rangeFor(0));
    return {color: ['color', gray, gray, gray]};
  }
  return null;
}

/**
 * Normalizes a color from render extension metadata (alpha in 0-255, as in
 * rio-tiler) to an OpenLayers color (alpha in 0-1).
 * @param {Array<number>|string} color The color to normalize.
 * @return {Array<number>|string} The OpenLayers color.
 */
function toColor(color) {
  if (Array.isArray(color) && color.length === 4) {
    return [color[0], color[1], color[2], color[3] / 255];
  }
  return color;
}

/**
 * Information for rendering a datacube asset.
 *
 * @typedef {Object} DatacubeRenderingInfo
 * @property {string} variable The name of the data variable to render.
 * @property {{name: string, values: Array<string>}|null} bandDimension The
 * bands dimension of the variable with its ordered values, if any.
 * @property {Array<{name: string, defaultIndex: number}>} extraDimensions All
 * other non-spatial dimensions of the variable with the index to show by
 * default (the most recent value for temporal dimensions, otherwise 0).
 * @property {Array<number>|null} extent The extent of the spatial dimensions
 * (in their reference system), if declared.
 */

/**
 * Reads the datacube extension metadata (`cube:variables` and
 * `cube:dimensions`, inherited from the containing Item/Collection if not
 * present on the asset) and determines the data variable to render and how
 * its non-spatial dimensions should be sliced.
 *
 * @param {Asset} asset The asset to read the information from.
 * @return {DatacubeRenderingInfo|null} The rendering info, or `null` if the
 * asset is not described as a datacube.
 */
function getDatacubeRenderingInfo(asset) {
  const dimensions = asset.getMetadata('cube:dimensions');
  const variables = asset.getMetadata('cube:variables');
  if (!isObject(dimensions) || !isObject(variables)) {
    return null;
  }

  const spatialDims = [];
  const spatialExtents = {x: null, y: null};
  let bandDimension = null;
  for (const name in dimensions) {
    const dimension = dimensions[name];
    if (!isObject(dimension)) {
      continue;
    }
    if (dimension.type === 'spatial') {
      spatialDims.push(name);
      if (
        (dimension.axis === 'x' || dimension.axis === 'y') &&
        Array.isArray(dimension.extent) &&
        dimension.extent.length === 2
      ) {
        spatialExtents[dimension.axis] = dimension.extent;
      }
    } else if (dimension.type === 'bands') {
      bandDimension = {
        name,
        values: Array.isArray(dimension.values) ? dimension.values : [],
      };
    }
  }
  if (spatialDims.length < 2) {
    return null;
  }

  // Find the data variable that covers the spatial dimensions. When the
  // asset declares STAC `bands`, each band is expected to be its own array
  // in the store (e.g. EOPF), which the `bands` mode handles instead —
  // unless a variable packs the bands dimension into a single array.
  const hasStacBands = asset.getBands().length > 0;
  let variable = null;
  let variableDims = null;
  for (const name in variables) {
    const v = variables[name];
    if (!isObject(v) || !Array.isArray(v.dimensions)) {
      continue;
    }
    if (typeof v.type === 'string' && v.type !== 'data') {
      continue;
    }
    if (!spatialDims.every((dim) => v.dimensions.includes(dim))) {
      continue;
    }
    if (
      hasStacBands &&
      !(bandDimension && v.dimensions.includes(bandDimension.name))
    ) {
      // With STAC bands declared, each band is expected to be its own array
      // (addressed through the `bands` mode), unless the variable packs the
      // declared bands dimension
      continue;
    }
    // Prefer a variable that includes the bands dimension
    if (bandDimension && v.dimensions.includes(bandDimension.name)) {
      variable = name;
      variableDims = v.dimensions;
      break;
    }
    if (!variable) {
      variable = name;
      variableDims = v.dimensions;
    }
  }
  if (!variable) {
    return null;
  }

  if (bandDimension && !variableDims.includes(bandDimension.name)) {
    bandDimension = null;
  }

  const extraDimensions = [];
  for (const name of variableDims) {
    if (
      spatialDims.includes(name) ||
      (bandDimension && name === bandDimension.name)
    ) {
      continue;
    }
    const dimension = dimensions[name];
    let defaultIndex = 0;
    if (
      isObject(dimension) &&
      dimension.type === 'temporal' &&
      Array.isArray(dimension.values) &&
      dimension.values.length > 0
    ) {
      // Show the most recent time step by default. Timestamps are compared
      // as instants, as string comparison breaks with mixed UTC offsets.
      defaultIndex = dimension.values.reduce(
        (latest, value, index, values) =>
          Date.parse(value) > Date.parse(values[latest]) ? index : latest,
        0,
      );
    }
    extraDimensions.push({name, defaultIndex});
  }

  let extent = null;
  if (spatialExtents.x && spatialExtents.y) {
    extent = [
      spatialExtents.x[0],
      spatialExtents.y[0],
      spatialExtents.x[1],
      spatialExtents.y[1],
    ];
  }

  return {variable, bandDimension, extraDimensions, extent};
}

/**
 * Determines the (0-based) indices into the bands dimension of a datacube
 * to render.
 *
 * @param {Array<string>} values The ordered values of the bands dimension.
 * @param {Array<number|string>} selectedBands The bands to show. One-based index of the band, or the name of the band.
 * @param {Asset} asset The asset, for finding the RGB bands.
 * @return {Array<number>} The band indices.
 */
function getDatacubeBandIndices(values, selectedBands, asset) {
  const isValid = (index) =>
    index >= 0 && (values.length === 0 || index < values.length);
  if (selectedBands.length > 0) {
    return selectedBands
      .map((band) => {
        const index =
          typeof band === 'number' ? band - 1 : values.indexOf(band);
        if (!isValid(index)) {
          // eslint-disable-next-line no-console
          console.error(`Band ${band} not found in asset ${asset.getKey()}`);
          return -1;
        }
        return index;
      })
      .filter((index) => index >= 0);
  }
  // Prefer the bands declared by the render extension
  const render = getRenderForAsset(asset);
  if (render && Array.isArray(render.bands) && render.bands.length > 0) {
    const indices = render.bands
      .map((name) => values.indexOf(name))
      .filter((index) => index >= 0);
    if (indices.length > 0) {
      return indices;
    }
  }
  // Otherwise, prefer the RGB bands if they can be identified
  const visual = asset.findVisualBands();
  if (visual) {
    const indices = [visual.red.name, visual.green.name, visual.blue.name]
      .map((name) => values.indexOf(name))
      .filter((index) => index >= 0);
    if (indices.length === 3) {
      return indices;
    }
  }
  // Default to the first (up to) three bands, shown as RGB
  return values.slice(0, 3).map((_, index) => index);
}

/**
 * Get a URL from a web-map-link that is specific enough, i.e.
 * replaces any occurances of {s} if possible, otherwise returns null.
 * @param {import('./layer/STAC.js').Link} link The web map link.
 * @return {string|null} Specific URL
 */
export function getSpecificWebMapUrl(link) {
  let url = link.href;
  if (url.includes('{s}')) {
    if (
      Array.isArray(link['href:servers']) &&
      link['href:servers'].length > 0
    ) {
      const i = (Math.random() * link['href:servers'].length) | 0;
      url = url.replace('{s}', link['href:servers'][i]);
    } else {
      return null;
    }
  }
  return url;
}

/**
 * Checks whether the given value is a scalar (string, number, boolean).
 * @param {*} value The value to check
 * @return {boolean} `true` is the value is a scalar, `false` otherwise
 */
export function isScalar(value) {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/**
 * Parses a 6-character hex color string (without leading `#`) into an RGB array.
 * @param {string} hex A 6-character hex color string (e.g. `"FF5733"`)
 * @return {Array<number>} An array of [r, g, b] values (0-255)
 */
function hexToRgb(hex) {
  return [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16),
  ];
}

/**
 * Returns the `classification:classes` array from a STAC Asset,
 * checking band-level and asset-level metadata.
 *
 * @param {import('stac-js').Asset} asset The STAC asset
 * @param {Array<number>} [bands] The selected bands (one-based)
 * @return {Array<Object>|null} The classification classes, or null
 * @api
 */
export function getClassificationClasses(asset, bands) {
  let classes = null;

  // If specific bands are selected, look for classification on the selected band
  const assetBands = asset.getBands();
  if (bands && bands.length === 1 && assetBands.length > 0) {
    const bandObj = assetBands[bands[0] - 1];
    if (bandObj) {
      classes = bandObj['classification:classes'];
    }
  }

  // Fall back to asset-level classification or single band
  if (!Array.isArray(classes)) {
    classes = asset.getMetadata('classification:classes');
  }

  if (!Array.isArray(classes) || classes.length === 0) {
    return null;
  }

  return classes;
}

/**
 * Builds a WebGL tile layer style for classified raster data based on
 * `classification:classes` from a STAC Asset.
 *
 * Returns `null` if the asset has no classification classes with color hints.
 *
 * @param {import('stac-js').Asset} asset The STAC asset
 * @param {Array<number>} [bands] The selected bands (one-based)
 * @return {Object|null} A WebGL tile layer style object, or null
 * @api
 */
export function getClassificationStyle(asset, bands) {
  const classes = getClassificationClasses(asset, bands);
  if (!classes) {
    return null;
  }

  // Only useful if at least one class has a color_hint
  const classesWithColor = classes.filter(
    (cls) =>
      typeof cls.value === 'number' &&
      typeof cls.color_hint === 'string' &&
      cls.color_hint.length === 6,
  );
  if (classesWithColor.length === 0) {
    return null;
  }

  // Build the match expression: ['match', ['band', n], value, color, ..., fallback]
  let band = 1;
  if (bands && bands.length === 1) {
    band = bands[0];
  }
  const matchExpr = ['match', ['band', band]];

  for (const cls of classesWithColor) {
    const [r, g, b] = hexToRgb(cls.color_hint);
    const alpha = cls.nodata ? 0 : 1;
    matchExpr.push(cls.value, ['color', r, g, b, alpha]);
  }

  // Default: transparent for values without a color hint
  matchExpr.push(['color', 0, 0, 0, 0]);

  return {color: matchExpr};
}

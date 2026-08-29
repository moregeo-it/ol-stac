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
 * Determines the value range for a visualization stretch from STAC
 * statistics: mean ± 2σ (~95% of the values), clamped to the declared
 * minimum/maximum.
 * @param {Object} stats The statistics (e.g. from stac-js `getStatistics()`).
 * @return {{minimum: (number|undefined), maximum: (number|undefined)}} The stretch range.
 */
function getStatisticsStretch(stats) {
  let minimum;
  let maximum;
  if (isObject(stats)) {
    ({minimum, maximum} = stats);
    const {mean, stddev} = stats;
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
  }
  return {minimum, maximum};
}

/**
 * Determines the value range for a visualization stretch from the STAC
 * statistics of a band or asset, if complete.
 * @param {Asset|Band} source The band or asset to read the statistics from.
 * @return {Array<number>|null} The [min, max] range, or `null`.
 */
function getStatisticsRange(source) {
  const {minimum, maximum} = getStatisticsStretch(source.getStatistics());
  if (typeof minimum === 'number' && typeof maximum === 'number') {
    return [minimum, maximum];
  }
  return null;
}

/**
 * Parses a nodata value from render extension metadata, which may be a
 * number or a string (`nan`, `inf` and `-inf`, as titiler accepts them).
 * @param {*} value The nodata value.
 * @return {number|undefined} The nodata value, or `undefined`.
 */
function parseNoDataValue(value) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    switch (value.trim().toLowerCase()) {
      case 'nan':
        return NaN;
      case 'inf':
        return Infinity;
      case '-inf':
        return -Infinity;
      default: {
        const parsed = Number(value);
        return isNaN(parsed) ? undefined : parsed;
      }
    }
  }
  return undefined;
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
    const {minimum, maximum} = getStatisticsStretch(source.getStatistics());

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

  const render = getRenderForAsset(asset);
  const usableRender = isUsableRender(render);
  // A usable render defines the complete visualization, so its value range
  // takes precedence over the statistics of the default visualization
  const rescale =
    usableRender && Array.isArray(render.rescale) ? render.rescale : [];
  const defined = (v) => v !== undefined;
  if (Array.isArray(rescale[0]) && rescale[0].length >= 2) {
    sourceInfo.min = rescale[0][0];
    sourceInfo.max = rescale[0][1];
  } else {
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
  } else if (usableRender) {
    // As a last resort, use the nodata value from the render extension
    const nodata = parseNoDataValue(render.nodata);
    if (nodata !== undefined) {
      sourceInfo.nodata = nodata;
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
    // A usable render defines the complete visualization, including the
    // bands to show (paired with its value ranges)
    if (usableRender && Array.isArray(render.bands)) {
      const indices = render.bands
        .map((name) => asset.findBand(name))
        .filter(isObject)
        .map((band) => band.getIndex() + 1);
      if (indices.length > 0) {
        sourceInfo.bands = indices;
      }
    }
    if (!sourceInfo.bands) {
      const visualBands = asset.findVisualBands();
      if (visualBands) {
        sourceInfo.bands = [
          visualBands.red.getIndex() + 1,
          visualBands.green.getIndex() + 1,
          visualBands.blue.getIndex() + 1,
        ];
      }
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
 * selection for its non-spatial dimensions are derived from the metadata.
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
    options.dimensions = {};
    if (cube.bandDimension) {
      const indices = getDatacubeBandIndices(
        cube.bandDimension.values,
        selectedBands,
        asset,
      );
      if (indices.length > 0) {
        options.dimensions[cube.bandDimension.name] = indices;
      }
    }
    for (const dimension of cube.extraDimensions) {
      options.dimensions[dimension.name] = dimension.defaultIndex;
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
    // A usable render defines the complete visualization, including the
    // bands to show (paired with its value ranges)
    const render = getRenderForAsset(asset);
    if (
      isUsableRender(render) &&
      Array.isArray(render.bands) &&
      render.bands.length > 0
    ) {
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
 * The default maximum number of pixels of the coarsest resolution level for
 * an asset to be shown. Showing the full extent of an asset loads every
 * tile of the coarsest level, so files without (sufficient) overviews
 * would trigger excessive tile loads.
 * @type {number}
 */
export const MAX_DEFAULT_DISPLAY_PIXELS = 16 * 1024 * 1024;

/**
 * Returns the number of pixels of the coarsest resolution level of a
 * configured tile source (e.g. GeoTIFF or GeoZarr). This is the amount of
 * data that displaying the full extent of the asset requires to load.
 * @param {import('ol/source/Tile.js').default} source The configured (ready) source.
 * @return {number} The number of pixels, or `Infinity` if unknown.
 * @api
 */
export function getDisplayPixels(source) {
  const tileGrid = source.getTileGrid();
  if (!tileGrid) {
    return Infinity;
  }
  const extent = tileGrid.getExtent();
  const resolution = tileGrid.getResolutions()[0];
  if (!extent || !(resolution > 0)) {
    return Infinity;
  }
  let rowResolution = resolution;
  // GeoZarr pixels are not necessarily square (e.g. a square array covering
  // the full EPSG:4326 world); use the row resolution the source tracks for
  // the coarsest level, if available
  const zarrSource = /** @type {*} */ (source);
  const wmtsTileGrid = /** @type {*} */ (tileGrid);
  if (
    zarrSource.levelRowInfo_ &&
    typeof wmtsTileGrid.getMatrixIds === 'function'
  ) {
    const rowInfo = zarrSource.levelRowInfo_[wmtsTileGrid.getMatrixIds()[0]];
    if (rowInfo && rowInfo.rowResolution > 0) {
      rowResolution = rowInfo.rowResolution;
    }
  }
  return (
    ((extent[2] - extent[0]) / resolution) *
    ((extent[3] - extent[1]) / rowResolution)
  );
}

/**
 * Checks whether displaying the full extent of a configured tile source at
 * the coarsest available resolution requires excessive tile loads.
 * @param {import('ol/source/Tile.js').default} source The configured (ready) source.
 * @param {number} [maxPixels] The pixel limit for the coarsest resolution level.
 * @return {boolean} `true` if the source exceeds the limit.
 * @api
 */
export function exceedsDisplayLimit(
  source,
  maxPixels = MAX_DEFAULT_DISPLAY_PIXELS,
) {
  return getDisplayPixels(source) > maxPixels;
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
 * Checks whether a render (from the render extension) can be implemented:
 * a render defines a complete visualization, so it is only used when it
 * defines at least one aspect that is supported (`bands`, `rescale`,
 * `colormap`, `nodata`) and none that can't be implemented reliably
 * (band math expressions, color formulas, and named colormaps, which are
 * not interoperable). Otherwise the default visualization derived from the
 * general STAC metadata applies.
 * @param {Object|null} render The render object.
 * @return {boolean} `true` if the render can be used.
 */
function isUsableRender(render) {
  if (!isObject(render)) {
    return false;
  }
  if (
    typeof render.expression === 'string' ||
    typeof render['color_formula'] === 'string' ||
    typeof render['colormap_name'] === 'string'
  ) {
    return false;
  }
  return Boolean(
    (Array.isArray(render.bands) && render.bands.length > 0) ||
    (Array.isArray(render.rescale) && render.rescale.length > 0) ||
    isObject(render['colormap']) ||
    Array.isArray(render['colormap']) ||
    render.nodata !== undefined,
  );
}

/**
 * Checks whether a band or asset declares a floating point data type.
 * Floating point data can be assumed to be continuous (not categorical).
 * @param {Asset|Band} source The band or asset to read the data type from.
 * @return {boolean} `true` if the data type is declared as floating point.
 */
function isFloatingPoint(source) {
  const type = source.getMetadata('data_type');
  return typeof type === 'string' && type.includes('float');
}

/**
 * Creates a linear stretch expression that maps the given value range of a
 * band to 0-255.
 * @param {number} band The one-based rendered band.
 * @param {Array<number>} range The [min, max] value range.
 * @return {Array<*>} The expression.
 */
function stretch(band, range) {
  return [
    'interpolate',
    ['linear'],
    ['band', band],
    range[0],
    0,
    range[1],
    255,
  ];
}

/**
 * Creates a WebGLTileLayer style that colors the given value range of a
 * band with the given colors, evenly distributed over the range.
 * @param {Array<import('ol/color.js').Color|string>} colors The colors.
 * @param {number} band The one-based rendered band.
 * @param {Array<number>} range The [min, max] value range.
 * @return {Object} A WebGLTileLayer style.
 */
function createGradientStyle(colors, band, range) {
  /** @type {Array<*>} */
  const color = ['interpolate', ['linear'], ['band', band]];
  const last = colors.length - 1;
  colors.forEach((stop, i) => {
    color.push(range[0] + (i / last) * (range[1] - range[0]), stop);
  });
  return {color};
}

/**
 * Creates a WebGLTileLayer color expression from a render extension
 * `colormap`, following the rio-tiler semantics that the render extension
 * references (`colormap_name` is not supported, as the available names are
 * not standardized):
 * - An array of intervals `[[[min, max], color], ...]` colors the raw data
 *   values with `min <= value < max`; later intervals take precedence.
 * - An object with exactly the integer keys 0-255 is a lookup table for the
 *   data after rescaling it to 0-255 (truncated, as rio-tiler casts to
 *   uint8).
 * - Any other object colors the (rescaled) data values that exactly match a
 *   key.
 * Unmatched values are transparent. Colors are `[r, g, b]` or
 * `[r, g, b, a]` arrays (alpha in 0-255, as in rio-tiler).
 * @param {Object|Array} colormap The colormap.
 * @param {Array<number>|null} range The range to rescale the data to 0-255, if any.
 * @return {Object|null} A WebGLTileLayer style, or `null`.
 */
function createColormapStyle(colormap, range) {
  if (Array.isArray(colormap)) {
    // rio-tiler applies intervals sequentially so that later intervals
    // overwrite earlier ones; a case expression picks the first match
    const cases = [];
    for (const entry of colormap.slice().reverse()) {
      if (!Array.isArray(entry) || !Array.isArray(entry[0])) {
        continue;
      }
      cases.push([
        'all',
        ['>=', ['band', 1], entry[0][0]],
        ['<', ['band', 1], entry[0][1]],
      ]);
      cases.push(toColor(entry[1]));
    }
    if (cases.length > 0) {
      return {color: ['case', ...cases, [0, 0, 0, 0]]};
    }
    return null;
  }
  if (!isObject(colormap)) {
    return null;
  }
  const keys = Object.keys(colormap).filter((key) => !isNaN(Number(key)));
  if (keys.length === 0) {
    return null;
  }
  // Rescale the data to 0-255 and truncate, as rio-tiler does before
  // applying a colormap
  /** @type {Array<*>} */
  let value = ['band', 1];
  if (Array.isArray(range) && range[0] < range[1]) {
    value = ['floor', ['clamp', stretch(1, range), 0, 255]];
  }
  const isLut =
    keys.length === 256 &&
    keys.every((key) => {
      const index = Number(key);
      return Number.isInteger(index) && index >= 0 && index < 256;
    });
  if (isLut) {
    const palette = new Array(256);
    for (const key of keys) {
      palette[Number(key)] = toColor(colormap[key]);
    }
    return {color: ['palette', value, palette]};
  }
  const cases = [];
  for (const key of keys) {
    cases.push(['==', value, Number(key)], toColor(colormap[key]));
  }
  return {color: ['case', ...cases, [0, 0, 0, 0]]};
}

/**
 * Creates a WebGLTileLayer style for a GeoZarr layer from the STAC metadata.
 *
 * A usable render from the render extension (see {@link isUsableRender})
 * defines the complete visualization: the value range comes from its
 * `rescale` and single-band colors from its `colormap` (see
 * {@link createColormapStyle} for the supported forms).
 *
 * Without a usable render, a default visualization is derived from the
 * general STAC metadata: the value range to stretch comes from the
 * `statistics` of the rendered bands (or the asset), the classification
 * extension (`classification:classes`) provides the coloring for
 * single-band categorical data (not applied to floating point data, which
 * is assumed to be continuous), and continuous data is colored with the
 * given default colormap or stretched to grayscale (consistent with
 * single-band COGs).
 *
 * @param {Asset} asset The asset to read the metadata from.
 * @param {Object} sourceOptions The GeoZarr source options (to determine the rendered bands).
 * @param {Array<import('ol/color.js').Color|string>|null} [defaultColormap] The colors
 * of the colormap for continuous single-band data, evenly distributed over the value range.
 * @return {Object|null} A WebGLTileLayer style, or `null` if the metadata provides none.
 * @api
 */
export function getGeoZarrStyleFromAsset(
  asset,
  sourceOptions,
  defaultColormap = null,
) {
  let bandCount = 1;
  /** @type {Array<string>} */
  let bandNames = [];
  if (sourceOptions.variable) {
    if (isObject(sourceOptions.dimensions)) {
      for (const key in sourceOptions.dimensions) {
        if (Array.isArray(sourceOptions.dimensions[key])) {
          bandCount = sourceOptions.dimensions[key].length;
        }
      }
    }
  } else if (Array.isArray(sourceOptions.bands)) {
    bandCount = sourceOptions.bands.length || 1;
    bandNames = sourceOptions.bands.filter((band) => typeof band === 'string');
  }

  // The band (or the asset) that describes the rendered band
  const bandSource = (index) => {
    if (bandNames.length > index) {
      const band = asset.findBand(bandNames[index]);
      if (band) {
        return band;
      }
    }
    return asset;
  };

  const render = getRenderForAsset(asset);
  const rescale =
    isUsableRender(render) && Array.isArray(render.rescale)
      ? render.rescale
      : [];
  // A usable render that defines any styling aspect defines the complete
  // visualization; a render that only selects bands (or sets nodata) leaves
  // the styling to the default visualization
  const renderStyles =
    rescale.length > 0 || (isUsableRender(render) && render['colormap']);
  // The value range to stretch per rendered band: only the render's rescale
  // when the render styles the data, otherwise the STAC statistics of the
  // rendered band (or the asset)
  const rangeFor = (index) => {
    if (renderStyles) {
      if (Array.isArray(rescale[index]) && rescale[index].length >= 2) {
        return rescale[index];
      }
      if (Array.isArray(rescale[0]) && rescale[0].length >= 2) {
        return rescale[0];
      }
      return null;
    }
    return getStatisticsRange(bandSource(index)) || getStatisticsRange(asset);
  };

  if (bandCount >= 3) {
    const ranges = [rangeFor(0), rangeFor(1), rangeFor(2)];
    if (!ranges[0]) {
      return null;
    }
    return {
      color: [
        'color',
        stretch(1, ranges[0]),
        stretch(2, ranges[1] || ranges[0]),
        stretch(3, ranges[2] || ranges[0]),
      ],
    };
  }

  // Single band
  if (renderStyles) {
    if (render['colormap']) {
      const style = createColormapStyle(render['colormap'], rangeFor(0));
      if (style) {
        return style;
      }
    }
    // A rescale without a colormap is a grayscale stretch (as in rio-tiler)
    const range = rangeFor(0);
    if (range) {
      const gray = stretch(1, range);
      return {color: ['color', gray, gray, gray]};
    }
    return null;
  }

  // Default visualization: the classification extension for categorical
  // data (floating point data is assumed to be continuous)
  if (!isFloatingPoint(bandSource(0))) {
    let lookupBands;
    if (bandNames.length === 1) {
      const band = asset.findBand(bandNames[0]);
      if (band) {
        lookupBands = [band.getIndex() + 1];
      }
    }
    const classification = getClassificationStyle(asset, lookupBands, 1);
    if (classification) {
      return classification;
    }
  }
  // Continuous data is colored with the default colormap or stretched to
  // grayscale (consistent with single-band COGs)
  const range = rangeFor(0);
  if (range) {
    if (Array.isArray(defaultColormap) && defaultColormap.length >= 2) {
      return createGradientStyle(defaultColormap, 1, range);
    }
    const gray = stretch(1, range);
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
  // A usable render defines the complete visualization, including the bands
  // to show (paired with its value ranges)
  const render = getRenderForAsset(asset);
  if (
    isUsableRender(render) &&
    Array.isArray(render.bands) &&
    render.bands.length > 0
  ) {
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
 * Returns all potential web map links for the given STAC entity,
 * based on the given value for `displayWebMapLink`.
 * See the STACLayer option of the same name for details.
 * @param {import('stac-js').STACObject} data The STAC entity to get the links from.
 * @param {string|boolean|Array<import('./layer/STAC.js').Link|string>} [displayWebMapLink] The value of the `displayWebMapLink` option of the STACLayer.
 * @return {Array<import('./layer/STAC.js').Link>} An array of links.
 * @api
 */
export function getWebMapLinks(data, displayWebMapLink = true) {
  if (displayWebMapLink === false) {
    return [];
  }

  if (!data || data.isAsset) {
    return [];
  }

  let types = ['xyz', 'tilejson', 'pmtiles', 'wmts', 'wms']; // This also defines the priority
  if (typeof displayWebMapLink === 'string') {
    types = [displayWebMapLink];
  }
  let mapLinks = data.getLinksWithRels(types);

  if (Array.isArray(displayWebMapLink)) {
    mapLinks = displayWebMapLink
      .map((link) => {
        if (typeof link === 'string') {
          const match = mapLinks.find((candidate) => candidate.id === link);
          if (match) {
            return match;
          }
          return null;
        }
        return link;
      })
      .filter((link) => !!link);
  } else {
    mapLinks.sort((a, b) => {
      const prioA = types.indexOf(a.rel);
      const prioB = types.indexOf(b.rel);
      return prioA - prioB;
    });
  }
  return mapLinks;
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
  } else if ((!bands || bands.length === 0) && assetBands.length === 1) {
    // A single-band asset without an explicit selection
    classes = assetBands[0]['classification:classes'];
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
 * @param {number} [styleBand] The one-based band to style, if it differs
 * from the selected band (e.g. when the source only loads the selected band)
 * @return {Object|null} A WebGL tile layer style object, or null
 * @api
 */
export function getClassificationStyle(asset, bands, styleBand = null) {
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
  let band = styleBand;
  if (!band) {
    band = 1;
    if (bands && bands.length === 1) {
      band = bands[0];
    }
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

/**
 * Creates a WebGLTileLayer style for a GeoTIFF layer from the STAC metadata.
 *
 * A usable render from the render extension (see {@link isUsableRender})
 * defines the complete visualization: for single-band data its `colormap`
 * provides the colors (see {@link createColormapStyle} for the supported
 * forms), applied over the range from its `rescale`.
 *
 * Without a usable render, the classification extension
 * (`classification:classes`) provides the coloring for single-band
 * categorical data (not applied to floating point data, which is assumed
 * to be continuous), and continuous single-band data is colored with the
 * given default colormap (over the value range from the statistics).
 *
 * When no style is returned, the value ranges from
 * {@link getGeoTiffSourceInfoFromAsset} stretch the data (to grayscale for
 * a single band) instead. The returned styles operate on the raw data
 * values, i.e. the GeoTIFF source must be configured with
 * `normalize: false`.
 *
 * @param {import('stac-js').Asset} asset The STAC asset
 * @param {import('ol/source/GeoTIFF.js').SourceInfo} sourceInfo The source info
 * (for the selected bands).
 * @param {Array<import('ol/color.js').Color|string>|null} [defaultColormap] The colors
 * of the colormap for continuous single-band data, evenly distributed over the value range.
 * @return {Object|null} A WebGL tile layer style object, or null
 * @api
 */
export function getGeoTiffStyleFromAsset(
  asset,
  sourceInfo,
  defaultColormap = null,
) {
  const selected = Array.isArray(sourceInfo.bands) ? sourceInfo.bands : [];
  const bandCount =
    selected.length > 0
      ? selected.length
      : Math.max(asset.getBands().length, 1);

  const render = getRenderForAsset(asset);
  if (isUsableRender(render)) {
    if (bandCount === 1 && render['colormap']) {
      const rescale = Array.isArray(render.rescale) ? render.rescale : [];
      const range =
        Array.isArray(rescale[0]) && rescale[0].length >= 2 ? rescale[0] : null;
      return createColormapStyle(render['colormap'], range);
    }
    // The value range from the render's rescale is applied through the
    // source info instead
    return null;
  }

  if (bandCount !== 1) {
    return null;
  }

  // Default visualization: the classification extension for categorical
  // data (floating point data is assumed to be continuous)
  const bands = asset.getBands();
  let bandSource = asset;
  if (selected.length === 1 && bands.length > 0) {
    bandSource = bands[selected[0] - 1] || asset;
  } else if (selected.length === 0 && bands.length === 1) {
    bandSource = bands[0];
  }
  if (!isFloatingPoint(bandSource)) {
    // The source only loads the selected bands, so a single selected band
    // is rendered as band 1
    const classification = getClassificationStyle(
      asset,
      selected,
      selected.length === 1 ? 1 : null,
    );
    if (classification) {
      return classification;
    }
  }
  // Continuous data is colored with the default colormap, if given
  if (Array.isArray(defaultColormap) && defaultColormap.length >= 2) {
    const range =
      getStatisticsRange(bandSource) ||
      (bandSource !== asset ? getStatisticsRange(asset) : null);
    if (range) {
      return createGradientStyle(defaultColormap, 1, range);
    }
  }
  // Otherwise it is stretched to grayscale through the source info
  return null;
}

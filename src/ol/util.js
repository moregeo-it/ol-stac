/**
 * @module ol/util
 */

import VectorLayer from 'ol/layer/Vector.js';
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
 * @param {Asset} asset The asset to read the information from.
 * @param {Array<number|string>} selectedBands The bands to show. One-based index of the band, or the name of the band.
 * @return {Object} The GeoZarr source options
 * @api
 */
export function getGeoZarrSourceOptionsFromAsset(asset, selectedBands) {
  const options = {
    url: asset.getAbsoluteUrl(),
  };

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
        // eslint-disable-next-line no-console
        console.error(
          `Band with index ${band} not found in asset ${asset.getKey()}`,
        );
        return null;
      })
      .filter(Boolean);
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

  return options;
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

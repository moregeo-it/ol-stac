import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/WebGLTile.js';
import {register} from 'ol/proj/proj4.js';
import OSM from 'ol/source/OSM.js';
import proj4 from 'proj4';
import STAC from '../src/ol/layer/STAC.js';
import LayerType from '../src/ol/layer/type.js';

register(proj4); // required to support source reprojection

// The reflectance range that is stretched to the grayscale color ramp.
const minReflectance = 0;
const maxReflectance = 0.6;

/**
 * Creates a style for a single-band reflectance asset based on its STAC
 * metadata (raster extension). The scale, offset and data type reported for
 * the band are used to stretch the given reflectance range to a grayscale
 * color ramp. Without such a style the asset would render nearly black as
 * the reflectance values only cover a small part of the uint16 data range.
 * @param {import('stac-js').Asset} asset The STAC asset.
 * @return {import('ol/layer/WebGLTile.js').Style|undefined} The style.
 */
function createStyleFromMetadata(asset) {
  const bands = asset.getBands();
  if (bands.length !== 1) {
    return undefined;
  }
  const band = bands[0];
  if (band.getMetadata('data_type') !== 'uint16') {
    return undefined;
  }
  const scale = band.getMetadata('raster:scale') || 1;
  const offset = band.getMetadata('raster:offset') || 0;
  // Band values in style expressions are normalized to [0, 1] based on the
  // data type, so convert the reflectance range to normalized values.
  const toNormalized = (reflectance) => (reflectance - offset) / scale / 65535;
  const gray = [
    'interpolate',
    ['linear'],
    ['band', 1],
    toNormalized(minReflectance),
    0,
    toNormalized(maxReflectance),
    255,
  ];
  return {
    // Band 2 is the alpha band created for the nodata value,
    // it hides the areas without data.
    color: ['color', gray, gray, gray, ['band', 2]],
  };
}

const layer = new STAC({
  url: 'https://s3.us-west-2.amazonaws.com/sentinel-cogs/sentinel-s2-l2a-cogs/10/T/ES/2022/7/S2A_10TES_20220726_0_L2A/S2A_10TES_20220726_0_L2A.json',
  assets: ['nir'],
  // The function may also be asynchronous, e.g. to load a style definition
  // that is referenced in the STAC metadata.
  async getLayerOptions(type, options, asset) {
    if (type === LayerType.WebGLTile) {
      const style = createStyleFromMetadata(asset);
      if (style) {
        options.style = style;
      }
    }
    return options;
  },
});

const background = new TileLayer({
  source: new OSM(),
});

const map = new Map({
  target: 'map',
  layers: [background, layer],
  view: new View({
    center: [0, 0],
    zoom: 0,
  }),
});

layer.on('sourceready', () => {
  const view = map.getView();
  view.fit(layer.getExtent());
});

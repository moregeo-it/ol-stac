import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/WebGLTile.js';
import {register} from 'ol/proj/proj4.js';
import OSM from 'ol/source/OSM.js';
import proj4 from 'proj4';
import STAC from '../src/ol/layer/STAC.js';
import LayerType from '../src/ol/layer/type.js';

register(proj4); // required to support source reprojection

// The bands of the reflectance datacube to load (red and NIR).
const selectedBands = ['b04', 'b08'];

/**
 * Creates an NDVI style for the given asset. Which of the selected bands is
 * red and which is near-infrared is derived from the band metadata of the
 * STAC asset (`eo:common_name`) instead of being hard-coded.
 * @param {import('stac-js').Asset} asset The STAC asset.
 * @return {import('ol/layer/WebGLTile.js').Style|undefined} The style.
 */
function createNdviStyle(asset) {
  const bands = asset.getBands();
  const bandIndex = (commonName) => {
    const band = bands.find(
      (candidate) => candidate.getMetadata('eo:common_name') === commonName,
    );
    return band ? selectedBands.indexOf(band.name) + 1 : 0;
  };
  const red = bandIndex('red');
  const nir = bandIndex('nir');
  if (!red || !nir) {
    return undefined;
  }
  const ndvi = [
    '/',
    ['-', ['band', nir], ['band', red]],
    ['+', ['band', nir], ['band', red]],
  ];
  return {
    color: [
      'interpolate',
      ['linear'],
      ndvi,
      -0.2,
      '#a50026',
      0,
      '#f46d43',
      0.2,
      '#fee08b',
      0.4,
      '#a6d96a',
      0.6,
      '#1a9850',
      0.8,
      '#006837',
    ],
  };
}

const layer = new STAC({
  url: 'https://api.explorer.eopf.copernicus.eu/stac/collections/sentinel-2-l2a/items/S2C_MSIL2A_20260414T114351_N0512_R123_T30VVK_20260414T164110',
  assets: ['reflectance'],
  bands: selectedBands,
  // The function may also be asynchronous, e.g. to load a style definition
  // that is referenced in the STAC metadata.
  async getLayerOptions(type, options, asset) {
    if (type === LayerType.WebGLTile) {
      const style = createNdviStyle(asset);
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

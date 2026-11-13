import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import {register} from 'ol/proj/proj4.js';
import OSM from 'ol/source/OSM.js';
import proj4 from 'proj4';
import STAC from '../src/ol/layer/STAC.js';
import SourceType from '../src/ol/source/type.js';

register(proj4); // required to support source reprojection

/**
 * Get a Shared Access Signature Token to authorize asset requests.
 * See https://planetarycomputer.microsoft.com/docs/concepts/sas/
 * @param {string} href The unsigned URL.
 * @return {Promise<string>} A promise for the signed URL.
 */
async function sign(href) {
  const params = new URLSearchParams({href});
  const response = await fetch(
    `https://planetarycomputer.microsoft.com/api/sas/v1/sign?${params}`,
  );
  const body = await response.json();
  return body.href;
}

const layer = new STAC({
  url: 'https://planetarycomputer.microsoft.com/api/stac/v1/collections/3dep-lidar-copc/items/USGS_LPC_MD_VA_Sandy_NCR_2014_18SUJ322306_LAS_2015',
  tilt: 45,
  async getSourceOptions(type, options) {
    if (type === SourceType.COPC) {
      options.url = await sign(options.url);
    }
    return options;
  },
});

const map = new Map({
  target: 'map',
  layers: [new TileLayer({source: new OSM()}), layer],
  view: new View({
    center: [0, 0],
    zoom: 0,
  }),
});

layer.on('sourceready', () => {
  map.getView().fit(layer.getExtent());
});

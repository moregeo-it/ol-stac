import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/WebGLTile.js';
import {register} from 'ol/proj/proj4.js';
import OSM from 'ol/source/OSM.js';
import proj4 from 'proj4';
import STAC from '../src/ol/layer/STAC.js';

register(proj4); // required to support source reprojection

const layer = new STAC({
  url: 'https://api.explorer.eopf.copernicus.eu/stac/collections/sentinel-2-l2a/items/S2B_MSIL2A_20260120T125339_N0511_R138_T27VWL_20260120T131151',
  displayWebMapLink: false,
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

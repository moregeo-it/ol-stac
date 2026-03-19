import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/WebGLTile.js';
import {register} from 'ol/proj/proj4.js';
import OSM from 'ol/source/OSM.js';
import proj4 from 'proj4';
import STAC from '../src/ol/layer/STAC.js';

register(proj4); // required to support source reprojection

const layer = new STAC({
  url: 'https://api.explorer.eopf.copernicus.eu/stac/collections/sentinel-2-l2a/items/S2A_MSIL2A_20260318T142851_N0512_R139_T26WME_20260318T224412',
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

layer.on('error', (event) => {
  alert('An unexpected error occured: ' + event.error.message);
});

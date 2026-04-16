import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/WebGLTile.js';
import {register} from 'ol/proj/proj4.js';
import OSM from 'ol/source/OSM.js';
import proj4 from 'proj4';
import STAC from '../src/ol/layer/STAC.js';
import {getStacObjectsForEvent} from '../src/ol/util.js';

register(proj4); // required to support source reprojection

const layer = new STAC({
  url: 'https://earth-search.aws.element84.com/v1/search?bbox=-16.9,12.85,-14.9,13.97&collections=sentinel-2-c1-l2a&limit=12',
  displayPreview: true,
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
map.on('singleclick', async (event) => {
  const objects = await getStacObjectsForEvent(event);
  if (objects.length > 0) {
    const ids = objects.map((obj) => obj.properties.productIdentifier);
    document.getElementById('ids').innerText = ids.join(', ');
  }
});
layer.on('sourceready', () => {
  const view = map.getView();
  view.fit(layer.getExtent());
});

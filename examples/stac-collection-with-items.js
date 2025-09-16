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
  url: 'https://planetarycomputer.microsoft.com/api/stac/v1/collections/esa-cci-lc',
  displayPreview: false,
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
    showFullExtent: true,
  }),
});
map.on('singleclick', async (event) => {
  const objects = await getStacObjectsForEvent(event, layer.getData());
  if (objects.length > 0) {
    const ids = objects.map((obj) => obj.id);
    document.getElementById('ids').innerText = ids.join(', ');
  }
});
layer.on('sourceready', () => {
  const view = map.getView();
  view.fit(layer.getExtent());
});

fetch(
  'https://planetarycomputer.microsoft.com/api/stac/v1/collections/esa-cci-lc/items?datetime=2020-01-01T00%3A00%3A00.000Z%2F2020-12-31T00%3A00%3A00.000Z&limit=32',
)
  .then((response) => response.json())
  .then((items) => {
    layer.setChildren(items, {displayPreview: true});
  })
  .catch((error) => {
    alert('Error fetching items:' + error.message);
  });

import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/WebGLTile.js';
import {register} from 'ol/proj/proj4.js';
import OSM from 'ol/source/OSM.js';
import proj4 from 'proj4';
import STAC from '../src/ol/layer/STAC.js';

register(proj4); // required to support source reprojection

const background = new TileLayer({
  source: new OSM(),
});

const map = new Map({
  target: 'map',
  layers: [background],
  view: new View({
    center: [0, 0],
    zoom: 0,
  }),
});

const select = document.getElementById('url-select');
const input = document.getElementById('custom-url');
const button = document.getElementById('load-url');

let layer;
updateLayer();

function getUrl() {
  return select.value === 'custom' ? input.value : select.value;
}

function updateLayer() {
  if (layer) {
    map.removeLayer(layer);
  }
  layer = new STAC({
    url: getUrl(),
    displayWebMapLink: false,
  });
  layer.on('sourceready', () => {
    const view = map.getView();
    view.fit(layer.getExtent());
  });
  layer.on('error', (event) => {
    alert('An unexpected error occurred: ' + event.error.message);
  });
  map.addLayer(layer);
  return layer;
}

button.addEventListener('click', updateLayer);

select.addEventListener('change', () => {
  if (select.value === 'custom') {
    input.style.display = '';
    input.focus();
  } else {
    input.style.display = 'none';
  }
});

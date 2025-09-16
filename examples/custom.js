import Map from 'ol/Map.js';
import OSM from 'ol/source/OSM.js';
import STAC from '../src/ol/layer/STAC.js';
import TileLayer from 'ol/layer/WebGLTile.js';
import View from 'ol/View.js';
import proj4 from 'proj4';
import {register} from 'ol/proj/proj4.js';

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

window.onload = function () {
  document.getElementById('load-btn').addEventListener('click', showUrl);
  document.getElementById('reset-btn').addEventListener('click', resetUrl);
  showUrl();
};

let layer;

function resetUrl() {
  document.getElementById('url-input').value = '';
  showUrl();
}

function showUrl() {
  if (layer) {
    map.removeLayer(layer);
  }

  const url = document.getElementById('url-input').value;
  if (!url) {
    return;
  }

  try {
    layer = new STAC({
      url,
      displayPreview: true,
      displayGeoTiffByDefault: true,
      displayWebMapLink: true,
    });
    layer.on('sourceready', () => {
      const view = map.getView();
      view.fit(layer.getExtent());
    });
    layer.on('layersready', () => {
      if (layer.isEmpty()) {
        alert('No spatial information available in the data source');
      }
    });
    layer.on('error', (event) => {
      alert(`Error loading STAC data: ${event.error}`);
    });
    map.addLayer(layer);
  } catch (error) {
    alert(error.message);
  }
}

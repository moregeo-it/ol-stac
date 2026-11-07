import {COPCLayer} from 'ol-copc';
import Map from 'ol/Map.js';
import Control from 'ol/control/Control.js';
import TileLayer from 'ol/layer/Tile.js';
import {register} from 'ol/proj/proj4.js';
import OSM from 'ol/source/OSM.js';
import proj4 from 'proj4';
import STAC from '../src/ol/layer/STAC.js';

register(proj4); // required to support source reprojection

const tilt = /** @type {HTMLInputElement} */ (document.getElementById('tilt'));
const item = /** @type {HTMLSelectElement} */ (document.getElementById('item'));
const color = /** @type {HTMLSelectElement} */ (
  document.getElementById('color')
);
const edl = /** @type {HTMLInputElement} */ (document.getElementById('edl'));
const walls = /** @type {HTMLInputElement} */ (
  document.getElementById('walls')
);

/**
 * Creates a STAC Item for a point cloud.
 * @param {string} id The id.
 * @param {string} title The title.
 * @param {Array<Array<number>>} corners The corners of the point cloud (longitude, latitude).
 * @param {number} count The number of points.
 * @param {Object} [asset] Additional asset properties.
 * @return {Object} The STAC Item.
 */
function createItem(id, title, corners, count, asset = {}) {
  const lons = corners.map((corner) => corner[0]);
  const lats = corners.map((corner) => corner[1]);
  return {
    'type': 'Feature',
    'stac_version': '1.1.0',
    'stac_extensions': [
      'https://stac-extensions.github.io/pointcloud/v2.0.0/schema.json',
      'https://stac-extensions.github.io/classification/v2.0.0/schema.json',
      'https://stac-extensions.github.io/attribution/v0.1.0/schema.json',
    ],
    'id': id,
    'bbox': [
      Math.min(...lons),
      Math.min(...lats),
      Math.max(...lons),
      Math.max(...lats),
    ],
    'geometry': {
      'type': 'Polygon',
      'coordinates': [[...corners, corners[0]]],
    },
    'properties': {
      'title': title,
      // The files don't provide the acquisition date
      'datetime': '0001-01-01T00:00:00Z',
      'pc:count': count,
      'pc:type': 'lidar',
      'pc:encoding': 'LASzip',
      'attribution': 'Point cloud: <a href="https://hobu.co">Hobu, Inc.</a>',
    },
    'assets': {
      'data': {
        'href': `https://s3.amazonaws.com/hobu-lidar/${id}.copc.laz`,
        'type': 'application/vnd.laszip+copc',
        'roles': ['data'],
        ...asset,
      },
    },
    'links': [],
  };
}

const items = {
  autzen: createItem(
    'autzen-classified',
    'Autzen Stadium, Oregon',
    [
      [-123.075535, 44.04971459],
      [-123.0619527, 44.04971459],
      [-123.0619527, 44.06277605],
      [-123.075535, 44.06277605],
    ],
    10653336,
    {
      'classification:classes': [
        {value: 1, name: 'unclassified', color_hint: 'AAAAAA'},
        {value: 2, name: 'ground', color_hint: 'AA5500'},
        {value: 3, name: 'low-vegetation', color_hint: '00AAAA'},
        {value: 4, name: 'medium-vegetation', color_hint: '55FF55'},
        {value: 5, name: 'high-vegetation', color_hint: '00AA00'},
        {value: 6, name: 'building', color_hint: 'FF5555'},
        {value: 7, name: 'low-point', color_hint: 'AA00AA'},
        {value: 9, name: 'water', color_hint: '5555FF'},
        {value: 17, name: 'bridge-deck', color_hint: 'FFFF55'},
      ],
    },
  ),
  sofi: createItem(
    'sofi',
    'SoFi Stadium, California',
    [
      [-118.3444385, 33.9479997],
      [-118.3321595, 33.9481332],
      [-118.3323363, 33.9594743],
      [-118.3446169, 33.9593407],
    ],
    364384576,
  ),
};

const map = new Map({
  target: 'map',
  layers: [new TileLayer({source: new OSM()})],
});
map.addControl(
  new Control({element: document.getElementById('view-controls')}),
);

/** @type {STAC|null} */
let layer = null;

/**
 * @return {COPCLayer|undefined} The point cloud layer, once added.
 */
const getPointCloud = () =>
  /** @type {COPCLayer|undefined} */ (
    layer.getLayersArray().find((l) => l instanceof COPCLayer)
  );

function showItem() {
  if (layer) {
    map.removeLayer(layer);
    // Disposing the point cloud layer also terminates its workers
    layer.getLayersArray().forEach((l) => l.dispose());
    layer.dispose();
  }
  layer = new STAC({
    data: items[item.value],
    tilt: Number(tilt.value),
  });
  layer.on('sourceready', () => {
    map.getView().fit(layer.getExtent());
  });
  layer.on('layersready', () => {
    color.value = getPointCloud()?.getColorMode() || '';
    getPointCloud()?.setEDL(Number(edl.value));
    getPointCloud()?.setWalls(walls.checked);
  });
  map.addLayer(layer);
}

showItem();
item.addEventListener('change', showItem);

tilt.addEventListener('input', () => {
  document.getElementById('tilt-value').textContent = `${tilt.value}°`;
  layer.setTilt(Number(tilt.value));
});
color.addEventListener('change', () =>
  getPointCloud()?.setColorMode(/** @type {*} */ (color.value)),
);
edl.addEventListener('input', () => getPointCloud()?.setEDL(Number(edl.value)));
walls.addEventListener('change', () =>
  getPointCloud()?.setWalls(walls.checked),
);

const rotate = (delta) => {
  const view = map.getView();
  view.animate({rotation: view.getRotation() + delta, duration: 300});
};
document
  .getElementById('rotate-left')
  .addEventListener('click', () => rotate(-Math.PI / 4));
document
  .getElementById('rotate-right')
  .addEventListener('click', () => rotate(Math.PI / 4));

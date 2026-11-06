import Map from 'ol/Map.js';
import TileLayer from 'ol/layer/Tile.js';
import WebGLTileLayer from 'ol/layer/WebGLTile.js';
import {register} from 'ol/proj/proj4.js';
import OSM from 'ol/source/OSM.js';
import proj4 from 'proj4';
import STAC from '../src/ol/layer/STAC.js';
import COPCBand from '../src/ol/source/COPCBand.js';
import {getCOPCStyleFromAsset} from '../src/ol/util.js';

register(proj4); // required to support source reprojection

const classes = [
  {value: 1, name: 'unclassified', color_hint: 'AAAAAA'},
  {value: 2, name: 'ground', color_hint: 'AA5500'},
  {value: 3, name: 'low-vegetation', color_hint: '00AAAA'},
  {value: 4, name: 'medium-vegetation', color_hint: '55FF55'},
  {value: 5, name: 'high-vegetation', color_hint: '00AA00'},
  {value: 6, name: 'building', color_hint: 'FF5555'},
  {value: 7, name: 'low-point', color_hint: 'AA00AA'},
  {value: 9, name: 'water', color_hint: '5555FF'},
  {value: 17, name: 'bridge-deck', color_hint: 'FFFF55'},
];

const layer = new STAC({
  data: {
    'type': 'Feature',
    'stac_version': '1.1.0',
    'stac_extensions': [
      'https://stac-extensions.github.io/pointcloud/v2.0.0/schema.json',
      'https://stac-extensions.github.io/classification/v2.0.0/schema.json',
    ],
    'id': 'autzen-classified.copc.laz',
    'bbox': [-123.075535, 44.04971459, -123.0619527, 44.06277605],
    'geometry': {
      'type': 'Polygon',
      'coordinates': [
        [
          [-123.075535, 44.04971459],
          [-123.0619527, 44.04971459],
          [-123.0619527, 44.06277605],
          [-123.075535, 44.06277605],
          [-123.075535, 44.04971459],
        ],
      ],
    },
    'properties': {
      'datetime': null,
      'start_datetime': '2010-01-01T00:00:00Z',
      'end_datetime': '2010-12-31T23:59:59Z',
      'title': 'Autzen Stadium, Eugene, Oregon',
      'pc:count': 10653336,
      'pc:type': 'lidar',
      'pc:encoding': 'LASzip',
      'pc:statistics': [
        {'name': 'Z', 'minimum': 406.14, 'maximum': 615.26},
        {'name': 'Intensity', 'minimum': 0, 'maximum': 2000},
        {'name': 'Red', 'minimum': 2048, 'maximum': 63744},
        {'name': 'Green', 'minimum': 8704, 'maximum': 65024},
        {'name': 'Blue', 'minimum': 18688, 'maximum': 63488},
      ],
    },
    'assets': {
      'data': {
        'href':
          'https://s3.amazonaws.com/hobu-lidar/autzen-classified.copc.laz',
        'type': 'application/vnd.laszip+copc',
        'roles': ['data'],
        'classification:classes': classes,
      },
    },
    'links': [],
  },
});

const background = new TileLayer({
  source: new OSM(),
});

const map = new Map({
  target: 'map',
  layers: [background, layer],
});
layer.on('sourceready', () => {
  map.getView().fit(layer.getExtent());
});

const shade = ['clamp', ['*', ['band', COPCBand.Shade], 300], 0, 255];
const shaded = (color) => ({
  color: [
    'case',
    ['>', ['band', COPCBand.Alpha], 0],
    ['*', color, ['color', shade, shade, shade, 1]],
    ['color', 0, 0, 0, 0],
  ],
});
const gradient = (band, min, max) => [
  'interpolate',
  ['linear'],
  ['band', band],
  min,
  '#440154',
  min + (max - min) / 2,
  '#21918c',
  max,
  '#fde725',
];
const rgb = (band) => ['/', ['band', band], 256];
const styles = {
  rgb: shaded([
    'color',
    rgb(COPCBand.Red),
    rgb(COPCBand.Green),
    rgb(COPCBand.Blue),
    1,
  ]),
  elevation: shaded(gradient(COPCBand.Z, 406, 615)),
  intensity: shaded(gradient(COPCBand.Intensity, 0, 400)),
};

const select = /** @type {HTMLSelectElement} */ (
  document.getElementById('style')
);
select.addEventListener('change', () => {
  const pointCloud = /** @type {WebGLTileLayer} */ (
    layer.getLayersArray().find((l) => l instanceof WebGLTileLayer)
  );
  if (!pointCloud) {
    return;
  }
  const style =
    select.value === 'metadata'
      ? getCOPCStyleFromAsset(
          layer.getData().getAsset('data'),
          /** @type {*} */ (pointCloud.getSource()),
        )
      : styles[select.value];
  pointCloud.setStyle(style);
});

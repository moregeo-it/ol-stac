import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/WebGLTile.js';
import {register} from 'ol/proj/proj4.js';
import OSM from 'ol/source/OSM.js';
import proj4 from 'proj4';
import STAC from '../src/ol/layer/STAC.js';

register(proj4); // required to support source reprojection

const layer = new STAC({
  displayWebMapLink: true,
  data: {
    'stac_version': '1.0.0',
    'stac_extensions': [
      'https://stac-extensions.github.io/web-map-links/v1.2.0/schema.json',
    ],
    'type': 'Collection',
    'id': 'averaged_PM10',
    'description': 'Particulate matter 10µm',
    'license': 'CC-BY-4.0',
    'attribution':
      'Copyright "© 2023 <a href="www.ecmwf.int">European Centre for Medium-Range Weather Forecasts (ECMWF)</a>',
    'extent': {
      'spatial': {
        'bbox': [[-25, 30, 45, 71]],
      },
      'temporal': {
        'interval': [['2022-09-22T00:00:00Z', '2023-07-31T00:00:00Z']],
      },
    },
    'links': [
      {
        'href': 'https://eccharts.ecmwf.int/wms/?token=public',
        'rel': 'wms',
        'type': 'image/png',
        'wms:layers': ['composition_europe_pm10_analysis_surface'],
      },
    ],
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

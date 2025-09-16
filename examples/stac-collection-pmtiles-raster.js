import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/WebGLTile.js';
import {register} from 'ol/proj/proj4.js';
import OSM from 'ol/source/OSM.js';
import proj4 from 'proj4';
import STAC from '../src/ol/layer/STAC.js';

register(proj4); // required to support source reprojection

const layer = new STAC({
  displayWebMapLink: 'pmtiles',
  data: {
    'stac_version': '1.0.0',
    'stac_extensions': [
      'https://stac-extensions.github.io/web-map-links/v1.2.0/schema.json',
    ],
    'type': 'Collection',
    'id': 'dem',
    'description': 'DEM of the world',
    'license': 'proprietary',
    'attribution':
      'see <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">tilezen/joerd</a>',
    'extent': {
      'spatial': {
        'bbox': [[-180, -90, 180, 90]],
      },
      'temporal': {
        'interval': [[null, null]],
      },
    },
    'links': [
      {
        'href':
          'https://r2-public.protomaps.com/protomaps-sample-datasets/terrarium_z9.pmtiles',
        'rel': 'pmtiles',
        'type': 'application/vnd.pmtiles',
        'pmtiles:layers': ['dem'],
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

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
  displayFootprint: false,
  data: {
    'stac_version': '1.1.0',
    'stac_extensions': [
      'https://stac-extensions.github.io/web-map-links/v1.2.0/schema.json',
    ],
    'type': 'Collection',
    'id': 'Overtuere Maps Buildings',
    'description':
      'The Overture Maps buildings theme describes human-made structures with roofs or interior spaces that are permanently or semi-permanently in one place.',
    'license': 'ODbL',
    'attribution': '© Overture Maps Foundation',
    'extent': {
      'spatial': {
        'bbox': [[-180, -90, 180, 90]],
      },
      'temporal': {
        'interval': [['2025-04-23T00:00:00Z', '2025-04-24T00:00:00Z']],
      },
    },
    'links': [
      {
        'href':
          'https://overturemaps-tiles-us-west-2-beta.s3.amazonaws.com/2025-04-23/places.pmtiles',
        'rel': 'pmtiles',
        'type': 'application/vnd.pmtiles',
        'title': 'Buildings',
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

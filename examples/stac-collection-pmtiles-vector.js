import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/WebGLTile.js';
import {register} from 'ol/proj/proj4.js';
import {fromLonLat} from 'ol/proj.js';
import OSM from 'ol/source/OSM.js';
import {Fill, Stroke, Style} from 'ol/style.js';
import proj4 from 'proj4';
import STAC from '../src/ol/layer/STAC.js';
import LayerType from '../src/ol/layer/type.js';

register(proj4); // required to support source reprojection

const layer = new STAC({
  displayWebMapLink: 'pmtiles',
  displayFootprint: false,
  // Add a custom style for the buildings
  getLayerOptions(type, options) {
    if (type === LayerType.VectorTile) {
      options.style = new Style({
        fill: new Fill({color: 'rgba(255, 0, 0, 0.8)'}),
        stroke: new Stroke({color: '#990000', width: 1}),
      });
    }
    return options;
  },
  data: {
    'stac_version': '1.1.0',
    'stac_extensions': [
      'https://stac-extensions.github.io/web-map-links/v1.2.0/schema.json',
    ],
    'type': 'Collection',
    'id': 'Overture Maps Buildings',
    'description':
      'The Overture Maps buildings theme describes human-made structures with roofs or interior spaces that are permanently or semi-permanently in one place. Hosted on Source Cooperative.',
    'license': 'ODbL',
    'attribution': '© Overture Maps Foundation',
    'extent': {
      'spatial': {
        'bbox': [[-180, -83.66, 180, 82.53]],
      },
      'temporal': {
        'interval': [['2023-07-26T00:00:00Z', null]],
      },
    },
    'links': [
      {
        'href':
          'https://data.source.coop/cholmes/overture/overture-buildings.pmtiles',
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
    // Zoom to a specific location to visualize the buildings
    center: fromLonLat([7.6261, 51.9607]),
    zoom: 15,
  }),
});

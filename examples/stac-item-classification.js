import Map from 'ol/Map.js';
import {register} from 'ol/proj/proj4.js';
import proj4 from 'proj4';
import STAC from '../src/ol/layer/STAC.js';
import {getClassificationClasses} from '../src/ol/util.js';

register(proj4); // required to support source reprojection

const layer = new STAC({
  url: 'https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/S2A_31SBD_20260312_1_L2A',
  data: {
    type: 'Feature',
    stac_version: '1.0.0',
    stac_extensions: [
      'https://stac-extensions.github.io/eo/v1.1.0/schema.json',
      'https://stac-extensions.github.io/projection/v1.1.0/schema.json',
      'https://stac-extensions.github.io/classification/v2.0.0/schema.json',
    ],
    id: 'S2A_31SBD_20260312_1_L2A',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-0.49896480277672595, 39.69750082538408],
          [-0.45024906258962005, 38.70992952974502],
          [0.8113363003621146, 38.740378746353734],
          [0.7803878365963612, 39.72903403736024],
          [-0.49896480277672595, 39.69750082538408],
        ],
      ],
    },
    bbox: [-0.498965, 38.70993, 0.811336, 39.729034],
    properties: {
      platform: 'sentinel-2a',
      constellation: 'sentinel-2',
      instruments: ['msi'],
      'eo:cloud_cover': 58.614683,
      'proj:epsg': 32631,
      datetime: '2026-03-12T11:00:34.768000Z',
    },
    links: [
      {
        rel: 'self',
        type: 'application/geo+json',
        href: 'https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/S2A_31SBD_20260312_1_L2A',
      },
      {
        rel: 'license',
        href: 'https://sentinel.esa.int/documents/247904/690755/Sentinel_Data_Legal_Notice',
      },
    ],
    assets: {
      scl: {
        href: 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/31/S/BD/2026/3/S2A_31SBD_20260312_1_L2A/SCL.tif',
        type: 'image/tiff; application=geotiff; profile=cloud-optimized',
        title: 'Scene classification map (SCL)',
        gsd: 20,
        'proj:shape': [5490, 5490],
        'proj:transform': [20, 0, 199980, 0, -20, 4400040],
        data_type: 'uint8',
        roles: ['data'],
        'classification:classes': [
          {
            value: 0,
            name: 'no_data',
            description: 'No Data (Missing data)',
            nodata: true,
          },
          {
            value: 1,
            name: 'saturated_or_defective',
            description: 'Saturated or defective pixel',
            color_hint: 'FF0000',
          },
          {
            value: 2,
            name: 'dark_area_pixels',
            description:
              'Topographic casted shadows (formerly "Dark features/Shadows")',
            color_hint: '2F2F2F',
          },
          {
            value: 3,
            name: 'cloud_shadows',
            description: 'Cloud shadows',
            color_hint: '643200',
          },
          {
            value: 4,
            name: 'vegetation',
            description: 'Vegitation',
            color_hint: '00A000',
          },
          {
            value: 5,
            name: 'not_vegetated',
            description: 'Not-vegetated',
            color_hint: 'FFE65A',
          },
          {
            value: 6,
            name: 'water',
            description: 'Water',
            color_hint: '0000FF',
          },
          {
            value: 7,
            name: 'unclassified',
            description: 'Unclassified',
            color_hint: '808080',
          },
          {
            value: 8,
            name: 'cloud_medium_probability',
            description: 'Cloud - medium probability',
            color_hint: 'BBBBBB',
          },
          {
            value: 9,
            name: 'cloud_high_probability',
            description: 'Cloud - high probability',
            color_hint: 'DDDDDD',
          },
          {
            value: 10,
            name: 'thin_cirrus',
            description: 'Thin cirrus',
            color_hint: '64C8FF',
          },
          {
            value: 11,
            name: 'snow',
            description: 'Snow or ice',
            color_hint: 'FF96FF',
          },
        ],
      },
    },
  },
});

const map = new Map({
  target: 'map',
  layers: [layer],
});
layer.on('sourceready', () => {
  const view = map.getView();
  view.fit(layer.getExtent());

  // Build a legend from the classification classes
  const stac = layer.getData();
  const asset = stac.getAsset('scl');
  const classes = getClassificationClasses(asset);
  const legend = document.getElementById('legend');
  for (const cls of classes) {
    const row = document.createElement('div');
    const swatch = document.createElement('span');
    const color = cls.color_hint ? `#${cls.color_hint}` : 'transparent';
    swatch.style.cssText = `display:inline-block;width:16px;height:16px;margin-right:6px;vertical-align:middle;background:${color};border: 1px solid black;`;
    row.appendChild(swatch);
    row.appendChild(
      document.createTextNode(cls.description || cls.title || cls.name),
    );
    legend.appendChild(row);
  }
});

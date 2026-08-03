import TileLayer from 'ol/layer/Tile.js';
import XYZ from 'ol/source/XYZ.js';
import STAC from '../../../../../src/ol/layer/STAC.js';
import LayerType from '../../../../../src/ol/layer/type.js';

function getItem() {
  return {
    stac_version: '1.0.0',
    type: 'Feature',
    id: 'test-item',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [172, -42],
          [175, -42],
          [175, -39],
          [172, -39],
          [172, -42],
        ],
      ],
    },
    bbox: [172, -42, 175, -39],
    properties: {
      datetime: '2024-01-01T00:00:00Z',
    },
    links: [
      {
        href: 'https://example.com/tiles/{z}/{x}/{y}.png',
        rel: 'xyz',
        id: 'tiles',
        type: 'image/png',
      },
    ],
    assets: {},
  };
}

describe('ol/layer/STAC', function () {
  describe('constructor (defaults)', function () {
    /** @type {STAC} */
    let group;

    beforeEach(function () {
      group = new STAC({
        url: 'https://s3.us-west-2.amazonaws.com/sentinel-cogs/sentinel-s2-l2a-cogs/10/T/ES/2022/7/S2A_10TES_20220726_0_L2A/S2A_10TES_20220726_0_L2A.json',
      });
    });

    it('creates an instance', function () {
      expect(group).to.be.a(STAC);
    });
  });

  describe('getLayerOptions', function () {
    it('is called with the layer type, options and reference and its result is used', async function () {
      const calls = [];
      const group = new STAC({
        data: getItem(),
        getLayerOptions(type, options, reference) {
          calls.push({type, options, reference});
          return Object.assign({}, options, {
            opacity: 0.5,
            properties: {custom: true},
          });
        },
      });

      const link = group.getData().getLinksWithRels(['xyz'])[0];
      const [layer] = await group.addLayerForLink(link);

      expect(calls.length).to.be(1);
      expect(calls[0].type).to.be(LayerType.Tile);
      expect(calls[0].options.source).to.be.an(XYZ);
      expect(calls[0].reference.rel).to.be('xyz');

      expect(layer).to.be.a(TileLayer);
      expect(layer.getOpacity()).to.be(0.5);
      expect(layer.get('custom')).to.be(true);
    });

    it('supports asynchronous functions', async function () {
      const group = new STAC({
        data: getItem(),
        getLayerOptions(type, options) {
          return Promise.resolve(Object.assign({}, options, {opacity: 0.25}));
        },
      });

      const link = group.getData().getLinksWithRels(['xyz'])[0];
      const [layer] = await group.addLayerForLink(link);

      expect(layer.getOpacity()).to.be(0.25);
    });
  });
});

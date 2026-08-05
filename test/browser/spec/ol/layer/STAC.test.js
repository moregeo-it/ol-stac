import TileLayer from 'ol/layer/Tile.js';
import XYZ from 'ol/source/XYZ.js';
import STAC from '../../../../../src/ol/layer/STAC.js';
import LayerType from '../../../../../src/ol/layer/type.js';
import SourceType from '../../../../../src/ol/source/type.js';

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

/**
 * Polls until the given condition is truthy.
 * @param {function():*} condition The condition to wait for.
 * @return {Promise} Resolves once the condition is truthy.
 */
function waitFor(condition) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - start > 2000) {
        reject(new Error('Timeout waiting for condition'));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

/**
 * Creates a minimal STAC Item.
 * @param {Object} assets The assets.
 * @param {Array<Object>} links Additional links.
 * @return {Object} The STAC Item.
 */
function createItem(assets = {}, links = []) {
  return {
    type: 'Feature',
    stac_version: '1.0.0',
    id: 'test-item',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
          [0, 0],
        ],
      ],
    },
    bbox: [0, 0, 1, 1],
    properties: {
      datetime: '2024-01-01T00:00:00Z',
    },
    links,
    assets,
  };
}

const COG_ASSET = {
  href: 'https://example.com/asset.tif',
  type: 'image/tiff; application=geotiff; profile=cloud-optimized',
  roles: ['visual'],
};

const THUMBNAIL_ASSET = {
  href: 'https://example.com/thumb.png',
  type: 'image/png',
  roles: ['thumbnail'],
};

const GEOZARR_ASSET = {
  href: 'https://example.com/store.zarr/measurements/reflectance',
  type: 'application/vnd.zarr; version=3; profile=multiscales',
  roles: ['data'],
};

const AUTH_HEADERS = {Authorization: 'Bearer 123'};

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

  describe('getRequestHeaders', function () {
    let fetchStub;
    let captured;

    beforeEach(function () {
      captured = [];
      fetchStub = sinon
        .stub(window, 'fetch')
        .callsFake(() => Promise.resolve(new Response('', {status: 404})));
    });

    afterEach(function () {
      fetchStub.restore();
      fetchStub = null;
    });

    /**
     * A getSourceOptions function that captures all calls.
     * @param {SourceType} type The source type.
     * @param {Object} options The source options.
     * @return {Object} The unchanged source options.
     */
    function captureSourceOptions(type, options) {
      captured.push({type, options});
      return options;
    }

    /**
     * Get the captured source options for the given source type.
     * @param {SourceType} type The source type.
     * @return {Object|undefined} The source options.
     */
    function getCaptured(type) {
      const entry = captured.find((c) => c.type === type);
      return entry && entry.options;
    }

    it('passes headers to the GeoTIFF source options', async function () {
      const group = new STAC({
        data: createItem({cog: COG_ASSET}),
        getRequestHeaders: () => AUTH_HEADERS,
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.GeoTIFF));
      const options = getCaptured(SourceType.GeoTIFF);
      expect(options.sourceOptions).to.be.an('object');
      expect(options.sourceOptions.headers).to.eql(AUTH_HEADERS);
    });

    it('accepts a plain object for getRequestHeaders', async function () {
      const group = new STAC({
        data: createItem({cog: COG_ASSET}),
        getRequestHeaders: AUTH_HEADERS,
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.GeoTIFF));
      const options = getCaptured(SourceType.GeoTIFF);
      expect(options.sourceOptions.headers).to.eql(AUTH_HEADERS);
    });

    it('does not change the GeoTIFF source options by default', async function () {
      const group = new STAC({
        data: createItem({cog: COG_ASSET}),
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.GeoTIFF));
      const options = getCaptured(SourceType.GeoTIFF);
      expect(options.sourceOptions).to.be(undefined);
    });

    it('excludes URLs for which no headers are returned', async function () {
      const group = new STAC({
        data: createItem({cog: COG_ASSET}),
        getRequestHeaders: (ref, url) =>
          url.includes('example.com') ? null : AUTH_HEADERS,
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.GeoTIFF));
      const options = getCaptured(SourceType.GeoTIFF);
      expect(options.sourceOptions).to.be(undefined);
    });

    it('passes headers to the GeoZarr source options', async function () {
      const group = new STAC({
        data: createItem({zarr: GEOZARR_ASSET}),
        getRequestHeaders: () => AUTH_HEADERS,
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.GeoZarr));
      const options = getCaptured(SourceType.GeoZarr);
      expect(options.sourceOptions).to.be.an('object');
      expect(options.sourceOptions.headers).to.eql(AUTH_HEADERS);
    });

    it('does not change the GeoZarr source options by default', async function () {
      const group = new STAC({
        data: createItem({zarr: GEOZARR_ASSET}),
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.GeoZarr));
      const options = getCaptured(SourceType.GeoZarr);
      expect(options.sourceOptions).to.be(undefined);
    });

    it('sets an imageLoadFunction for preview images', async function () {
      const group = new STAC({
        data: createItem({thumbnail: THUMBNAIL_ASSET}),
        displayPreview: true,
        getRequestHeaders: () => AUTH_HEADERS,
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.ImageStatic));
      const options = getCaptured(SourceType.ImageStatic);
      expect(options.imageLoadFunction).to.be.a('function');
    });

    it('sets no imageLoadFunction by default', async function () {
      const group = new STAC({
        data: createItem({thumbnail: THUMBNAIL_ASSET}),
        displayPreview: true,
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.ImageStatic));
      const options = getCaptured(SourceType.ImageStatic);
      expect(options.imageLoadFunction).to.be(undefined);
    });

    it('sets a tileLoadFunction for XYZ web map links', async function () {
      const group = new STAC({
        data: createItem({}, [
          {
            rel: 'xyz',
            href: 'https://example.com/{z}/{x}/{y}.png',
            type: 'image/png',
          },
        ]),
        displayWebMapLink: true,
        getRequestHeaders: () => AUTH_HEADERS,
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.XYZ));
      const options = getCaptured(SourceType.XYZ);
      expect(options.tileLoadFunction).to.be.a('function');
    });

    it('sets no tileLoadFunction by default', async function () {
      const group = new STAC({
        data: createItem({}, [
          {
            rel: 'xyz',
            href: 'https://example.com/{z}/{x}/{y}.png',
            type: 'image/png',
          },
        ]),
        displayWebMapLink: true,
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.XYZ));
      const options = getCaptured(SourceType.XYZ);
      expect(options.tileLoadFunction).to.be(undefined);
    });

    it('sends headers with the default fetch function', async function () {
      fetchStub.callsFake(() =>
        Promise.resolve(
          new Response(JSON.stringify(createItem()), {
            status: 200,
            headers: {'Content-Type': 'application/json'},
          }),
        ),
      );
      const group = new STAC({
        url: 'https://example.com/item.json',
        getRequestHeaders: () => AUTH_HEADERS,
      });
      group.on('error', () => {});
      await waitFor(() => fetchStub.called);
      const init = fetchStub.firstCall.args[1];
      expect(init.headers).to.eql(AUTH_HEADERS);
    });

    it('sends no headers with the default fetch function by default', async function () {
      fetchStub.callsFake(() =>
        Promise.resolve(
          new Response(JSON.stringify(createItem()), {
            status: 200,
            headers: {'Content-Type': 'application/json'},
          }),
        ),
      );
      const group = new STAC({
        url: 'https://example.com/item.json',
      });
      group.on('error', () => {});
      await waitFor(() => fetchStub.called);
      const init = fetchStub.firstCall.args[1];
      expect(init && init.headers).to.be(undefined);
    });

    describe('PMTiles', function () {
      const PMTILES_LINK = {
        rel: 'pmtiles',
        href: 'https://example.com/tiles.pmtiles',
        type: 'application/vnd.pmtiles',
      };

      it('calls getSourceOptions before the type is sniffed', async function () {
        const group = new STAC({
          data: createItem({}, [PMTILES_LINK]),
          displayWebMapLink: true,
          getSourceOptions: (type, options) => {
            captured.push({type, options});
            if (type === SourceType.PMTiles) {
              options.url = 'https://rewritten.example/tiles.pmtiles';
            }
            return options;
          },
        });
        group.on('error', () => {});
        await waitFor(() => fetchStub.called);
        expect(getCaptured(SourceType.PMTiles)).to.be.an('object');
        const url = fetchStub.firstCall.args[0];
        expect(url).to.contain('rewritten.example');
      });

      it('passes headers to the PMTiles requests', async function () {
        const group = new STAC({
          data: createItem({}, [PMTILES_LINK]),
          displayWebMapLink: true,
          getRequestHeaders: () => AUTH_HEADERS,
          getSourceOptions: captureSourceOptions,
        });
        group.on('error', () => {});
        await waitFor(() => fetchStub.called);
        const init = fetchStub.firstCall.args[1];
        expect(init.headers.get('authorization')).to.be('Bearer 123');
      });
    });
  });
});

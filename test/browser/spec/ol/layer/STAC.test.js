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
      expect(group).to.be.a.instanceOf(STAC);
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

      expect(calls.length).to.equal(1);
      expect(calls[0].type).to.equal(LayerType.Tile);
      expect(calls[0].options.source).to.be.an.instanceOf(XYZ);
      expect(calls[0].reference.rel).to.equal('xyz');

      expect(layer).to.be.a.instanceOf(TileLayer);
      expect(layer.getOpacity()).to.equal(0.5);
      expect(layer.get('custom')).to.equal(true);
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

      expect(layer.getOpacity()).to.equal(0.25);
    });
  });

  describe('getRequestUrl', function () {
    let fetchStub;
    let captured;
    let urlCalls;

    beforeEach(function () {
      captured = [];
      urlCalls = [];
      fetchStub = vi
        .spyOn(window, 'fetch')
        .mockImplementation(() =>
          Promise.resolve(new Response('', {status: 404})),
        );
    });

    afterEach(function () {
      fetchStub.mockRestore();
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

    /**
     * Appends a token query parameter to the given URL, records the call.
     * @param {Object} ref The STAC Asset or Link.
     * @param {string} url The URL.
     * @param {boolean} isTemplate Whether the URL is a tile URL template.
     * @return {string} The URL with the token appended.
     */
    function appendToken(ref, url, isTemplate) {
      urlCalls.push({url, isTemplate});
      return `${url}${url.includes('?') ? '&' : '?'}token=1`;
    }

    it('rewrites the GeoTIFF source URLs', async function () {
      const group = new STAC({
        data: createItem({cog: COG_ASSET}),
        getRequestUrl: appendToken,
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.GeoTIFF));
      const options = getCaptured(SourceType.GeoTIFF);
      expect(options.sources[0].url).to.equal(`${COG_ASSET.href}?token=1`);
      expect(urlCalls).to.deep.include({
        url: COG_ASSET.href,
        isTemplate: false,
      });
    });

    it('rewrites the preview image URL', async function () {
      const group = new STAC({
        data: createItem({thumbnail: THUMBNAIL_ASSET}),
        displayPreview: true,
        getRequestUrl: appendToken,
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.ImageStatic));
      const options = getCaptured(SourceType.ImageStatic);
      expect(options.url).to.equal(`${THUMBNAIL_ASSET.href}?token=1`);
    });

    it('rewrites web map link URLs', async function () {
      const group = new STAC({
        data: createItem({}, [
          {
            rel: 'xyz',
            href: 'https://example.com/{z}/{x}/{y}.png',
            type: 'image/png',
          },
        ]),
        displayWebMapLink: true,
        getRequestUrl: appendToken,
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.XYZ));
      const options = getCaptured(SourceType.XYZ);
      expect(options.url).to.equal(
        'https://example.com/{z}/{x}/{y}.png?token=1',
      );
      expect(urlCalls).to.deep.include({
        url: 'https://example.com/{z}/{x}/{y}.png',
        isTemplate: true,
      });
    });

    it('replaces {s} before the XYZ URL template is rewritten', async function () {
      const group = new STAC({
        data: createItem({}, [
          {
            rel: 'xyz',
            href: 'https://{s}.example.com/{z}/{x}/{y}.png',
            'href:servers': ['a'],
            type: 'image/png',
          },
        ]),
        displayWebMapLink: true,
        getRequestUrl: appendToken,
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.XYZ));
      expect(getCaptured(SourceType.XYZ).url).to.equal(
        'https://a.example.com/{z}/{x}/{y}.png?token=1',
      );
      expect(urlCalls).to.deep.include({
        url: 'https://a.example.com/{z}/{x}/{y}.png',
        isTemplate: true,
      });
    });

    it('rewrites WMS web map link URLs', async function () {
      const group = new STAC({
        data: createItem({}, [
          {
            rel: 'wms',
            href: 'https://example.com/wms',
            type: 'image/png',
            'wms:layers': ['test'],
          },
        ]),
        displayWebMapLink: true,
        getRequestUrl: appendToken,
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.TileWMS));
      const options = getCaptured(SourceType.TileWMS);
      expect(options.url).to.equal('https://example.com/wms?token=1');
      expect(urlCalls).to.deep.include({
        url: 'https://example.com/wms',
        isTemplate: false,
      });
    });

    it('rewrites PMTiles web map link URLs', async function () {
      const group = new STAC({
        data: createItem({}, [
          {
            rel: 'pmtiles',
            href: 'https://example.com/tiles.pmtiles',
          },
        ]),
        displayWebMapLink: true,
        getRequestUrl: appendToken,
      });
      group.on('error', () => {});
      await waitFor(() => urlCalls.length > 0);
      expect(urlCalls).to.deep.include({
        url: 'https://example.com/tiles.pmtiles',
        isTemplate: false,
      });
    });

    it('rewrites the URL for the default fetch function', async function () {
      fetchStub.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(createItem()), {
            status: 200,
            headers: {'Content-Type': 'application/json'},
          }),
        ),
      );
      const group = new STAC({
        url: 'https://example.com/item.json',
        getRequestUrl: appendToken,
      });
      group.on('error', () => {});
      await waitFor(() => fetchStub.mock.calls.length > 0);
      expect(fetchStub.mock.calls[0][0]).to.equal(
        'https://example.com/item.json?token=1',
      );
    });

    it('keeps the URLs when null is returned', async function () {
      const group = new STAC({
        data: createItem({cog: COG_ASSET}),
        getRequestUrl: () => null,
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.GeoTIFF));
      const options = getCaptured(SourceType.GeoTIFF);
      expect(options.sources[0].url).to.equal(COG_ASSET.href);
    });

    it('rewrites the WMTS URI template', async function () {
      const capabilities = `<?xml version="1.0" encoding="UTF-8"?>
<Capabilities xmlns="http://www.opengis.net/wmts/1.0" xmlns:ows="http://www.opengis.net/ows/1.1" version="1.0.0">
  <Contents>
    <Layer>
      <ows:Title>Test</ows:Title>
      <ows:Identifier>test</ows:Identifier>
      <Style isDefault="true"><ows:Identifier>default</ows:Identifier></Style>
      <Format>image/png</Format>
      <TileMatrixSetLink><TileMatrixSet>matrix</TileMatrixSet></TileMatrixSetLink>
      <ResourceURL format="image/png" resourceType="tile" template="https://example.com/wmts/{TileMatrix}/{TileRow}/{TileCol}.png"/>
    </Layer>
    <TileMatrixSet>
      <ows:Identifier>matrix</ows:Identifier>
      <ows:SupportedCRS>urn:ogc:def:crs:EPSG::3857</ows:SupportedCRS>
      <TileMatrix>
        <ows:Identifier>0</ows:Identifier>
        <ScaleDenominator>559082264.0287178</ScaleDenominator>
        <TopLeftCorner>-20037508.342789244 20037508.342789244</TopLeftCorner>
        <TileWidth>256</TileWidth>
        <TileHeight>256</TileHeight>
        <MatrixWidth>1</MatrixWidth>
        <MatrixHeight>1</MatrixHeight>
      </TileMatrix>
    </TileMatrixSet>
  </Contents>
</Capabilities>`;
      fetchStub.mockImplementation(() =>
        Promise.resolve(new Response(capabilities, {status: 200})),
      );
      const group = new STAC({
        data: createItem({}, [
          {
            rel: 'wmts',
            href: 'https://example.com/wmts',
            type: 'application/xml',
            'wmts:layer': 'test',
            'wmts:encoding': 'rest',
            uriTemplate:
              'https://example.com/tiles/{TileMatrix}/{TileRow}/{TileCol}.png',
          },
        ]),
        displayWebMapLink: true,
        getRequestUrl: appendToken,
      });
      group.on('error', () => {});
      await waitFor(() =>
        group
          .getLayersArray()
          .some(
            (layer) =>
              typeof layer.getSource === 'function' &&
              layer.getSource() &&
              typeof layer.getSource().getUrls === 'function' &&
              (layer.getSource().getUrls() || []).length > 0,
          ),
      );
      const source = group
        .getLayersArray()
        .map(
          (layer) => typeof layer.getSource === 'function' && layer.getSource(),
        )
        .find(
          (s) =>
            s &&
            typeof s.getUrls === 'function' &&
            (s.getUrls() || []).length > 0,
        );
      expect(source.getUrls()[0]).to.equal(
        'https://example.com/tiles/{TileMatrix}/{TileRow}/{TileCol}.png?token=1',
      );
      expect(urlCalls).to.deep.include({
        url: 'https://example.com/wmts',
        isTemplate: false,
      });
      expect(urlCalls).to.deep.include({
        url: 'https://example.com/tiles/{TileMatrix}/{TileRow}/{TileCol}.png',
        isTemplate: true,
      });
    });

    it('rewrites the tile URL template from buildTileUrlTemplate', async function () {
      const group = new STAC({
        data: createItem({cog: COG_ASSET}),
        buildTileUrlTemplate: (asset) =>
          `https://tiles.example.com/{z}/{x}/{y}.png?url=${encodeURIComponent(asset.getAbsoluteUrl())}`,
        getRequestUrl: appendToken,
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.XYZ));
      const options = getCaptured(SourceType.XYZ);
      expect(options.url).to.equal(
        `https://tiles.example.com/{z}/{x}/{y}.png?url=${encodeURIComponent(COG_ASSET.href)}&token=1`,
      );
      expect(urlCalls).to.deep.include({
        url: `https://tiles.example.com/{z}/{x}/{y}.png?url=${encodeURIComponent(COG_ASSET.href)}`,
        isTemplate: true,
      });
    });
  });

  describe('TileJSON manifest', function () {
    const TILEJSON_LINK = {
      rel: 'tilejson',
      href: 'https://example.com/manifest.json',
      type: 'application/json',
    };
    const TILEJSON_DOC = {
      tilejson: '2.2.0',
      tiles: ['https://example.com/tiles/{z}/{x}/{y}.png'],
    };

    let fetchStub;

    beforeEach(function () {
      fetchStub = vi.spyOn(window, 'fetch').mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(TILEJSON_DOC), {
            status: 200,
            headers: {'Content-Type': 'application/json'},
          }),
        ),
      );
    });

    afterEach(function () {
      fetchStub.mockRestore();
      fetchStub = null;
    });

    it('is fetched through the request function and passed to the source', async function () {
      const group = new STAC({
        data: createItem({}, [TILEJSON_LINK]),
        displayWebMapLink: true,
      });
      group.on('error', () => {});
      await waitFor(() => fetchStub.mock.calls.length > 0);
      expect(fetchStub.mock.calls[0][0]).to.equal(TILEJSON_LINK.href);
      await waitFor(() =>
        group
          .getLayersArray()
          .some(
            (layer) =>
              typeof layer.getSource === 'function' &&
              layer.getSource() &&
              typeof layer.getSource().getTileJSON === 'function' &&
              layer.getSource().getTileJSON(),
          ),
      );
    });

    it('carries the configured request headers', async function () {
      const refs = [];
      const group = new STAC({
        data: createItem({}, [TILEJSON_LINK]),
        displayWebMapLink: true,
        getRequestHeaders: (ref) => {
          refs.push(ref);
          return AUTH_HEADERS;
        },
      });
      group.on('error', () => {});
      await waitFor(() => fetchStub.mock.calls.length > 0);
      const init = fetchStub.mock.calls[0][1];
      expect(init.headers).to.eql(AUTH_HEADERS);
      // The headers callback receives the STAC reference of the request
      expect(refs.some((ref) => ref && ref.rel === 'tilejson')).to.equal(true);
    });

    it('rewrites the tile templates with getRequestUrl', async function () {
      const urlCalls = [];
      const group = new STAC({
        data: createItem({}, [TILEJSON_LINK]),
        displayWebMapLink: true,
        getRequestUrl: (ref, url, isTemplate) => {
          urlCalls.push({url, isTemplate});
          return `${url}${url.includes('?') ? '&' : '?'}token=1`;
        },
      });
      group.on('error', () => {});
      await waitFor(() =>
        group
          .getLayersArray()
          .some(
            (layer) =>
              typeof layer.getSource === 'function' &&
              layer.getSource() &&
              typeof layer.getSource().getTileJSON === 'function' &&
              layer.getSource().getTileJSON(),
          ),
      );
      const source = group
        .getLayersArray()
        .map(
          (layer) => typeof layer.getSource === 'function' && layer.getSource(),
        )
        .find(
          (s) => s && typeof s.getTileJSON === 'function' && s.getTileJSON(),
        );
      expect(source.getTileJSON().tiles[0]).to.equal(
        'https://example.com/tiles/{z}/{x}/{y}.png?token=1',
      );
      expect(urlCalls).to.deep.include({
        url: TILEJSON_LINK.href,
        isTemplate: false,
      });
      expect(urlCalls).to.deep.include({
        url: TILEJSON_DOC.tiles[0],
        isTemplate: true,
      });
    });
  });

  describe('getRequestHeaders', function () {
    let fetchStub;
    let captured;

    beforeEach(function () {
      captured = [];
      fetchStub = vi
        .spyOn(window, 'fetch')
        .mockImplementation(() =>
          Promise.resolve(new Response('', {status: 404})),
        );
    });

    afterEach(function () {
      fetchStub.mockRestore();
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
      expect(options.sourceOptions).to.equal(undefined);
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
      expect(options.sourceOptions).to.equal(undefined);
    });

    it('passes headers to the GeoZarr store options', async function () {
      const group = new STAC({
        data: createItem({zarr: GEOZARR_ASSET}),
        getRequestHeaders: () => AUTH_HEADERS,
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.GeoZarr));
      const options = getCaptured(SourceType.GeoZarr);
      expect(options.storeOptions).to.be.an('object');
      expect(options.storeOptions.headers).to.eql(AUTH_HEADERS);
    });

    it('does not change the GeoZarr store options by default', async function () {
      const group = new STAC({
        data: createItem({zarr: GEOZARR_ASSET}),
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.GeoZarr));
      const options = getCaptured(SourceType.GeoZarr);
      expect(options.storeOptions).to.equal(undefined);
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
      expect(options.imageLoadFunction).to.equal(undefined);
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
      expect(options.tileLoadFunction).to.equal(undefined);
    });

    it('sends headers with the default fetch function', async function () {
      fetchStub.mockImplementation(() =>
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
      await waitFor(() => fetchStub.mock.calls.length > 0);
      const init = fetchStub.mock.calls[0][1];
      expect(init.headers).to.eql(AUTH_HEADERS);
    });

    it('sends no headers with the default fetch function by default', async function () {
      fetchStub.mockImplementation(() =>
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
      await waitFor(() => fetchStub.mock.calls.length > 0);
      const init = fetchStub.mock.calls[0][1];
      expect(init && init.headers).to.equal(undefined);
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
        await waitFor(() => fetchStub.mock.calls.length > 0);
        expect(getCaptured(SourceType.PMTiles)).to.be.an('object');
        const url = fetchStub.mock.calls[0][0];
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
        await waitFor(() => fetchStub.mock.calls.length > 0);
        const init = fetchStub.mock.calls[0][1];
        expect(init.headers.get('authorization')).to.equal('Bearer 123');
      });

      /**
       * Creates the first bytes of a minimal PMTiles v3 archive.
       * @param {number} tileType The tile type (1 = Mvt, 2 = Png).
       * @return {Uint8Array} The archive bytes.
       */
      function createPmtilesArchive(tileType) {
        const bytes = new Uint8Array(200);
        const view = new DataView(bytes.buffer);
        view.setUint16(0, 19792, true); // magic number 'PM'
        bytes[7] = 3; // spec version
        view.setUint32(8, 127, true); // root directory offset
        view.setUint32(16, 1, true); // root directory length
        bytes[97] = 1; // internal compression: none
        bytes[98] = 1; // tile compression: none
        bytes[99] = tileType;
        bytes[127] = 0; // root directory: no entries
        return bytes;
      }

      /**
       * Serves a minimal PMTiles archive; the Content-Length header is
       * required by the PMTiles client for 200 responses.
       * @param {number} tileType The tile type (1 = Mvt, 2 = Png).
       * @return {Response} The response.
       */
      function pmtilesResponse(tileType) {
        const bytes = createPmtilesArchive(tileType);
        return new Response(bytes, {
          status: 200,
          headers: {'Content-Length': String(bytes.length)},
        });
      }

      // Remove together with SourceType.PMTilesRaster/PMTilesVector in 2.0.0
      it('still calls getSourceOptions with the deprecated type-specific source type', async function () {
        fetchStub.mockImplementation(() => Promise.resolve(pmtilesResponse(2)));
        const group = new STAC({
          data: createItem({}, [PMTILES_LINK]),
          displayWebMapLink: true,
          // Does not react to SourceType.PMTiles, i.e. a pre-1.6.0 callback
          getSourceOptions: captureSourceOptions,
        });
        group.on('error', () => {});
        await waitFor(() => getCaptured(SourceType.PMTilesRaster));
        // The generic source type is passed before the sniff,
        // the deprecated type-specific one after the sniff
        expect(captured[0].type).to.equal(SourceType.PMTiles);
        expect(getCaptured(SourceType.PMTilesRaster)).to.be.an('object');
      });

      it('skips the deprecated call when the callback handles SourceType.PMTiles', async function () {
        fetchStub.mockImplementation(() => Promise.resolve(pmtilesResponse(1)));
        const group = new STAC({
          data: createItem({}, [PMTILES_LINK]),
          displayWebMapLink: true,
          getSourceOptions: (type, options) => {
            captured.push({type, options});
            if (type === SourceType.PMTiles) {
              options.url += '?token=1';
            }
            return options;
          },
        });
        group.on('error', () => {});
        await waitFor(() => group.getLayersArray().length >= 2);
        expect(getCaptured(SourceType.PMTiles)).to.be.an('object');
        expect(getCaptured(SourceType.PMTilesVector)).to.equal(undefined);
        expect(getCaptured(SourceType.PMTilesRaster)).to.equal(undefined);
      });
    });
  });
});

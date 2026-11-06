import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import {transformExtent} from 'ol/proj.js';
import GeoTIFF from 'ol/source/GeoTIFF.js';
import XYZ from 'ol/source/XYZ.js';
import STAC from '../../../../../src/ol/layer/STAC.js';
import LayerType from '../../../../../src/ol/layer/type.js';
import SourceType from '../../../../../src/ol/source/type.js';
import {getWebMapLinks} from '../../../../../src/ol/util.js';

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

/**
 * Creates a minimal STAC Collection.
 * @return {Object} The STAC Collection.
 */
function createCollection() {
  return {
    type: 'Collection',
    stac_version: '1.0.0',
    id: 'test-collection',
    description: 'Test',
    license: 'proprietary',
    extent: {
      spatial: {bbox: [[0, 0, 1, 1]]},
      temporal: {interval: [['2024-01-01T00:00:00Z', null]]},
    },
    links: [],
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

  describe('getWebMapLinks', function () {
    const S3_XYZ_LINK = {
      rel: 'xyz',
      href: 's3://bucket/tiles/{z}/{x}/{y}.png',
      type: 'image/png',
    };
    const HTTPS_XYZ_LINK = {
      rel: 'xyz',
      href: 'https://example.com/{z}/{x}/{y}.png',
      type: 'image/png',
    };

    /**
     * Creates a STAC layer for an item with an s3 and an https XYZ link.
     * @return {STAC} The STAC layer.
     */
    function createGroup() {
      const group = new STAC({
        data: createItem({}, [S3_XYZ_LINK, HTTPS_XYZ_LINK]),
        displayWebMapLink: true,
      });
      group.on('error', () => {});
      return group;
    }

    it('excludes links that are not accessible via HTTP(S)', function () {
      const links = createGroup().getWebMapLinks();
      expect(links.length).to.equal(1);
      expect(links[0].href).to.equal(HTTPS_XYZ_LINK.href);
    });

    it('keeps non-HTTP links when httpOnly is disabled', function () {
      const links = getWebMapLinks(createGroup().getData(), true, false);
      expect(links.length).to.equal(2);
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

    it('rewrites the GeoTIFF source URLs of children', async function () {
      const group = new STAC({
        data: createCollection(),
        children: [createItem({cog: COG_ASSET})],
        getRequestUrl: appendToken,
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.GeoTIFF));
      const options = getCaptured(SourceType.GeoTIFF);
      expect(options.sources[0].url).to.equal(`${COG_ASSET.href}?token=1`);
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

    const WMTS_CAPABILITIES = `<?xml version="1.0" encoding="UTF-8"?>
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

    /**
     * Creates a STAC layer for a WMTS link and waits for the WMTS source.
     * @param {Object} linkProps Additional properties for the WMTS link.
     * @param {Object} [layerOptions] Additional options for the STAC layer.
     * @return {Promise<Object>} Resolves with the WMTS source.
     */
    async function createWmtsSource(linkProps, layerOptions = {}) {
      fetchStub.mockImplementation(() =>
        Promise.resolve(new Response(WMTS_CAPABILITIES, {status: 200})),
      );
      const group = new STAC({
        data: createItem({}, [
          Object.assign(
            {
              rel: 'wmts',
              href: 'https://example.com/wmts',
              type: 'application/xml',
              'wmts:layer': 'test',
              'wmts:encoding': 'rest',
            },
            linkProps,
          ),
        ]),
        displayWebMapLink: true,
        getRequestUrl: appendToken,
        ...layerOptions,
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
      return group
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
    }

    it('rewrites the WMTS URI template', async function () {
      const source = await createWmtsSource({
        uriTemplate:
          'https://example.com/tiles/{TileMatrix}/{TileRow}/{TileCol}.png',
      });
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

    it('rewrites the WMTS URL templates from the capabilities', async function () {
      const source = await createWmtsSource({});
      expect(source.getUrls()[0]).to.equal(
        'https://example.com/wmts/{TileMatrix}/{TileRow}/{TileCol}.png?token=1',
      );
      expect(urlCalls).to.deep.include({
        url: 'https://example.com/wmts/{TileMatrix}/{TileRow}/{TileCol}.png',
        isTemplate: true,
      });
    });

    it('skips WMTS layers with unresolvable uriTemplate variables', async function () {
      fetchStub.mockImplementation(() =>
        Promise.resolve(new Response(WMTS_CAPABILITIES, {status: 200})),
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
              'https://example.com/tiles/{custom}/{TileMatrix}/{TileRow}/{TileCol}.png',
            variables: {custom: {type: 'string'}},
          },
        ]),
        getRequestUrl: appendToken,
      });
      group.on('error', () => {});
      const link = group.getData().getLinksWithRels(['wmts'])[0];
      const layers = await group.addLayerForLink(link);
      expect(layers).to.eql([]);
    });

    it('flags WMTS capability templates when getSourceOptions drops the encoding', async function () {
      const source = await createWmtsSource(
        {},
        {
          getSourceOptions: (type, options) => {
            delete options.requestEncoding;
            return options;
          },
        },
      );
      expect(source.getUrls()[0]).to.equal(
        'https://example.com/wmts/{TileMatrix}/{TileRow}/{TileCol}.png?token=1',
      );
      expect(urlCalls).to.deep.include({
        url: 'https://example.com/wmts/{TileMatrix}/{TileRow}/{TileCol}.png',
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

    it('passes headers to the GeoTIFF source options of children', async function () {
      const group = new STAC({
        data: createCollection(),
        children: [createItem({cog: COG_ASSET})],
        getRequestHeaders: () => AUTH_HEADERS,
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.GeoTIFF));
      const options = getCaptured(SourceType.GeoTIFF);
      expect(options.sourceOptions.headers).to.eql(AUTH_HEADERS);
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

  describe('without spatial extent', function () {
    /**
     * @param {Array<Object>} links The links.
     * @return {Object} A STAC Catalog without spatial extent.
     */
    function createCatalog(links = []) {
      return {
        type: 'Catalog',
        stac_version: '1.0.0',
        id: 'test-catalog',
        description: 'Test',
        links,
      };
    }

    /**
     * @param {STAC} group The layer group.
     * @param {string} type The event type.
     * @return {Promise} Resolves with the event.
     */
    function once(group, type) {
      return new Promise((resolve) => group.once(type, resolve));
    }

    const XYZ_LINK = {
      rel: 'xyz',
      href: 'https://example.com/tiles/{z}/{x}/{y}.png',
      type: 'image/png',
    };
    const TILEJSON_LINK = {
      rel: 'tilejson',
      href: 'https://example.com/manifest.json',
      type: 'application/json',
    };

    let fetchStub;
    let map;

    afterEach(function () {
      if (fetchStub) {
        fetchStub.mockRestore();
        fetchStub = null;
      }
      if (map) {
        map.dispose();
        map = null;
      }
    });

    it('emits layersready once the layer group is added to a map', async function () {
      const group = new STAC({
        data: createCatalog([XYZ_LINK]),
        displayWebMapLink: true,
      });
      const layersReady = once(group, 'layersready');
      map = new Map({layers: [group]});
      await layersReady;
      expect(group.getLayersArray().length).to.equal(1);
      expect(group.isEmpty()).to.equal(false);
    });

    it('emits the events if nothing can be shown', async function () {
      const group = new STAC({data: createCatalog()});
      const sourceReady = once(group, 'sourceready');
      const layersReady = once(group, 'layersready');
      map = new Map({layers: [group]});
      await Promise.all([sourceReady, layersReady]);
      expect(group.isEmpty()).to.equal(true);
    });

    it('emits the error if a web map link fails to load', async function () {
      fetchStub = vi
        .spyOn(window, 'fetch')
        .mockImplementation(() =>
          Promise.resolve(new Response('Not found', {status: 404})),
        );
      const group = new STAC({
        data: createCatalog([TILEJSON_LINK]),
        displayWebMapLink: true,
      });
      const error = once(group, 'error');
      const layersReady = once(group, 'layersready');
      map = new Map({layers: [group]});
      await Promise.all([error, layersReady]);
      expect(group.isEmpty()).to.equal(true);
    });

    it('emits the error if a callback fails', async function () {
      const group = new STAC({
        data: createCatalog([XYZ_LINK]),
        displayWebMapLink: true,
        getSourceOptions: () => Promise.reject(new Error('Failed')),
      });
      const sourceReady = once(group, 'sourceready');
      const error = once(group, 'error');
      map = new Map({layers: [group]});
      await Promise.all([sourceReady, error]);
      expect(group.isEmpty()).to.equal(true);
    });

    it('emits the events if the children show nothing', async function () {
      const group = new STAC({
        data: createCatalog(),
        children: [createCatalog(), createCatalog()],
      });
      const sourceReady = once(group, 'sourceready');
      const layersReady = once(group, 'layersready');
      map = new Map({layers: [group]});
      await Promise.all([sourceReady, layersReady]);
      expect(group.isEmpty()).to.equal(true);
    });

    it('returns the extent from the TileJSON bounds', async function () {
      fetchStub = vi.spyOn(window, 'fetch').mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              tilejson: '2.2.0',
              tiles: ['https://example.com/tiles/{z}/{x}/{y}.png'],
              bounds: [10, 20, 30, 40],
            }),
            {status: 200, headers: {'Content-Type': 'application/json'}},
          ),
        ),
      );
      const group = new STAC({
        data: createCatalog([TILEJSON_LINK]),
        displayWebMapLink: true,
      });
      const layersReady = once(group, 'layersready');
      map = new Map({layers: [group]});
      await layersReady;
      const extent = group.getExtent();
      const expected = transformExtent(
        [10, 20, 30, 40],
        'EPSG:4326',
        'EPSG:3857',
      );
      expect(extent.map(Math.round)).to.deep.equal(expected.map(Math.round));
    });

    it('returns the extent from the bounds of an inline TileJSON manifest', async function () {
      const group = new STAC({
        data: createCatalog([TILEJSON_LINK]),
        displayWebMapLink: true,
        getSourceOptions: (type, options) =>
          type === SourceType.TileJSON
            ? Object.assign({}, options, {
                tileJSON: {
                  tilejson: '2.2.0',
                  tiles: ['https://example.com/tiles/{z}/{x}/{y}.png'],
                  bounds: [10, 20, 30, 40],
                },
              })
            : options,
      });
      const layersReady = once(group, 'layersready');
      map = new Map({layers: [group]});
      await layersReady;
      const source = group.getLayersArray()[0].getSource();
      expect(source.getTileJSON().bounds).to.deep.equal([10, 20, 30, 40]);
      const expected = transformExtent(
        [10, 20, 30, 40],
        'EPSG:4326',
        'EPSG:3857',
      );
      expect(group.getExtent().map(Math.round)).to.deep.equal(
        expected.map(Math.round),
      );
    });

    it('returns the extent from the web map links of the children', async function () {
      fetchStub = vi.spyOn(window, 'fetch').mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              tilejson: '2.2.0',
              tiles: ['https://example.com/tiles/{z}/{x}/{y}.png'],
              bounds: [10, 20, 30, 40],
            }),
            {status: 200, headers: {'Content-Type': 'application/json'}},
          ),
        ),
      );
      const group = new STAC({
        data: createCatalog(),
        children: [createCatalog([TILEJSON_LINK])],
        childrenOptions: {displayWebMapLink: true},
      });
      map = new Map({layers: [group]});
      await waitFor(() => group.getExtent());
      const expected = transformExtent(
        [10, 20, 30, 40],
        'EPSG:4326',
        'EPSG:3857',
      );
      expect(group.getExtent().map(Math.round)).to.deep.equal(
        expected.map(Math.round),
      );
    });

    it('returns the extent from the children and their web map links', async function () {
      fetchStub = vi.spyOn(window, 'fetch').mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              tilejson: '2.2.0',
              tiles: ['https://example.com/tiles/{z}/{x}/{y}.png'],
              bounds: [10, 20, 30, 40],
            }),
            {status: 200, headers: {'Content-Type': 'application/json'}},
          ),
        ),
      );
      const group = new STAC({
        data: createCatalog(),
        children: [createItem(), createCatalog([TILEJSON_LINK])],
        childrenOptions: {displayWebMapLink: true},
      });
      map = new Map({layers: [group]});
      const expected = transformExtent(
        [0, 0, 30, 40],
        'EPSG:4326',
        'EPSG:3857',
      ).map(Math.round);
      await waitFor(
        () =>
          JSON.stringify(group.getExtent()?.map(Math.round)) ===
          JSON.stringify(expected),
      );
    });

    it('returns the extent of the WMTS layer that is shown', async function () {
      const layer = (id, bbox) => `
    <Layer>
      <ows:Title>${id}</ows:Title>
      <ows:Identifier>${id}</ows:Identifier>
      <ows:WGS84BoundingBox>
        <ows:LowerCorner>${bbox[0]} ${bbox[1]}</ows:LowerCorner>
        <ows:UpperCorner>${bbox[2]} ${bbox[3]}</ows:UpperCorner>
      </ows:WGS84BoundingBox>
      <Style isDefault="true"><ows:Identifier>default</ows:Identifier></Style>
      <Format>image/png</Format>
      <TileMatrixSetLink><TileMatrixSet>matrix</TileMatrixSet></TileMatrixSetLink>
      <ResourceURL format="image/png" resourceType="tile" template="https://example.com/wmts/${id}/{TileMatrix}/{TileRow}/{TileCol}.png"/>
    </Layer>`;
      const capabilities = `<?xml version="1.0" encoding="UTF-8"?>
<Capabilities xmlns="http://www.opengis.net/wmts/1.0" xmlns:ows="http://www.opengis.net/ows/1.1" version="1.0.0">
  <Contents>${layer('a', [1, 2, 3, 4])}${layer('b', [10, 20, 30, 40])}
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
      fetchStub = vi
        .spyOn(window, 'fetch')
        .mockImplementation(() =>
          Promise.resolve(new Response(capabilities, {status: 200})),
        );
      const group = new STAC({
        data: createCatalog([
          {
            rel: 'wmts',
            href: 'https://example.com/wmts',
            type: 'image/png',
            'wmts:layer': 'a',
          },
        ]),
        displayWebMapLink: true,
        // The callback may choose another layer than the STAC link
        getSourceOptions: (type, options) =>
          type === SourceType.WMTS
            ? Object.assign({}, options, {layer: 'b'})
            : options,
      });
      const layersReady = once(group, 'layersready');
      map = new Map({layers: [group]});
      await layersReady;
      const expected = transformExtent(
        [10, 20, 30, 40],
        'EPSG:4326',
        'EPSG:3857',
      );
      expect(group.getExtent().map(Math.round)).to.deep.equal(
        expected.map(Math.round),
      );
    });

    it('returns no extent for links without bounds', async function () {
      const group = new STAC({
        data: createCatalog([XYZ_LINK]),
        displayWebMapLink: true,
      });
      const layersReady = once(group, 'layersready');
      map = new Map({layers: [group]});
      await layersReady;
      expect(group.getExtent()).to.equal(undefined);
    });

    it('is not empty if a web map link is shown', async function () {
      const group = new STAC({
        data: createCatalog([XYZ_LINK]),
        displayWebMapLink: true,
      });
      await waitFor(() => group.getLayersArray().length > 0);
      expect(group.getLayersArray().length).to.equal(1);
      expect(group.getBoundsLayer()).to.equal(null);
      expect(group.isEmpty()).to.equal(false);
    });

    it('is empty if nothing is shown', async function () {
      const group = new STAC({data: createCatalog()});
      await group.updateLayers(false);
      expect(group.isEmpty()).to.equal(true);
    });

    it('is empty if the children only have hidden footprints', async function () {
      const group = new STAC({
        data: createCatalog(),
        children: [createItem()],
        displayFootprint: false,
      });
      await waitFor(() => group.getLayers().getLength() > 0);
      expect(group.isEmpty()).to.equal(true);
    });

    it('is not empty if the children show their footprints', async function () {
      const group = new STAC({
        data: createCatalog(),
        children: [createItem()],
      });
      await waitFor(() => group.getLayers().getLength() > 0);
      expect(group.isEmpty()).to.equal(false);
    });
  });

  describe('isEmpty', function () {
    it('is not empty if the footprint is shown', async function () {
      const group = new STAC({data: createItem()});
      await group.updateLayers(false);
      expect(group.isEmpty()).to.equal(false);
    });

    it('is empty if only the hidden footprint is available', async function () {
      const group = new STAC({data: createItem(), displayFootprint: false});
      await group.updateLayers(false);
      expect(group.isEmpty()).to.equal(true);
    });
  });

  describe('events', function () {
    let map;
    let target;

    afterEach(function () {
      map?.dispose();
      target?.remove();
      map = null;
      target = null;
    });

    it('defers sourceready for synchronous data until listeners are registered', async function () {
      target = document.createElement('div');
      target.style.width = '200px';
      target.style.height = '200px';
      document.body.appendChild(target);
      const group = new STAC({data: createItem()});
      map = new Map({
        target,
        layers: [group],
        view: new View({center: [0, 0], zoom: 2}),
      });
      let sourceReady = false;
      group.on('sourceready', () => (sourceReady = true));
      await waitFor(() => sourceReady);
    });

    it('forgets the map once the layer group is removed from it', async function () {
      const group = new STAC({
        data: createItem({}, [
          {
            rel: 'xyz',
            href: 'https://example.com/tiles/{z}/{x}/{y}.png',
            type: 'image/png',
          },
        ]),
        displayWebMapLink: true,
      });
      const layersReady = new Promise((resolve) =>
        group.once('layersready', resolve),
      );
      map = new Map({layers: [group]});
      await layersReady;
      expect(group.getExtent()).to.be.an('array');
      map.removeLayer(group);
      expect(group.getExtent()).to.equal(undefined);
    });
  });

  describe('attributions', function () {
    const ITEM_ATTRIBUTION = '<a href="https://example.com">Item</a>';
    const ASSET_ATTRIBUTION = 'Asset';
    const LINK_ATTRIBUTION = 'Link';

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

    /**
     * @param {Object} assets The assets.
     * @param {Array<Object>} links The links.
     * @return {Object} A STAC Item with attribution.
     */
    function createAttributedItem(assets = {}, links = []) {
      const item = createItem(assets, links);
      item.properties.attribution = ITEM_ATTRIBUTION;
      return item;
    }

    it('getAttributions returns the attribution of the STAC entity', function () {
      const group = new STAC({data: createAttributedItem()});
      expect(group.getAttributions()).to.deep.equal([ITEM_ATTRIBUTION]);
    });

    it('getAttributions returns an empty list without attribution', function () {
      const group = new STAC({data: createItem()});
      expect(group.getAttributions()).to.deep.equal([]);
    });

    it('uses the attribution of a GeoTIFF asset', async function () {
      const group = new STAC({
        data: createAttributedItem({
          cog: Object.assign({attribution: ASSET_ATTRIBUTION}, COG_ASSET),
        }),
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.GeoTIFF));
      expect(getCaptured(SourceType.GeoTIFF).attributions).to.equal(
        ASSET_ATTRIBUTION,
      );
    });

    it('inherits the attribution of the STAC entity for assets', async function () {
      const group = new STAC({
        data: createAttributedItem({cog: COG_ASSET}),
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.GeoTIFF));
      expect(getCaptured(SourceType.GeoTIFF).attributions).to.equal(
        ITEM_ATTRIBUTION,
      );
    });

    it('sets the attribution on the GeoTIFF source', async function () {
      // OpenLayers < 10.8 ignores the attributions option of GeoTIFF sources
      const spy = vi.spyOn(GeoTIFF.prototype, 'setAttributions');
      try {
        const group = new STAC({
          data: createAttributedItem({
            cog: Object.assign({attribution: ASSET_ATTRIBUTION}, COG_ASSET),
          }),
        });
        group.on('error', () => {});
        await waitFor(() => spy.mock.calls.length > 0);
        const source = spy.mock.contexts[0];
        expect(source.getAttributions()({})).to.deep.equal([ASSET_ATTRIBUTION]);
      } finally {
        spy.mockRestore();
      }
    });

    it('uses the attribution of a web map link', async function () {
      const group = new STAC({
        data: createAttributedItem({}, [
          {
            rel: 'xyz',
            href: 'https://example.com/tiles/{z}/{x}/{y}.png',
            type: 'image/png',
            attribution: LINK_ATTRIBUTION,
          },
        ]),
        displayWebMapLink: true,
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.XYZ));
      expect(getCaptured(SourceType.XYZ).attributions).to.equal(
        LINK_ATTRIBUTION,
      );
    });

    it('falls back to the attribution of the STAC entity for web map links', async function () {
      const group = new STAC({
        data: createAttributedItem({}, [
          {
            rel: 'xyz',
            href: 'https://example.com/tiles/{z}/{x}/{y}.png',
            type: 'image/png',
          },
        ]),
        displayWebMapLink: true,
        getSourceOptions: captureSourceOptions,
      });
      group.on('error', () => {});
      await waitFor(() => getCaptured(SourceType.XYZ));
      expect(getCaptured(SourceType.XYZ).attributions).to.equal(
        ITEM_ATTRIBUTION,
      );
    });

    it('sets the attribution on GeoJSON asset layers', async function () {
      fetchStub.mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({type: 'FeatureCollection', features: []}),
            {status: 200, headers: {'Content-Type': 'application/geo+json'}},
          ),
        ),
      );
      const group = new STAC({
        data: createAttributedItem({
          labels: {
            href: 'https://example.com/labels.geojson',
            type: 'application/geo+json',
            roles: ['data'],
            attribution: ASSET_ATTRIBUTION,
          },
        }),
        assets: ['labels'],
      });
      await waitFor(() => group.getLayersArray().length > 1);
      const layer = group
        .getLayersArray()
        .find((l) => l !== group.getBoundsLayer());
      const attributions = layer.getSource().getAttributions();
      expect(attributions({})).to.deep.equal([ASSET_ATTRIBUTION]);
    });
  });

  describe('data sources', function () {
    const ASSETS = {
      a: {href: 'https://example.com/a.png', type: 'image/png'},
      b: {href: 'https://example.com/b.png', type: 'image/png'},
      c: {href: 'https://example.com/c.png', type: 'image/png'},
    };

    // The first asset finishes loading last
    const getSourceOptions = async (type, options, asset) => {
      await new Promise((resolve) =>
        setTimeout(resolve, asset.isAsset && asset.getKey() === 'a' ? 50 : 0),
      );
      return options;
    };

    function getAssetLayers(group) {
      return group
        .getLayersArray()
        .filter((layer) => layer.get('stac')?.isAsset);
    }

    function getAssetKeys(group) {
      return getAssetLayers(group).map((layer) => layer.get('stac').getKey());
    }

    function getDataSourceNames(group) {
      return group
        .getLayersArray()
        .map((layer) => layer.get('stac'))
        .filter((stac) => stac?.isAsset || stac?.isLink)
        .map((stac) => (stac.isLink ? stac.rel : stac.getKey()));
    }

    const XYZ_LINK = {
      rel: 'xyz',
      href: 'https://example.com/tiles/{z}/{x}/{y}.png',
      type: 'image/png',
    };

    it('renders the assets in the given order', async function () {
      const group = new STAC({
        data: createItem(ASSETS),
        dataSources: ['a', 'b', 'c'],
        getSourceOptions,
      });
      await waitFor(() => getAssetLayers(group).length === 3);
      expect(getAssetKeys(group)).to.deep.equal(['a', 'b', 'c']);
    });

    it('keeps the layers of assets that are still shown', async function () {
      const group = new STAC({
        data: createItem(ASSETS),
        dataSources: ['a', 'b'],
        getSourceOptions,
      });
      await waitFor(() => getAssetLayers(group).length === 2);
      const [layerA, layerB] = getAssetLayers(group);
      layerA.setVisible(false);

      await group.setDataSources(['a', 'b', 'c']);
      expect(getAssetKeys(group)).to.deep.equal(['a', 'b', 'c']);
      expect(getAssetLayers(group)[0]).to.equal(layerA);
      expect(getAssetLayers(group)[1]).to.equal(layerB);
      expect(layerA.getVisible()).to.equal(false);

      await group.setDataSources(['c', 'a']);
      expect(getAssetKeys(group)).to.deep.equal(['c', 'a']);
      expect(getAssetLayers(group)[1]).to.equal(layerA);
      expect(layerB.getSource()).to.equal(null);
    });

    it('inserts new assets below the shown ones if requested', async function () {
      const group = new STAC({
        data: createItem(ASSETS),
        dataSources: ['b'],
        getSourceOptions,
      });
      await waitFor(() => getAssetLayers(group).length === 1);
      await group.setDataSources(['a', 'b']);
      expect(getAssetKeys(group)).to.deep.equal(['a', 'b']);
    });

    it('recreates the layers if the default colormap changes', async function () {
      const group = new STAC({
        data: createItem(ASSETS),
        dataSources: ['a'],
      });
      await waitFor(() => getAssetLayers(group).length === 1);
      const [layer] = getAssetLayers(group);
      await group.setDefaultColormap(['#000', '#fff']);
      expect(getAssetLayers(group).length).to.equal(1);
      expect(getAssetLayers(group)[0]).not.to.equal(layer);
    });

    it('renders web map links and assets in the given order', async function () {
      const group = new STAC({
        data: createItem(ASSETS),
        dataSources: ['a', XYZ_LINK, 'b'],
        getSourceOptions,
      });
      await waitFor(() => getDataSourceNames(group).length === 3);
      expect(getDataSourceNames(group)).to.deep.equal(['a', 'xyz', 'b']);
      expect(group.getDataSources()[1].isLink).to.equal(true);

      const [linkLayer] = group
        .getLayersArray()
        .filter((layer) => layer.get('stac')?.isLink);
      await group.setDataSources(['b', group.getDataSources()[1]]);
      expect(getDataSourceNames(group)).to.deep.equal(['b', 'xyz']);
      expect(
        group.getLayersArray().find((layer) => layer.get('stac')?.isLink),
      ).to.equal(linkLayer);
    });

    it('shows web map links that are also data sources only once', async function () {
      const group = new STAC({
        data: createItem(ASSETS, [{...XYZ_LINK, id: 'tiles'}]),
        displayWebMapLink: ['tiles'],
      });
      await waitFor(() => getDataSourceNames(group).length > 0);
      await group.setDataSources(group.getWebMapLinks());
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(getDataSourceNames(group)).to.deep.equal(['xyz']);
    });

    it('distinguishes web map links that only differ in their layers', async function () {
      const wms = (layer) => ({
        rel: 'wms',
        href: 'https://example.com/wms',
        type: 'image/png',
        'wms:layers': [layer],
      });
      const getWmsLayers = (group) =>
        group
          .getLayersArray()
          .filter((layer) => layer.get('stac')?.isLink)
          .map((layer) => layer.getSource().getParams().LAYERS);

      const group = new STAC({
        data: createItem(ASSETS),
        dataSources: [wms('a'), wms('b')],
      });
      await waitFor(() => getWmsLayers(group).length === 2);
      expect(getWmsLayers(group)).to.deep.equal(['a', 'b']);

      await group.setDataSources([wms('b'), wms('a')]);
      expect(getWmsLayers(group)).to.deep.equal(['b', 'a']);

      await group.setDataSources([wms('b'), wms('c')]);
      expect(getWmsLayers(group)).to.deep.equal(['b', 'c']);
    });

    it('distinguishes web map links that only differ in properties without prefix', async function () {
      const link = (version) => ({
        ...XYZ_LINK,
        variables: {version: {const: version}},
      });
      const getLayer = (group) =>
        group.getLayersArray().find((layer) => layer.get('stac')?.isLink);

      const group = new STAC({
        data: createItem(ASSETS),
        dataSources: [link('1')],
      });
      await waitFor(() => getLayer(group));
      const layer = getLayer(group);

      await group.setDataSources([link('2')]);
      expect(getLayer(group)).not.to.equal(layer);
      expect(getLayer(group).get('stac').variables.version.const).to.equal('2');
    });

    it('distinguishes assets that share a URL', async function () {
      const asset = (band) => ({
        href: 'https://example.com/shared.png',
        type: 'image/png',
        bands: [{name: band}],
      });
      const getLayer = (group) =>
        group.getLayersArray().find((layer) => layer.get('stac')?.isAsset);

      const group = new STAC({
        data: createItem({
          one: asset('b1'),
          other: asset('b2'),
        }),
        dataSources: ['one'],
      });
      await waitFor(() => getLayer(group));
      const layer = getLayer(group);

      // The same asset again keeps the layer
      await group.setDataSources(['one']);
      expect(getLayer(group)).to.equal(layer);

      await group.setDataSources(['other']);
      expect(getLayer(group)).not.to.equal(layer);
      expect(getLayer(group).get('stac').getKey()).to.equal('other');
    });

    it('keeps the layers of plain objects that are passed again', async function () {
      const link = {...XYZ_LINK};
      const getLayer = (group) =>
        group.getLayersArray().find((layer) => layer.get('stac')?.isLink);

      const group = new STAC({
        data: createItem(ASSETS),
        dataSources: [link],
      });
      await waitFor(() => getLayer(group));
      const layer = getLayer(group);

      await group.setDataSources([link, 'a']);
      expect(getLayer(group)).to.equal(layer);

      // An equal, but different object is a different data source
      await group.setDataSources([{...XYZ_LINK}]);
      expect(getLayer(group)).not.to.equal(layer);
    });

    it('creates sources that are still loading only once', async function () {
      const group = new STAC({
        data: createItem(ASSETS),
        dataSources: ['a'],
        getSourceOptions,
      });
      // The first asset is still loading
      await group.setDataSources(['a', 'b']);
      expect(getAssetKeys(group)).to.deep.equal(['a', 'b']);
    });

    it('shows a plain web map link that is also a data source only once', async function () {
      const link = {...XYZ_LINK};
      const group = new STAC({
        data: createItem(ASSETS),
        displayWebMapLink: [link],
        dataSources: [link],
      });
      const getLayers = () =>
        group.getLayersArray().filter((l) => l !== group.getBoundsLayer());
      await waitFor(() => getLayers().length > 0);
      await group.updateLayers();
      expect(getLayers().length).to.equal(1);
    });

    it('disposes the layers of removed children', async function () {
      const group = new STAC({
        data: createItem(ASSETS),
        children: [createItem()],
      });
      await waitFor(() => group.getLayersArray().length > 1);
      const childLayers = group
        .getLayersArray()
        .filter((layer) => layer !== group.getBoundsLayer());
      expect(childLayers.length).to.be.greaterThan(0);

      await group.setChildren(null);
      expect(childLayers.every((layer) => layer.disposed)).to.equal(true);
    });

    it('keeps other web map links below the data sources', async function () {
      const group = new STAC({
        data: createItem(ASSETS, [{...XYZ_LINK, id: 'tiles'}]),
        displayWebMapLink: ['tiles'],
        dataSources: ['a'],
      });
      await waitFor(() => getDataSourceNames(group).length === 2);
      expect(getDataSourceNames(group)).to.deep.equal(['xyz', 'a']);

      await group.updateLayers();
      expect(getDataSourceNames(group)).to.deep.equal(['xyz', 'a']);
    });

    it('shows no default visualization for an empty list', async function () {
      const group = new STAC({
        data: createItem({thumbnail: THUMBNAIL_ASSET}),
        displayPreview: true,
      });
      await waitFor(() => getAssetLayers(group).length === 1);

      await group.setDataSources([]);
      expect(getAssetLayers(group).length).to.equal(0);

      await group.setDataSources(null);
      expect(getAssetLayers(group).length).to.equal(1);
    });

    it('supports the deprecated assets option and methods', async function () {
      const group = new STAC({
        data: createItem(ASSETS),
        assets: ['a'],
      });
      await waitFor(() => getAssetLayers(group).length === 1);
      await group.setAssets(['a', 'b']);
      expect(getAssetKeys(group)).to.deep.equal(['a', 'b']);
      await group.setDataSources([XYZ_LINK, 'b']);
      expect(group.getAssets().map((asset) => asset.getKey())).to.deep.equal([
        'b',
      ]);
    });
  });

  describe('display limit', function () {
    let fetchStub;
    let map;
    let target;

    afterEach(function () {
      fetchStub?.mockRestore();
      fetchStub = null;
      map?.dispose();
      target?.remove();
      map = null;
      target = null;
    });

    it('reports the rejected asset in the error', async function () {
      const metadata = {
        zarr_consolidated_format: 1,
        metadata: {
          '.zgroup': {zarr_format: 2},
          '.zattrs': {},
          'velocity/.zarray': {
            zarr_format: 2,
            shape: [8000, 8000],
            chunks: [2048, 2048],
            dtype: '<f4',
            compressor: null,
            fill_value: 'NaN',
            order: 'C',
            filters: null,
          },
          'velocity/.zattrs': {_ARRAY_DIMENSIONS: ['y', 'x']},
        },
      };
      fetchStub = vi
        .spyOn(window, 'fetch')
        .mockImplementation((url) =>
          Promise.resolve(
            String(url?.url ?? url).endsWith('/.zmetadata')
              ? new Response(JSON.stringify(metadata), {status: 200})
              : new Response(null, {status: 404}),
          ),
        );
      const item = createItem({
        big: {
          href: 'https://example.com/big.zarr',
          type: 'application/vnd.zarr; version=2',
          roles: ['data'],
        },
      });
      item.stac_extensions = [
        'https://stac-extensions.github.io/datacube/v2.2.0/schema.json',
      ];
      item.properties['cube:dimensions'] = {
        y: {type: 'spatial', axis: 'y', extent: [0, 1]},
        x: {type: 'spatial', axis: 'x', extent: [0, 1]},
      };
      item.properties['cube:variables'] = {
        velocity: {type: 'data', dimensions: ['y', 'x']},
      };

      const errors = [];
      const group = new STAC({data: item, dataSources: ['big']});
      group.on('error', (event) => errors.push(event.error));
      // Events are only dispatched once the layer is on a map
      target = document.createElement('div');
      target.style.width = '200px';
      target.style.height = '200px';
      document.body.appendChild(target);
      map = new Map({
        target,
        layers: [group],
        view: new View({center: [0, 0], zoom: 2}),
      });
      await waitFor(() => errors.length > 0);
      expect(errors[0].name).to.equal('DisplayLimitError');
      expect(errors[0].asset).to.equal(group.getDataSources()[0]);
    });
  });
});

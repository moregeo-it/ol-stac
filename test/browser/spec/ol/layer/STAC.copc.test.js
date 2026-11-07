import Map from 'ol/Map.js';
import View from 'ol/View.js';
import STAC from '../../../../../src/ol/layer/STAC.js';
import LayerType from '../../../../../src/ol/layer/type.js';

const mocked = vi.hoisted(() => ({sources: []}));

vi.mock('ol-copc', async () => {
  const {default: Layer} = await import('ol/layer/Layer.js');
  const {default: Source} = await import('ol/source/Source.js');

  class COPCSource extends Source {
    constructor() {
      super({state: 'loading'});
      this.error = null;
      mocked.sources.push(this);
      setTimeout(() => this.setState('ready'), 0);
    }
    getError() {
      return this.error;
    }
    fail(error) {
      this.error = error;
      this.setState('error');
    }
  }

  class COPCLayer extends Layer {
    constructor(options) {
      super({source: options.source});
    }
  }

  return {COPCLayer, COPCSource};
});

/**
 * @param {function(): *} condition The condition to wait for.
 * @return {Promise<void>} Resolves once the condition is met.
 */
function waitFor(condition) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - start > 2000) {
        reject(new Error('Timeout'));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

/**
 * @return {Object} A STAC Item with a COPC asset.
 */
function createItem() {
  return {
    type: 'Feature',
    stac_version: '1.1.0',
    id: 'points',
    bbox: [0, 0, 1, 1],
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    },
    properties: {datetime: '2020-01-01T00:00:00Z'},
    assets: {
      points: {
        href: 'https://example.com/points.copc.laz',
        type: 'application/vnd.laszip+copc',
        roles: ['data'],
      },
    },
    links: [],
  };
}

describe('ol/layer/STAC (COPC)', function () {
  /** @type {Map} */
  let map;
  /** @type {HTMLElement} */
  let target;

  beforeEach(function () {
    mocked.sources.length = 0;
    // The footprint reports the map once it is rendered
    target = document.createElement('div');
    target.style.width = '100px';
    target.style.height = '100px';
    document.body.appendChild(target);
  });

  afterEach(function () {
    map.dispose();
    target.remove();
  });

  it('disposes the source if the layer options can not be created', async function () {
    const errors = [];
    const group = new STAC({
      data: createItem(),
      getLayerOptions: (type, options) =>
        type === LayerType.COPC
          ? Promise.reject(new Error('Options failed'))
          : options,
    });
    group.on('error', (event) => errors.push(event.error));
    map = new Map({
      target,
      layers: [group],
      view: new View({center: [0, 0], zoom: 2}),
    });
    await waitFor(() => errors.length > 0);
    expect(errors[0].message).to.equal('Options failed');
    expect(mocked.sources.length).to.equal(1);
    expect(mocked.sources[0].disposed).to.equal(true);
  });

  it('reports errors of the source after it is ready', async function () {
    const errors = [];
    const group = new STAC({data: createItem()});
    group.on('error', (event) => errors.push(event.error));
    map = new Map({
      target,
      layers: [group],
      view: new View({center: [0, 0], zoom: 2}),
    });
    await waitFor(() =>
      group.getLayersArray().some((layer) => layer.get('stac')?.isAsset),
    );
    expect(errors.length).to.equal(0);
    mocked.sources[0].fail(new Error('Workers failed'));
    expect(errors.length).to.equal(1);
    expect(errors[0].message).to.equal('Workers failed');
  });
});

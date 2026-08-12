import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/WebGLTile.js';
import {register} from 'ol/proj/proj4.js';
import OSM from 'ol/source/OSM.js';
import proj4 from 'proj4';
import STAC from '../src/ol/layer/STAC.js';

register(proj4);

// There is no public STAC endpoint with header-based authentication, so this
// example can't render anything as-is. Replace the host, URL and token below
// with a protected STAC endpoint of yours to see it in action.

// The hosts that may receive the credentials.
const trustedHosts = ['example.com'];

const layer = new STAC({
  url: 'https://example.com/stac/item.json',
  getRequestHeaders(ref, url) {
    // Only send the credentials to trusted hosts, asset and tile URLs
    // may point elsewhere.
    if (!trustedHosts.includes(new URL(url).host)) {
      return null;
    }
    return {
      Authorization: 'Bearer get_your_own_token',
    };
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

layer.on('error', (event) => {
  // Failed requests (e.g. expired credentials) are reported here.
  console.error(event.error); // eslint-disable-line no-console
});

import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/WebGLTile.js';
import {register} from 'ol/proj/proj4.js';
import OSM from 'ol/source/OSM.js';
import proj4 from 'proj4';
import STAC from '../src/ol/layer/STAC.js';

register(proj4); // required to support source reprojection

const background = new TileLayer({
  source: new OSM(),
});

const map = new Map({
  target: 'map',
  layers: [background],
  view: new View({
    center: [0, 0],
    zoom: 0,
  }),
});

/**
 * Creates a minimal STAC Collection for a Zarr store that has no STAC
 * metadata of its own. Everything needed for visualization is expressed
 * through STAC extensions:
 * - the datacube extension describes the store's dimensions and variables,
 * - the render extension describes how to visualize them
 *   (band selection, value ranges, colormaps),
 * - the projection extension provides the extent and orientation for stores
 *   without their own spatial metadata.
 * @param {string} id The collection id.
 * @param {string} description The collection description.
 * @param {Array<number>} bbox The bounding box in WGS84.
 * @param {Object} asset The `data` asset, including `href`, `type` and any
 * asset-level fields such as `proj:bbox` or `proj:transform`.
 * @param {{dimensions: Object, variables: Object}} cube The datacube extension fields.
 * @param {Object} [render] The render object for the `data` asset.
 * @return {Object} The STAC Collection.
 */
function zarrCollection(id, description, bbox, asset, cube, render) {
  return {
    type: 'Collection',
    stac_version: '1.1.0',
    stac_extensions: [
      'https://stac-extensions.github.io/datacube/v2.2.0/schema.json',
      'https://stac-extensions.github.io/render/v2.0.0/schema.json',
      'https://stac-extensions.github.io/projection/v2.0.0/schema.json',
    ],
    id,
    description,
    license: 'other',
    extent: {
      spatial: {bbox: [bbox]},
      temporal: {interval: [[null, null]]},
    },
    'cube:dimensions': cube.dimensions,
    'cube:variables': cube.variables,
    renders: render ? {default: {assets: ['data'], ...render}} : undefined,
    links: [],
    assets: {
      data: {
        roles: ['data'],
        ...asset,
      },
    },
  };
}

/**
 * Expands a few anchor colors into an explicit render extension colormap:
 * an object mapping each of the 0-255 (rescaled) values to an RGB color.
 * This is what server-side tooling (e.g. rio-tiler) produces when
 * serializing a color ramp, and keeps the STAC metadata self-contained.
 * @param {Array<Array<number>>} colors The anchor colors, as RGB arrays.
 * @return {Object<string, Array<number>>} The colormap.
 */
function gradient(colors) {
  const colormap = {};
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (colors.length - 1);
    const j = Math.min(Math.floor(t), colors.length - 2);
    const f = t - j;
    colormap[i] = colors[j].map((c, k) =>
      Math.round(c + f * (colors[j + 1][k] - c)),
    );
  }
  return colormap;
}

const FTW_URL =
  'https://data.source.coop/ftw/global-data/predictions/zarr/collection.json';
const ZARR_V2 = 'application/vnd.zarr; version=2';
const ZARR_V3 = 'application/vnd.zarr; version=3';
const ZARR_V3_MULTISCALES =
  'application/vnd.zarr; version=3; profile=multiscales';

const presets = {
  'ftw-rgb': {
    url: FTW_URL,
  },
  'ftw-field-2024': {
    url: FTW_URL,
    bands: ['field'],
    sourceOptions: {selector: {time: 0}}, // 2024 instead of the latest year
  },
  'usgs-dem': {
    data: zarrCollection(
      'usgs-conus-dem',
      'USGS 10m DEM for the conterminous US, as a multiscale Zarr v3 store.',
      [-125.6, 24.8, -67.2, 49.1],
      {
        href: 'https://carbonplan-share.s3.us-west-2.amazonaws.com/zarr-layer-examples/USGS-CONUS-DEM-10m.zarr',
        type: ZARR_V3_MULTISCALES,
      },
      {
        dimensions: {
          latitude: {type: 'spatial', axis: 'y', extent: [24.8, 49.1]},
          longitude: {type: 'spatial', axis: 'x', extent: [-125.6, -67.2]},
        },
        variables: {
          DEM: {type: 'data', dimensions: ['latitude', 'longitude']},
        },
      },
      {
        rescale: [[0, 3500]],
        colormap: gradient([
          [51, 51, 153],
          [0, 153, 255],
          [0, 204, 102],
          [255, 255, 153],
          [128, 92, 84],
          [255, 255, 255],
        ]),
      },
    ),
  },
  'hurricane': {
    data: zarrCollection(
      'hurricane-florence-era5',
      'ERA5 surface pressure during Hurricane Florence (Zarr v3, single resolution).',
      [-95.1, 14.9, -39.9, 45.1],
      {
        href: 'https://atlantis-vis-o.s3-ext.jc.rl.ac.uk/hurricanes/era5/florence',
        type: ZARR_V3,
      },
      {
        dimensions: {
          time: {type: 'temporal', extent: [null, null]},
          latitude: {type: 'spatial', axis: 'y', extent: [14.9, 45.1]},
          longitude: {type: 'spatial', axis: 'x', extent: [-95.1, -39.9]},
        },
        variables: {
          surface_pressure: {
            type: 'data',
            dimensions: ['time', 'latitude', 'longitude'],
          },
        },
      },
      {
        rescale: [[96000, 103000]],
        colormap: gradient([
          [68, 1, 84],
          [59, 81, 139],
          [33, 144, 141],
          [92, 200, 99],
          [253, 231, 37],
        ]),
      },
    ),
  },
  'antarctic-era5': {
    data: zarrCollection(
      'antarctic-era5-wind',
      'ERA5 wind speed over Antarctica (Zarr v3, custom polar stereographic projection).',
      [-180, -85, 180, -60],
      {
        href: 'https://carbonplan-share.s3.us-west-2.amazonaws.com/zarr-layer-examples/antarctic_era5.zarr',
        type: ZARR_V3,
      },
      {
        dimensions: {
          y: {type: 'spatial', axis: 'y', extent: [-3316902, 3315371]},
          x: {type: 'spatial', axis: 'x', extent: [-3315363, 3316909]},
        },
        variables: {
          wind_speed: {type: 'data', dimensions: ['y', 'x']},
        },
      },
      {
        rescale: [[0, 12]],
        colormap: gradient([
          [247, 251, 255],
          [107, 174, 214],
          [8, 48, 107],
        ]),
      },
    ),
  },
  'polar': {
    // This store is a single ~5700x4900 pixel resolution level, which is more
    // data than the layer loads by default. Select the asset explicitly and
    // raise the pixel limit to display it anyway.
    assets: ['data'],
    maxDisplayPixels: Infinity,
    data: zarrCollection(
      'thwaites-ice-velocity',
      'Antarctic ice velocity subset for Thwaites Glacier (Zarr v2, EPSG:3031).',
      [-130.6, -78.6, -105.9, -71.9],
      {
        href: 'https://carbonplan-share.s3.us-west-2.amazonaws.com/zarr-layer-examples/polar-subset.zarr',
        type: ZARR_V2,
      },
      {
        dimensions: {
          y: {type: 'spatial', axis: 'y', extent: [-983450, -491950]},
          x: {type: 'spatial', axis: 'x', extent: [-1720950, -1147450]},
        },
        variables: {
          velocity: {type: 'data', dimensions: ['y', 'x']},
        },
      },
      {
        rescale: [[0, 1]],
        colormap: gradient([
          [255, 245, 240],
          [251, 106, 74],
          [103, 0, 13],
        ]),
      },
    ),
  },
  'fgco2': {
    data: zarrCollection(
      'delta-fg-co2',
      'OAE efficiency delta FG CO2 (Zarr v2, south-up, no spatial metadata in the store).',
      [-180, -85, 180, 85],
      {
        href: 'https://carbonplan-oae-efficiency.s3.us-west-2.amazonaws.com/fgco2-2021-180x360.zarr',
        type: ZARR_V2,
        // The store has neither spatial metadata nor coordinate arrays, so
        // the projection extension provides the extent; the positive y scale
        // in the transform declares the south-up orientation.
        'proj:code': 'EPSG:4326',
        'proj:bbox': [-180, -90, 180, 90],
        'proj:shape': [180, 360],
        'proj:transform': [1, 0, -180, 0, 1, -90],
      },
      {
        dimensions: {
          time: {type: 'temporal', extent: [null, null]},
          nlat: {type: 'spatial', axis: 'y', extent: [-90, 90]},
          nlon: {type: 'spatial', axis: 'x', extent: [-180, 180]},
        },
        variables: {
          FG_CO2_2: {type: 'data', dimensions: ['time', 'nlat', 'nlon']},
        },
      },
      {
        rescale: [[-5, 5]],
        colormap: gradient([
          [103, 0, 31],
          [214, 96, 77],
          [247, 247, 247],
          [67, 147, 195],
          [5, 48, 97],
        ]),
      },
    ),
  },
  'carbonplan-4d': {
    data: zarrCollection(
      'carbonplan-4d',
      'Monthly average temperature and precipitation (Zarr v2 ndpyramid, EPSG:3857).',
      [-180, -85, 180, 85],
      {
        href: 'https://carbonplan-maps.s3.us-west-2.amazonaws.com/v2/demo/4d/tavg-prec-month',
        type: ZARR_V2,
      },
      {
        dimensions: {
          band: {type: 'bands', values: ['tavg', 'prec']},
          month: {type: 'other'},
          y: {type: 'spatial', axis: 'y', extent: [-20037509, 20037509]},
          x: {type: 'spatial', axis: 'x', extent: [-20037509, 20037509]},
        },
        variables: {
          climate: {type: 'data', dimensions: ['band', 'month', 'y', 'x']},
        },
      },
      {
        bands: ['tavg'],
        rescale: [[-30, 30]],
        colormap: gradient([
          [5, 48, 97],
          [67, 147, 195],
          [247, 247, 247],
          [214, 96, 77],
          [103, 0, 31],
        ]),
      },
    ),
  },
  'cmip6-tasmax': {
    data: zarrCollection(
      'cmip6-tasmax',
      'CMIP6 daily maximum temperature, ACCESS-CM2 historical (Zarr v2 ndpyramid).',
      [-180, -85, 180, 85],
      {
        href: 'https://carbonplan-benchmarks.s3.us-west-2.amazonaws.com/data/NEX-GDDP-CMIP6/ACCESS-CM2/historical/r1i1p1f1/tasmax/tasmax_day_ACCESS-CM2_historical_r1i1p1f1_gn/pyramids-v2-4326-True-128-1-0-0-f4-0-0-0-gzipL1-100',
        type: ZARR_V2,
      },
      {
        dimensions: {
          time: {type: 'temporal', extent: [null, null]},
          y: {type: 'spatial', axis: 'y', extent: [-90, 90]},
          x: {type: 'spatial', axis: 'x', extent: [-180, 180]},
        },
        variables: {
          tasmax: {type: 'data', dimensions: ['time', 'y', 'x']},
        },
      },
      {
        rescale: [[250, 320]],
        colormap: gradient([
          [0, 0, 4],
          [101, 21, 110],
          [212, 72, 66],
          [250, 193, 39],
          [252, 255, 164],
        ]),
      },
    ),
  },
  'tos-con': {
    data: zarrCollection(
      'ocean-tos-con',
      'Ocean surface temperature from the NOC eORCA1 model (Zarr v3 pyramid, EPSG:3857).',
      [-180, -85, 180, 85],
      {
        href: 'https://atlantis-vis-o.s3-ext.jc.rl.ac.uk/noc-npd-era5-demo/npd-eorca1-era5v1/gn/T1y/tos_con',
        type: ZARR_V3_MULTISCALES,
      },
      {
        dimensions: {
          time: {type: 'temporal', extent: [null, null]},
          y: {type: 'spatial', axis: 'y', extent: [-20037508, 20037508]},
          x: {type: 'spatial', axis: 'x', extent: [-20037508, 20037508]},
        },
        variables: {
          tos_con: {type: 'data', dimensions: ['time', 'y', 'x']},
        },
      },
      {
        rescale: [[-2, 30]],
        colormap: gradient([
          [5, 48, 97],
          [67, 147, 195],
          [247, 247, 247],
          [214, 96, 77],
          [103, 0, 31],
        ]),
      },
    ),
  },
};

const select = document.getElementById('preset-select');
const button = document.getElementById('load-preset');

let layer;
updateLayer();

function updateLayer() {
  if (layer) {
    map.removeLayer(layer);
  }
  const preset = presets[select.value];
  layer = new STAC({
    url: preset.url,
    data: preset.data,
    assets: preset.assets,
    bands: preset.bands,
    maxDisplayPixels: preset.maxDisplayPixels,
    getSourceOptions: (type, options) => {
      if (preset.sourceOptions) {
        const {selector, ...rest} = preset.sourceOptions;
        Object.assign(options, rest);
        if (selector) {
          options.selector = Object.assign({}, options.selector, selector);
        }
      }
      return options;
    },
  });
  layer.on('sourceready', () => {
    map.getView().fit(layer.getExtent(), {padding: [20, 20, 20, 20]});
  });
  layer.on('error', (event) => {
    alert('An unexpected error occurred: ' + event.error.message);
  });
  map.addLayer(layer);
}

button.addEventListener('click', updateLayer);
select.addEventListener('change', updateLayer);

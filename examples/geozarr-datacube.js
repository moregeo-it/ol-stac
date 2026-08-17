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
 * through general STAC metadata:
 * - the datacube extension describes the store's dimensions and variables,
 * - the `statistics` of the asset provide the value range for the default
 *   (grayscale) visualization,
 * - the projection extension provides the extent and orientation for stores
 *   without their own spatial metadata.
 * A specific visualization (e.g. a colormap) could additionally be declared
 * through the render extension.
 * @param {string} id The collection id.
 * @param {string} description The collection description.
 * @param {Array<number>} bbox The bounding box in WGS84.
 * @param {Object} asset The `data` asset, including `href`, `type` and any
 * asset-level fields such as `statistics`, `proj:bbox` or `proj:transform`.
 * @param {{dimensions: Object, variables: Object}} cube The datacube extension fields.
 * @return {Object} The STAC Collection.
 */
function zarrCollection(id, description, bbox, asset, cube) {
  return {
    type: 'Collection',
    stac_version: '1.1.0',
    stac_extensions: [
      'https://stac-extensions.github.io/datacube/v2.2.0/schema.json',
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
    links: [],
    assets: {
      data: {
        roles: ['data'],
        ...asset,
      },
    },
  };
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
    colormap: false, // RGB, so a colormap does not apply
  },
  'ftw-field-2024': {
    url: FTW_URL,
    bands: ['field'],
    sourceOptions: {dimensions: {time: 0}}, // 2024 instead of the latest year
    colormap: false, // no STAC statistics, so there is no range to color over
  },
  'usgs-dem': {
    data: zarrCollection(
      'usgs-conus-dem',
      'USGS 10m DEM for the conterminous US, as a multiscale Zarr v3 store.',
      [-125.6, 24.8, -67.2, 49.1],
      {
        href: 'https://carbonplan-share.s3.us-west-2.amazonaws.com/zarr-layer-examples/USGS-CONUS-DEM-10m.zarr',
        type: ZARR_V3_MULTISCALES,
        statistics: {minimum: 0, maximum: 3500},
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
        statistics: {minimum: 96000, maximum: 103000},
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
        statistics: {minimum: 0, maximum: 12},
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
        statistics: {minimum: 0, maximum: 1},
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
        statistics: {minimum: -5, maximum: 5},
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
    ),
  },
  'carbonplan-4d': {
    // Select the temperature slice of the packed bands dimension
    bands: ['tavg'],
    data: zarrCollection(
      'carbonplan-4d',
      'Monthly average temperature and precipitation (Zarr v2 ndpyramid, EPSG:3857).',
      [-180, -85, 180, 85],
      {
        href: 'https://carbonplan-maps.s3.us-west-2.amazonaws.com/v2/demo/4d/tavg-prec-month',
        type: ZARR_V2,
        statistics: {minimum: -30, maximum: 30},
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
        statistics: {minimum: 250, maximum: 320},
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
        statistics: {minimum: -2, maximum: 30},
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
    ),
  },
};

const select = document.getElementById('preset-select');
const colormapSelect = document.getElementById('colormap-select');
const colormapGroup = document.getElementById('colormap-group');

// Colormaps for continuous single-band data (grayscale if not set),
// evenly distributed over the value range from the STAC statistics
const colormaps = {
  'grayscale': null,
  'viridis': ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
  'inferno': ['#000004', '#57106e', '#bc3754', '#f98e09', '#fcffa4'],
  'rdbu': ['#b2182b', '#ef8a62', '#f7f7f7', '#67a9cf', '#2166ac'],
};

let layer;
updateLayer();

function updateLayer() {
  if (layer) {
    map.removeLayer(layer);
  }
  const preset = presets[select.value];
  colormapGroup.style.display = preset.colormap === false ? 'none' : '';
  layer = new STAC({
    url: preset.url,
    data: preset.data,
    assets: preset.assets,
    bands: preset.bands,
    maxDisplayPixels: preset.maxDisplayPixels,
    defaultColormap: colormaps[colormapSelect.value],
    getSourceOptions: (type, options) => {
      if (preset.sourceOptions) {
        const {dimensions, ...rest} = preset.sourceOptions;
        Object.assign(options, rest);
        if (dimensions) {
          options.dimensions = Object.assign(
            {},
            options.dimensions,
            dimensions,
          );
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

select.addEventListener('change', updateLayer);
colormapSelect.addEventListener('change', () => {
  layer.setDefaultColormap(colormaps[colormapSelect.value]);
});

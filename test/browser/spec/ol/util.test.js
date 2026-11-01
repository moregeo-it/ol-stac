import create from 'stac-js';
import {
  getGeoTiffSourceInfoFromAsset,
  getGeoTiffStyleFromAsset,
  getGeoZarrSourceOptionsFromAsset,
  getGeoZarrStyleFromAsset,
} from '../../../../src/ol/util.js';

function getAsset(asset, collectionFields = {}) {
  const collection = create(
    {
      stac_version: '1.1.0',
      type: 'Collection',
      id: 'test',
      description: 'Test',
      license: 'other',
      extent: {
        spatial: {bbox: [[-180, -90, 180, 90]]},
        temporal: {interval: [[null, null]]},
      },
      links: [],
      ...collectionFields,
      assets: {data: {href: 'https://example.com/data', ...asset}},
    },
    false,
  );
  return collection.getAsset('data');
}

const rgbBands = [
  {name: 'red', 'eo:common_name': 'red', data_type: 'uint8'},
  {name: 'green', 'eo:common_name': 'green', data_type: 'uint8'},
  {name: 'blue', 'eo:common_name': 'blue', data_type: 'uint8'},
];

const classes = [
  {value: 1, name: 'water', color_hint: '0000FF'},
  {value: 2, name: 'land', color_hint: '00FF00'},
];

const gray = (min, max) => [
  'interpolate',
  ['linear'],
  ['band', 1],
  min,
  0,
  max,
  255,
];

function rgb(ranges, bands = [1, 2, 3]) {
  return {
    color: [
      'color',
      ...bands.map((band, i) => [
        'interpolate',
        ['linear'],
        ['band', band],
        ranges[i][0],
        0,
        ranges[i][1],
        255,
      ]),
    ],
  };
}

function datacube(bandValues, extra = {}) {
  return {
    'cube:dimensions': {
      band: {type: 'bands', values: bandValues},
      y: {type: 'spatial', axis: 'y', extent: [0, 10]},
      x: {type: 'spatial', axis: 'x', extent: [0, 10]},
    },
    'cube:variables': {
      rgba: {type: 'data', dimensions: ['band', 'y', 'x']},
    },
    ...extra,
  };
}

describe('ol/util', function () {
  describe('getGeoTiffSourceInfoFromAsset', function () {
    it('derives per-band ranges from the data type and selects RGB', function () {
      const asset = getAsset({type: 'image/tiff', bands: rgbBands});
      const info = getGeoTiffSourceInfoFromAsset(asset, []);
      expect(info.min).toEqual([0, 0, 0]);
      expect(info.max).toEqual([255, 255, 255]);
      expect(info.bands).toEqual([1, 2, 3]);
    });

    it('uses the per-band statistics and nodata', function () {
      const asset = getAsset({
        type: 'image/tiff',
        nodata: 0,
        bands: [
          {name: 'b1', statistics: {minimum: 1, maximum: 100}},
          {name: 'b2', statistics: {minimum: 2, maximum: 200}, nodata: 5},
        ],
      });
      const info = getGeoTiffSourceInfoFromAsset(asset, ['b2']);
      expect(info.min).toEqual([1, 2]);
      expect(info.max).toEqual([100, 200]);
      expect(info.nodata).toEqual([0, 5]);
      expect(info.bands).toEqual([2]);
    });

    it('uses the asset statistics without bands', function () {
      const asset = getAsset({
        type: 'image/tiff',
        statistics: {minimum: 10, maximum: 20},
      });
      const info = getGeoTiffSourceInfoFromAsset(asset, []);
      expect(info.min).toBe(10);
      expect(info.max).toBe(20);
      expect(info.bands).toBeUndefined();
    });

    it('applies the render rescale per rendered band', function () {
      const asset = getAsset({
        type: 'image/tiff',
        bands: rgbBands,
        renders: {
          default: {
            assets: ['data'],
            bidx: [['blue', 'green', 'red']],
            rescale: [
              [0, 10],
              [0, 20],
              [0, 30],
            ],
          },
        },
      });
      const info = getGeoTiffSourceInfoFromAsset(asset, []);
      expect(info.bands).toEqual([3, 2, 1]);
      expect(info.min).toEqual([0, 0, 0]);
      expect(info.max).toEqual([30, 20, 10]);
    });

    it('applies a single render rescale to all bands', function () {
      const asset = getAsset({
        type: 'image/tiff',
        bands: rgbBands,
        renders: {default: {assets: ['data'], rescale: [[0, 100]]}},
      });
      const info = getGeoTiffSourceInfoFromAsset(asset, []);
      expect(info.min).toBe(0);
      expect(info.max).toBe(100);
    });

    it('prefers the render nodata', function () {
      const asset = getAsset({
        type: 'image/tiff',
        nodata: 5,
        renders: {default: {assets: ['data'], nodata: 0, rescale: [[0, 1]]}},
      });
      const info = getGeoTiffSourceInfoFromAsset(asset, []);
      expect(info.nodata).toBe(0);
    });

    it('selects the bands of a render by index or name', function () {
      const asset = getAsset({
        type: 'image/tiff',
        bands: rgbBands,
        renders: {default: {assets: ['data'], bidx: [[3, 'green']]}},
      });
      expect(getGeoTiffSourceInfoFromAsset(asset, []).bands).toEqual([3, 2]);
    });

    it('selects the bands of a render with a flat bidx', function () {
      const asset = getAsset({
        type: 'image/tiff',
        bands: rgbBands,
        renders: {default: {assets: ['data'], bidx: [3, 2, 1]}},
      });
      expect(getGeoTiffSourceInfoFromAsset(asset, []).bands).toEqual([3, 2, 1]);
    });

    it('ignores renders that do not only reference the asset', function () {
      const several = getAsset({
        type: 'image/tiff',
        statistics: {minimum: 1, maximum: 2},
        renders: {default: {assets: ['data', 'other'], rescale: [[0, 100]]}},
      });
      const none = getAsset({
        type: 'image/tiff',
        statistics: {minimum: 1, maximum: 2},
        renders: {default: {rescale: [[0, 100]]}},
      });
      expect(getGeoTiffSourceInfoFromAsset(several, []).max).toBe(2);
      expect(getGeoTiffSourceInfoFromAsset(none, []).max).toBe(2);
    });

    it('ignores renders with an expression', function () {
      const asset = getAsset({
        type: 'image/tiff',
        statistics: {minimum: 1, maximum: 2},
        renders: {
          default: {
            assets: ['data'],
            rescale: [[0, 100]],
            expression: ['*', ['band', 1], 2],
          },
        },
      });
      expect(getGeoTiffSourceInfoFromAsset(asset, []).max).toBe(2);
    });

    it('ignores named colormaps unless a colormap is given', function () {
      const named = getAsset({
        type: 'image/tiff',
        statistics: {minimum: 1, maximum: 2},
        renders: {
          default: {
            assets: ['data'],
            rescale: [[0, 100]],
            colormap_name: 'viridis',
          },
        },
      });
      const both = getAsset({
        type: 'image/tiff',
        statistics: {minimum: 1, maximum: 2},
        renders: {
          default: {
            assets: ['data'],
            rescale: [[0, 100]],
            colormap_name: 'viridis',
            colormap: {1: [255, 0, 0]},
          },
        },
      });
      expect(getGeoTiffSourceInfoFromAsset(named, []).max).toBe(2);
      expect(getGeoTiffSourceInfoFromAsset(both, []).max).toBe(100);
    });

    it('leaves the range to OpenLayers without metadata', function () {
      const asset = getAsset({type: 'image/tiff'});
      const info = getGeoTiffSourceInfoFromAsset(asset, []);
      expect(info.min).toBeUndefined();
      expect(info.max).toBeUndefined();
    });
  });

  describe('getGeoTiffStyleFromAsset', function () {
    const colormap = ['#000000', '#ffffff'];

    function style(asset, selectedBands = [], defaultColormap = null) {
      const info = getGeoTiffSourceInfoFromAsset(asset, selectedBands);
      return getGeoTiffStyleFromAsset(asset, info, defaultColormap);
    }

    it('leaves RGB to the source normalization', function () {
      const asset = getAsset({type: 'image/tiff', bands: rgbBands});
      expect(style(asset, [], colormap)).toBeNull();
    });

    it('leaves a single band to the source normalization without a colormap', function () {
      const asset = getAsset({
        type: 'image/tiff',
        bands: [{name: 'b1', statistics: {minimum: 0, maximum: 100}}],
      });
      expect(style(asset)).toBeNull();
    });

    it('colors a single band with the default colormap', function () {
      const asset = getAsset({
        type: 'image/tiff',
        bands: [{name: 'b1', statistics: {minimum: 0, maximum: 100}}],
      });
      expect(style(asset, [], colormap)).toEqual({
        color: [
          'interpolate',
          ['linear'],
          ['band', 1],
          0,
          '#000000',
          100,
          '#ffffff',
        ],
      });
    });

    it('colors a selected band with its own statistics', function () {
      const asset = getAsset({
        type: 'image/tiff',
        statistics: {minimum: 0, maximum: 1},
        bands: [
          {name: 'b1', statistics: {minimum: 0, maximum: 100}},
          {name: 'b2', statistics: {minimum: 50, maximum: 60}},
        ],
      });
      expect(style(asset, ['b2'], colormap)).toEqual({
        color: [
          'interpolate',
          ['linear'],
          ['band', 1],
          50,
          '#000000',
          60,
          '#ffffff',
        ],
      });
    });

    it('falls back to the asset statistics for a selected band', function () {
      const asset = getAsset({
        type: 'image/tiff',
        statistics: {minimum: 0, maximum: 1},
        bands: [{name: 'b1'}, {name: 'b2'}],
      });
      expect(style(asset, [2], colormap)).toEqual({
        color: [
          'interpolate',
          ['linear'],
          ['band', 1],
          0,
          '#000000',
          1,
          '#ffffff',
        ],
      });
    });

    it('does not color floating point data without a range', function () {
      const asset = getAsset({
        type: 'image/tiff',
        bands: [{name: 'b1', data_type: 'float32'}],
      });
      expect(style(asset, [], colormap)).toBeNull();
    });

    it('applies the classification of a single band', function () {
      const asset = getAsset({
        type: 'image/tiff',
        bands: [
          {name: 'b1', data_type: 'uint8', 'classification:classes': classes},
        ],
      });
      expect(style(asset, [], colormap)).toEqual({
        color: [
          'match',
          ['band', 1],
          1,
          ['color', 0, 0, 255, 1],
          2,
          ['color', 0, 255, 0, 1],
          ['color', 0, 0, 0, 0],
        ],
      });
    });

    it('applies the classification of a selected band', function () {
      const asset = getAsset({
        type: 'image/tiff',
        bands: [
          {name: 'b1', data_type: 'uint8'},
          {name: 'b2', data_type: 'uint8', 'classification:classes': classes},
        ],
      });
      expect(style(asset, ['b2'])).toEqual({
        color: [
          'match',
          ['band', 1],
          1,
          ['color', 0, 0, 255, 1],
          2,
          ['color', 0, 255, 0, 1],
          ['color', 0, 0, 0, 0],
        ],
      });
    });

    it('does not apply a classification to floating point data', function () {
      const asset = getAsset({
        type: 'image/tiff',
        bands: [
          {
            name: 'b1',
            data_type: 'float32',
            'classification:classes': classes,
          },
        ],
      });
      expect(style(asset)).toBeNull();
    });

    it('applies a render colormap with its rescale', function () {
      const asset = getAsset({
        type: 'image/tiff',
        bands: [{name: 'b1', data_type: 'uint16'}],
        renders: {
          default: {
            assets: ['data'],
            rescale: [[0, 1000]],
            colormap: {1: [255, 0, 0], 2: [0, 255, 0, 128]},
          },
        },
      });
      const scaled = ['floor', ['clamp', gray(0, 1000), 0, 255]];
      expect(style(asset, [], colormap)).toEqual({
        color: [
          'case',
          ['==', scaled, 1],
          [255, 0, 0],
          ['==', scaled, 2],
          [0, 255, 0, 128 / 255],
          [0, 0, 0, 0],
        ],
      });
    });

    it('keeps the default visualization for renders that do not style', function () {
      const asset = getAsset({
        type: 'image/tiff',
        bands: [
          {name: 'b1', data_type: 'uint8'},
          {name: 'b2', data_type: 'uint8', 'classification:classes': classes},
        ],
        renders: {default: {assets: ['data'], bidx: [[2]], nodata: 0}},
      });
      expect(style(asset)).toEqual({
        color: [
          'match',
          ['band', 1],
          1,
          ['color', 0, 0, 255, 1],
          2,
          ['color', 0, 255, 0, 1],
          ['color', 0, 0, 0, 0],
        ],
      });
    });

    it('leaves a render rescale to the source info', function () {
      const asset = getAsset({
        type: 'image/tiff',
        bands: [{name: 'b1', 'classification:classes': classes}],
        renders: {default: {assets: ['data'], rescale: [[0, 1000]]}},
      });
      const info = getGeoTiffSourceInfoFromAsset(asset, []);
      expect(info.min).toBe(0);
      expect(info.max).toBe(1000);
      expect(getGeoTiffStyleFromAsset(asset, info, colormap)).toBeNull();
    });
  });

  describe('getGeoZarrStyleFromAsset', function () {
    function style(asset, selectedBands = [], defaultColormap = null) {
      const options = getGeoZarrSourceOptionsFromAsset(asset, selectedBands);
      return getGeoZarrStyleFromAsset(asset, options, defaultColormap);
    }

    it('stretches RGB bands with their statistics', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: [
          {...rgbBands[0], statistics: {minimum: 1, maximum: 10}},
          {...rgbBands[1], statistics: {minimum: 2, maximum: 20}},
          {...rgbBands[2], statistics: {minimum: 3, maximum: 30}},
        ],
      });
      expect(style(asset)).toEqual(
        rgb([
          [1, 10],
          [2, 20],
          [3, 30],
        ]),
      );
    });

    it('stretches RGB bands over the range of their data type', function () {
      const asset = getAsset({type: 'application/vnd.zarr', bands: rgbBands});
      expect(style(asset)).toEqual(
        rgb([
          [0, 255],
          [0, 255],
          [0, 255],
        ]),
      );
    });

    it('stretches a single band over the asset statistics', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        statistics: {minimum: 0, maximum: 100},
        bands: [{name: 'b1', data_type: 'float32'}],
      });
      expect(style(asset)).toEqual({
        color: ['color', gray(0, 100), gray(0, 100), gray(0, 100)],
      });
    });

    it('does not stretch floating point data without statistics', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: [{name: 'b1', data_type: 'float32'}],
      });
      expect(style(asset)).toBeNull();
    });

    it('applies the classification of a single band', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: [
          {name: 'b1', data_type: 'uint8'},
          {name: 'b2', data_type: 'uint8', 'classification:classes': classes},
        ],
      });
      expect(style(asset, ['b2'])).toEqual({
        color: [
          'match',
          ['band', 1],
          1,
          ['color', 0, 0, 255, 1],
          2,
          ['color', 0, 255, 0, 1],
          ['color', 0, 0, 0, 0],
        ],
      });
    });

    it('stretches datacube bands over the range of their data type', function () {
      const asset = getAsset(
        {
          type: 'application/vnd.zarr; version=3; profile=multiscales',
          bands: ['red', 'green', 'blue', 'alpha'].map((name) => ({
            name,
            data_type: 'uint8',
          })),
        },
        datacube(['red', 'green', 'blue', 'alpha']),
      );
      const options = getGeoZarrSourceOptionsFromAsset(asset, []);
      expect(options.variable).toBe('rgba');
      expect(options.dimensions).toEqual({band: [0, 1, 2]});
      expect(getGeoZarrStyleFromAsset(asset, options)).toEqual(
        rgb([
          [0, 255],
          [0, 255],
          [0, 255],
        ]),
      );
    });

    it('uses the statistics of the selected datacube bands', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: [
          {name: 'rgba[band=red]', statistics: {minimum: 1, maximum: 10}},
          {name: 'rgba[band=green]', statistics: {minimum: 2, maximum: 20}},
          {name: 'rgba[band=blue]', statistics: {minimum: 3, maximum: 30}},
          {name: 'rgba[band=alpha]', statistics: {minimum: 4, maximum: 40}},
        ],
        ...datacube(['red', 'green', 'blue', 'alpha']),
      });
      expect(style(asset, [3, 2, 4])).toEqual(
        rgb([
          [3, 30],
          [2, 20],
          [4, 40],
        ]),
      );
    });

    it('matches datacube bands by position if the names differ', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: [
          {
            name: 'B04',
            'eo:common_name': 'red',
            statistics: {minimum: 1, maximum: 10},
          },
          {
            name: 'B03',
            'eo:common_name': 'green',
            statistics: {minimum: 2, maximum: 20},
          },
          {
            name: 'B02',
            'eo:common_name': 'blue',
            statistics: {minimum: 3, maximum: 30},
          },
        ],
        ...datacube(['r', 'g', 'b']),
      });
      expect(style(asset)).toEqual(
        rgb([
          [1, 10],
          [2, 20],
          [3, 30],
        ]),
      );
    });

    it('applies the classification of a selected datacube band', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: [
          {name: 'a', data_type: 'uint8'},
          {name: 'b', data_type: 'uint8', 'classification:classes': classes},
        ],
        ...datacube(['a', 'b']),
      });
      expect(style(asset, ['b'])).toEqual({
        color: [
          'match',
          ['band', 1],
          1,
          ['color', 0, 0, 255, 1],
          2,
          ['color', 0, 255, 0, 1],
          ['color', 0, 0, 0, 0],
        ],
      });
    });

    it('resolves band objects of the source options by name', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: [
          {name: 'b1', statistics: {minimum: 1, maximum: 10}},
          {name: 'b2', statistics: {minimum: 2, maximum: 20}},
        ],
      });
      const options = {
        url: 'https://example.com/data',
        bands: [{name: 'b2', group: 'measurements'}],
      };
      expect(getGeoZarrStyleFromAsset(asset, options)).toEqual({
        color: ['color', gray(2, 20), gray(2, 20), gray(2, 20)],
      });
    });

    it('stretches several slices of a non-bands dimension as RGB', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        statistics: {minimum: 0, maximum: 50},
        'cube:dimensions': {
          time: {type: 'temporal', extent: [null, null]},
          y: {type: 'spatial', axis: 'y', extent: [0, 10]},
          x: {type: 'spatial', axis: 'x', extent: [0, 10]},
        },
        'cube:variables': {
          temperature: {type: 'data', dimensions: ['time', 'y', 'x']},
        },
      });
      const options = {
        url: 'https://example.com/data',
        variable: 'temperature',
        dimensions: {time: [0, 1, 2]},
      };
      expect(getGeoZarrStyleFromAsset(asset, options)).toEqual(
        rgb([
          [0, 50],
          [0, 50],
          [0, 50],
        ]),
      );
    });

    it('stretches several slices of a variable without datacube metadata as RGB', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        statistics: {minimum: 0, maximum: 50},
      });
      const options = {
        url: 'https://example.com/data',
        variable: 'temperature',
        dimensions: {time: [0, 1, 2]},
      };
      expect(getGeoZarrStyleFromAsset(asset, options)).toEqual(
        rgb([
          [0, 50],
          [0, 50],
          [0, 50],
        ]),
      );
    });

    it('uses the selected band for several slices of another dimension', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: [
          {name: 'a', statistics: {minimum: 1, maximum: 10}},
          {name: 'b', statistics: {minimum: 2, maximum: 20}},
        ],
        'cube:dimensions': {
          time: {type: 'temporal', extent: [null, null]},
          band: {type: 'bands', values: ['a', 'b']},
          y: {type: 'spatial', axis: 'y', extent: [0, 10]},
          x: {type: 'spatial', axis: 'x', extent: [0, 10]},
        },
        'cube:variables': {
          data: {type: 'data', dimensions: ['time', 'band', 'y', 'x']},
        },
      });
      const options = {
        url: 'https://example.com/data',
        variable: 'data',
        dimensions: {time: [0, 1, 2], band: 'b'},
      };
      expect(getGeoZarrStyleFromAsset(asset, options)).toEqual(
        rgb([
          [2, 20],
          [2, 20],
          [2, 20],
        ]),
      );
    });

    it('resolves a single index of the bands dimension', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: [
          {name: 'a', statistics: {minimum: 1, maximum: 10}},
          {name: 'b', statistics: {minimum: 2, maximum: 20}},
        ],
        ...datacube(['a', 'b']),
      });
      const options = {
        url: 'https://example.com/data',
        variable: 'rgba',
        dimensions: {band: 1},
      };
      expect(getGeoZarrStyleFromAsset(asset, options)).toEqual({
        color: ['color', gray(2, 20), gray(2, 20), gray(2, 20)],
      });
    });

    it('defaults to the first index of an unlisted bands dimension', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: [
          {name: 'a', statistics: {minimum: 1, maximum: 10}},
          {name: 'b', statistics: {minimum: 2, maximum: 20}},
        ],
        ...datacube(['a', 'b']),
      });
      const options = {url: 'https://example.com/data', variable: 'rgba'};
      expect(getGeoZarrStyleFromAsset(asset, options)).toEqual({
        color: ['color', gray(1, 10), gray(1, 10), gray(1, 10)],
      });
    });

    it('resolves labels of the bands dimension', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: [
          {name: 'rgba[band=red]', statistics: {minimum: 1, maximum: 10}},
          {name: 'rgba[band=green]', statistics: {minimum: 2, maximum: 20}},
          {name: 'rgba[band=blue]', statistics: {minimum: 3, maximum: 30}},
        ],
        ...datacube(['red', 'green', 'blue']),
      });
      const options = {
        url: 'https://example.com/data',
        variable: 'rgba',
        dimensions: {band: ['blue', 'red', 'green']},
      };
      expect(getGeoZarrStyleFromAsset(asset, options)).toEqual(
        rgb([
          [3, 30],
          [1, 10],
          [2, 20],
        ]),
      );
    });

    it('resolves band names for the rendered variable', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: [
          {name: 'rgba[band=a]', statistics: {minimum: 1, maximum: 10}},
          {name: 'rgba[band=b]', statistics: {minimum: 2, maximum: 20}},
          {name: 'other[band=a]', statistics: {minimum: 5, maximum: 50}},
          {name: 'other[band=b]', statistics: {minimum: 6, maximum: 60}},
        ],
        'cube:dimensions': {
          band: {type: 'bands', values: ['a', 'b']},
          y: {type: 'spatial', axis: 'y', extent: [0, 10]},
          x: {type: 'spatial', axis: 'x', extent: [0, 10]},
        },
        'cube:variables': {
          rgba: {type: 'data', dimensions: ['band', 'y', 'x']},
          other: {type: 'data', dimensions: ['band', 'y', 'x']},
        },
      });
      const options = {
        url: 'https://example.com/data',
        variable: 'other',
        dimensions: {band: [1]},
      };
      expect(getGeoZarrStyleFromAsset(asset, options)).toEqual({
        color: ['color', gray(6, 60), gray(6, 60), gray(6, 60)],
      });
    });

    it('makes pixels transparent in which all bands are nodata', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: rgbBands.map((band) => ({...band, nodata: 0})),
      });
      expect(style(asset)).toEqual({
        color: [
          'case',
          [
            'all',
            ['==', ['band', 1], 0],
            ['==', ['band', 2], 0],
            ['==', ['band', 3], 0],
          ],
          [0, 0, 0, 0],
          rgb([
            [0, 255],
            [0, 255],
            [0, 255],
          ]).color,
        ],
      });
    });

    it('applies the asset nodata to a single band', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        nodata: 5,
        bands: [{name: 'b1', statistics: {minimum: 0, maximum: 100}}],
      });
      expect(style(asset, ['b1'])).toEqual({
        color: [
          'case',
          ['==', ['band', 1], 5],
          [0, 0, 0, 0],
          ['color', gray(0, 100), gray(0, 100), gray(0, 100)],
        ],
      });
    });

    it('ignores nodata unless all bands have a finite nodata value', function () {
      const partial = getAsset({
        type: 'application/vnd.zarr',
        bands: [{...rgbBands[0], nodata: 0}, rgbBands[1], rgbBands[2]],
      });
      const nan = getAsset({
        type: 'application/vnd.zarr',
        bands: [{name: 'b1', data_type: 'uint8', nodata: 'nan'}],
      });
      expect(style(partial).color[0]).toBe('color');
      expect(style(nan, ['b1']).color[0]).toBe('color');
    });

    it('prefers the render nodata', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: rgbBands.map((band) => ({...band, nodata: 5})),
        renders: {default: {assets: ['data'], nodata: 0}},
      });
      expect(style(asset).color.slice(0, 3)).toEqual([
        'case',
        [
          'all',
          ['==', ['band', 1], 0],
          ['==', ['band', 2], 0],
          ['==', ['band', 3], 0],
        ],
        [0, 0, 0, 0],
      ]);
    });

    it('applies a render colormap to a single band only', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: [
          {name: 'b1', data_type: 'uint8'},
          {name: 'b2', data_type: 'uint8'},
        ],
        renders: {
          default: {
            assets: ['data'],
            rescale: [[0, 100]],
            colormap: {1: [255, 0, 0]},
          },
        },
      });
      expect(style(asset, ['b1', 'b2'])).toEqual({
        color: ['color', gray(0, 100), gray(0, 100), gray(0, 100)],
      });
      expect(style(asset, ['b1']).color[0]).toBe('case');
    });

    it('resolves render bands of a datacube by the STAC band names', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: ['red', 'green', 'blue'].map((value) => ({
          name: `rgba[band=${value}]`,
          data_type: 'uint8',
        })),
        renders: {
          default: {
            assets: ['data'],
            bidx: [['rgba[band=blue]', 'rgba[band=green]']],
          },
        },
        ...datacube(['red', 'green', 'blue']),
      });
      const options = getGeoZarrSourceOptionsFromAsset(asset, []);
      expect(options.dimensions).toEqual({band: [2, 1]});
    });

    it('resolves the RGB bands of a datacube by the STAC band names', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: ['alpha', 'red', 'green', 'blue'].map((value) => ({
          name: `rgba[band=${value}]`,
          'eo:common_name': value === 'alpha' ? undefined : value,
          data_type: 'uint8',
        })),
        ...datacube(['alpha', 'red', 'green', 'blue']),
      });
      const options = getGeoZarrSourceOptionsFromAsset(asset, []);
      expect(options.dimensions).toEqual({band: [1, 2, 3]});
    });

    it('selects the bands of a render by index', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: rgbBands,
        renders: {default: {assets: ['data'], bidx: [[3]]}},
      });
      expect(getGeoZarrSourceOptionsFromAsset(asset, []).bands).toEqual([
        'blue',
      ]);
    });

    it('resolves reordered STAC band names of a datacube by their value', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: [
          {
            name: 'rgba[band=blue]',
            'eo:common_name': 'blue',
            statistics: {minimum: 3, maximum: 30},
          },
          {
            name: 'rgba[band=green]',
            'eo:common_name': 'green',
            statistics: {minimum: 2, maximum: 20},
          },
          {
            name: 'rgba[band=red]',
            'eo:common_name': 'red',
            statistics: {minimum: 1, maximum: 10},
          },
        ],
        ...datacube(['red', 'green', 'blue']),
      });
      const options = getGeoZarrSourceOptionsFromAsset(asset, []);
      expect(options.dimensions).toEqual({band: [0, 1, 2]});
      expect(getGeoZarrStyleFromAsset(asset, options)).toEqual(
        rgb([
          [1, 10],
          [2, 20],
          [3, 30],
        ]),
      );
      const blue = getGeoZarrSourceOptionsFromAsset(asset, ['rgba[band=blue]']);
      expect(blue.dimensions).toEqual({band: [2]});
    });

    it('does not match STAC bands of another variable by position', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: [
          {name: 'other[band=a]', statistics: {minimum: 5, maximum: 50}},
          {name: 'other[band=b]', statistics: {minimum: 6, maximum: 60}},
        ],
        statistics: {minimum: 0, maximum: 1},
        ...datacube(['a', 'b']),
      });
      expect(
        getGeoZarrSourceOptionsFromAsset(asset, ['other[band=b]']).dimensions,
      ).toEqual({});
      const options = {
        url: 'https://example.com/data',
        variable: 'rgba',
        dimensions: {band: [1]},
      };
      expect(getGeoZarrStyleFromAsset(asset, options)).toEqual({
        color: ['color', gray(0, 1), gray(0, 1), gray(0, 1)],
      });
    });

    it('applies a render rescale to all bands', function () {
      const asset = getAsset({
        type: 'application/vnd.zarr',
        bands: rgbBands,
        renders: {default: {assets: ['data'], rescale: [[0, 100]]}},
      });
      expect(style(asset)).toEqual(
        rgb([
          [0, 100],
          [0, 100],
          [0, 100],
        ]),
      );
    });
  });
});

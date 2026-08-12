import tsParser from '@typescript-eslint/parser';
import openlayers from 'eslint-config-openlayers';

/**
 * @type {Array<import("eslint").Linter.Config>}
 */
export default [
  ...openlayers,
  {
    // global ignores (don't include other keys in this object)
    // https://eslint.org/docs/latest/use/configure/configuration-files#globally-ignoring-files-with-ignores
    ignores: [
      'config/jsdoc/api/template/static/scripts/',
      'examples/resources/*',
      'site/build/*',
    ],
  },
  {
    name: 'common-config',
    rules: {
      'import/no-unresolved': [
        'error',
        {
          'ignore': ['@octokit/rest', '@typescript-eslint/parser'],
        },
      ],
      'no-unused-vars': ['error', {'caughtErrorsIgnorePattern': '^_$'}],
    },
  },
  {
    // Vendored from OpenLayers; kept line-identical to the upstream file
    // (only the import paths differ), so the import order must not change.
    name: 'vendored-geozarr-config',
    files: ['src/ol/source/GeoZarr.js'],
    rules: {
      'import/order': 'off',
      // OpenLayers keeps the (currently unused) loader `options` parameter.
      // An inline eslint-disable is not an option, as it would be flagged
      // (and removed by --fix) as unused in the OpenLayers repository.
      'no-unused-vars': [
        'error',
        {'argsIgnorePattern': '^options$', 'caughtErrorsIgnorePattern': '^_$'},
      ],
    },
  },
  {
    name: 'examples-config',
    files: ['examples/*'],
    rules: {
      'no-unused-vars': ['error', {'varsIgnorePattern': '^map'}],
    },
    languageOptions: {
      globals: {
        arc: 'readonly',
        bootstrap: 'readonly',
        createMapboxStreetsV6Style: 'readonly',
        gifler: 'readonly',
        GyroNorm: 'readonly',
        mapboxgl: 'readonly',
        NumpyLoader: 'readonly',
        toastr: 'readonly',
        topolis: 'readonly',
      },
    },
  },
  {
    name: 'test-config',
    files: ['test/**/*'],
    languageOptions: {
      globals: {
        after: 'readonly',
        afterEach: 'readonly',
        afterLoadText: 'readonly',
        before: 'readonly',
        beforeEach: 'readonly',
        createMapDiv: 'readonly',
        defineCustomMapEl: 'readonly',
        expect: 'readonly',
        describe: 'readonly',
        disposeMap: 'readonly',
        it: 'readonly',
        render: 'readonly',
        sinon: 'readonly',
        where: 'readonly',
      },
    },
  },
  {
    name: 'test-typescript-config',
    files: ['test/typescript/**/*.ts'],
    languageOptions: {
      parser: tsParser,
    },
    rules: {
      'import/named': 'off',
    },
  },
];

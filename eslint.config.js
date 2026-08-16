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
      'jsdoc/reject-any-type': ['off'], //TODO: make codebase work with 'error' instead of 'off'
      'jsdoc/reject-function-type': ['off'], //TODO: make codebase work with 'error' instead of 'off'
      'no-unused-vars': [
        'error',
        {'vars': 'all', 'args': 'none', 'caughtErrorsIgnorePattern': '^_$'},
      ],
    },
  },
  {
    // Vendored from OpenLayers; kept line-identical to the upstream file
    // (only the import paths differ), so the import order must not change.
    // Drop the organize-imports plugin here so imports are not reordered.
    name: 'vendored-geozarr-config',
    files: ['src/ol/source/GeoZarr.js'],
    rules: {
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          bracketSpacing: false,
          quoteProps: 'preserve',
        },
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
        afterAll: 'readonly',
        afterEach: 'readonly',
        afterLoadText: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        createMapDiv: 'readonly',
        defineCustomMapEl: 'readonly',
        expect: 'readonly',
        describe: 'readonly',
        disposeMap: 'readonly',
        it: 'readonly',
        render: 'readonly',
        vi: 'readonly',
        where: 'readonly',
      },
    },
  },
];

const path = require('path');
const puppeteer = require('puppeteer');

process.env.CHROME_BIN = puppeteer.executablePath();

const flags = ['--headless=new'];
if (process.env.CI) {
  flags.push('--no-sandbox');
}

module.exports = function (karma) {
  karma.set({
    browsers: ['ChromeHeadless'],
    customLaunchers: {
      ChromeHeadless: {
        base: 'Chrome',
        flags,
      },
    },
    browserDisconnectTolerance: 2,
    frameworks: ['webpack', 'mocha', 'source-map-support'],
    client: {
      runInParent: true,
      mocha: {
        timeout: 2500,
      },
    },
    files: [
      {
        pattern: path.resolve(__dirname, require.resolve('expect.js/index.js')),
        watched: false,
      },
      {
        pattern: path.resolve(
          __dirname,
          require.resolve('../../node_modules/sinon/pkg/sinon.js'),
        ),
        watched: false,
      },
      {
        pattern: path.resolve(__dirname, require.resolve('ol/dist/ol.js')),
        watched: false,
      },
      {
        pattern: path.resolve(
          __dirname,
          require.resolve('proj4/dist/proj4.js'),
        ),
        watched: false,
      },
      {
        pattern: path.resolve(__dirname, './test-extensions.js'),
      },
      {
        pattern: 'spec/**/*.test.js',
        watched: false,
      },
      {
        pattern: '**/*',
        included: false,
        watched: false,
      },
    ],
    proxies: {
      '/spec/': '/base/spec/',
    },
    preprocessors: {
      '**/*.js': ['webpack'], //, 'sourcemap'],
    },
    reporters: ['dots'],
    webpack: {
      devtool: 'inline-source-map',
      mode: 'development',
      resolve: {
        fallback: {
          fs: false,
          http: false,
          https: false,
        },
      },
      module: {
        rules: [
          {
            test: /\.js$/,
            enforce: 'pre',
            use: ['source-map-loader'],
          },
        ],
      },
    },
    webpackMiddleware: {
      noInfo: true,
    },
  });

  process.env.CHROME_BIN = require('puppeteer').executablePath();
};

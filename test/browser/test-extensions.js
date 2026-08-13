import {setLevel as setLogLevel} from 'ol/console.js';

setLogLevel('error');

(function (global) {
  function afterLoad(type, path, next) {
    const client = new XMLHttpRequest();
    client.open('GET', path, true);
    client.onload = function () {
      let data;
      if (type === 'xml') {
        data = client.responseXML;
      } else {
        data = client.responseText;
      }
      if (!data) {
        throw new Error(path + ' loading failed: ' + client.status);
      }
      next(data);
    };
    client.send();
  }

  /**
   * @param {string} path Relative path to file (e.g. 'spec/ol/foo.json').
   * @param {function(Object): void} next Function to call with response object on
   *     success.  On failure, an error is thrown with the reason.
   */
  global.afterLoadJson = function (path, next) {
    afterLoad('json', path, next);
  };

  /**
   * @param {string} path Relative path to file (e.g. 'spec/ol/foo.txt').
   * @param {function(string): void} next Function to call with response text on
   *     success.  On failure, an error is thrown with the reason.
   */
  global.afterLoadText = function (path, next) {
    afterLoad('text', path, next);
  };

  /**
   * @param {string} path Relative path to file (e.g. 'spec/ol/foo.xml').
   * @param {function(Document): void} next Function to call with response xml on
   *     success.  On failure, an error is thrown with the reason.
   */
  global.afterLoadXml = function (path, next) {
    afterLoad('xml', path, next);
  };

  global.createMapDiv = function (width, height) {
    const target = document.createElement('div');
    const style = target.style;
    style.position = 'absolute';
    style.left = '-1000px';
    style.top = '-1000px';
    style.width = width + 'px';
    style.height = height + 'px';
    document.body.appendChild(target);

    return target;
  };

  global.disposeMap = function (map) {
    const target = map.getTarget();
    map.setTarget(null);
    if (target && target.parentNode) {
      target.parentNode.removeChild(target);
    }
    map.dispose();
  };

  const features = {
    ArrayBuffer: 'ArrayBuffer' in global,
    'ArrayBuffer.isView': 'ArrayBuffer' in global && !!ArrayBuffer.isView,
    FileReader: 'FileReader' in global,
    Uint8ClampedArray: 'Uint8ClampedArray' in global,
    WebGL: false,
  };

  /**
   * Allow tests to be skipped where certain features are not available.  The
   * provided key must be in the above `features` lookup.  Keys should
   * correspond to the feature that is required, but can be any string.
   * @param {string} key The required feature name.
   * @return {Object} An object with a `describe` function that will run tests
   *     if the required feature is available and skip them otherwise.
   */
  global.where = function (key) {
    if (!(key in features)) {
      throw new Error('where() called with unknown key: ' + key);
    }
    return {
      describe: features[key] ? global.describe : global.describe.skip,
      it: features[key] ? global.it : global.it.skip,
    };
  };

  // throw if anybody appends a div to the body and doesn't remove it
  afterEach(function () {
    const garbage = document.body.getElementsByTagName('div');
    if (garbage.length) {
      throw new Error('Found extra <div> elements in the body');
    }
  });
})(window);

/**
 * A worker that decompresses the points of COPC octree nodes and
 * transforms them to the projection of the map.
 * @module ol/worker/COPC
 */
import {PointData, View} from 'copc/lib/las/index.js';
import {createLazPerf} from 'laz-perf';
import proj4 from 'proj4';
import lazPerfWasm from '../shim/lazPerfWasm.js';

/** @type {function(): Worker} */ export let create;

/**
 * A projection that can be transferred to the worker.
 * @typedef {Object} ProjectionDefinition
 * @property {string} code The code of the projection.
 * @property {string|Object} definition The proj4 definition of the projection.
 */

/**
 * The points of an octree node, ready for upload to the GPU.
 * The horizontal coordinates are in the projection of the map, relative to `origin`
 * so that they keep their precision as 32-bit floats.
 *
 * @typedef {Object} Points
 * @property {number} count The number of points.
 * @property {Array<number>} origin The origin of the coordinates in the projection of the map.
 * @property {Float32Array} xy Interleaved coordinates relative to the origin.
 * @property {Float32Array} z Elevations.
 * @property {Uint16Array|null} rgb Interleaved colors, if available.
 * @property {Uint8Array} classification Classifications.
 * @property {Uint16Array} intensity Intensities.
 */

/** @type {any} */
const worker = self;

/**
 * @type {{header: import("copc").Las.Header, eb: Array<import("copc").Las.ExtraBytes>, source: string}|null}
 */
let metadata = null;

/**
 * @type {Promise<Object>|null}
 */
let lazPerf = null;

/**
 * @param {ProjectionDefinition} projection The projection.
 * @return {string} The code of the projection, registered with proj4.
 */
function register(projection) {
  if (!proj4.defs(projection.code)) {
    proj4.defs(projection.code, projection.definition);
  }
  return projection.code;
}

/**
 * @param {ArrayBuffer} compressed The compressed points.
 * @param {number} pointCount The number of points.
 * @param {ProjectionDefinition} target The projection of the map.
 * @return {Promise<Points>} The points.
 */
async function decode(compressed, pointCount, target) {
  if (!lazPerf) {
    const wasm = Uint8Array.from(atob(lazPerfWasm), (c) => c.charCodeAt(0));
    lazPerf = createLazPerf({wasmBinary: wasm.buffer});
  }
  const {header, eb} = metadata;
  const buffer = await PointData.decompressChunk(
    new Uint8Array(compressed),
    {
      pointCount,
      pointDataRecordFormat: header.pointDataRecordFormat,
      pointDataRecordLength: header.pointDataRecordLength,
    },
    /** @type {*} */ (await lazPerf),
  );
  const colors = [2, 3, 5, 7, 8, 10].includes(header.pointDataRecordFormat);
  const include = ['X', 'Y', 'Z', 'Intensity', 'Classification'];
  if (colors) {
    include.push('Red', 'Green', 'Blue');
  }
  const view = View.create(buffer, header, eb, include);
  const converter = proj4(metadata.source, register(target));
  const count = view.pointCount;
  const getX = view.getter('X');
  const getY = view.getter('Y');
  const getZ = view.getter('Z');
  const getIntensity = view.getter('Intensity');
  const getClassification = view.getter('Classification');
  const data = {
    count,
    origin: [0, 0],
    xy: new Float32Array(count * 2),
    z: new Float32Array(count),
    rgb: colors ? new Uint16Array(count * 3) : null,
    classification: new Uint8Array(count),
    intensity: new Uint16Array(count),
  };
  for (let i = 0; i < count; i++) {
    const [x, y] = converter.forward([getX(i), getY(i)]);
    if (i === 0) {
      data.origin = [x, y];
    }
    data.xy[i * 2] = x - data.origin[0];
    data.xy[i * 2 + 1] = y - data.origin[1];
    data.z[i] = getZ(i);
    data.intensity[i] = getIntensity(i);
    data.classification[i] = getClassification(i);
  }
  if (colors) {
    const getters = [
      view.getter('Red'),
      view.getter('Green'),
      view.getter('Blue'),
    ];
    for (let i = 0; i < count; i++) {
      for (let c = 0; c < 3; c++) {
        data.rgb[i * 3 + c] = getters[c](i);
      }
    }
  }
  return data;
}

worker.onmessage = async (/** @type {MessageEvent} */ event) => {
  const message = event.data;
  if (message.type === 'init') {
    metadata = {
      header: message.header,
      eb: message.eb,
      source: register(message.projection),
    };
    return;
  }
  const id = message.id;
  try {
    const data = await decode(
      message.buffer,
      message.pointCount,
      message.target,
    );
    const buffers = [
      data.xy.buffer,
      data.z.buffer,
      data.classification.buffer,
      data.intensity.buffer,
    ];
    if (data.rgb) {
      buffers.push(data.rgb.buffer);
    }
    worker.postMessage({id, data}, buffers);
  } catch (error) {
    worker.postMessage({id, error: error.message});
  }
};

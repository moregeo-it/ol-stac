/**
 * @module ol/source/COPCDecoderPool
 */
import {create as createWorker} from '../worker/COPC.js';

/**
 * @typedef {Object} Task
 * @property {function(import("../worker/COPC.js").Points): void} resolve Resolves the task.
 * @property {function(Error): void} reject Rejects the task.
 */

/**
 * @typedef {Object} Metadata
 * @property {import("copc").Las.Header} header The LAS header.
 * @property {Array<import("copc").Las.ExtraBytes>} eb The extra bytes.
 * @property {import("../worker/COPC.js").ProjectionDefinition} projection The projection of the point cloud.
 */

/**
 * @return {number} The default number of workers.
 */
function getDefaultSize() {
  const cores =
    typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 0;
  return Math.max(1, Math.min(4, (cores || 2) - 1));
}

/**
 * @classdesc
 * Decompresses COPC nodes and transforms the points in web workers.
 */
class COPCDecoderPool {
  /**
   * @param {Metadata} metadata The metadata of the point cloud.
   * @param {number} [size] The number of workers.
   * @param {function(Error): void} [onError] Called if the workers fail to load.
   */
  constructor(metadata, size = getDefaultSize(), onError = () => {}) {
    /**
     * @type {Array<Worker>}
     * @private
     */
    this.workers_ = [];

    /**
     * @type {Map<number, Task>}
     * @private
     */
    this.tasks_ = new Map();

    /**
     * @type {number}
     * @private
     */
    this.taskId_ = 0;

    /**
     * @type {function(Error): void}
     * @private
     */
    this.onError_ = onError;

    for (let i = 0; i < Math.max(1, size); i++) {
      const worker = createWorker();
      worker.onmessage = (event) => {
        const {id, data, error} = event.data;
        const task = this.tasks_.get(id);
        if (!task) {
          return;
        }
        this.tasks_.delete(id);
        if (error) {
          task.reject(new Error(error));
        } else {
          task.resolve(data);
        }
      };
      // e.g. if a Content Security Policy doesn't allow workers from blob URLs
      worker.onerror = () =>
        this.fail_(new Error('The worker to decode the point cloud failed'));
      worker.postMessage({type: 'init', ...metadata});
      this.workers_.push(worker);
    }
  }

  /**
   * @return {number} The number of tasks that can run in parallel.
   */
  getConcurrency() {
    return this.workers_.length;
  }

  /**
   * @param {Error} error The error.
   * @private
   */
  fail_(error) {
    this.dispose(error);
    this.onError_(error);
  }

  /**
   * @param {ArrayBuffer} buffer The compressed points, transferred to the worker.
   * @param {number} pointCount The number of points.
   * @param {import("../worker/COPC.js").ProjectionDefinition} target The projection of the map.
   * @return {Promise<import("../worker/COPC.js").Points>} The points.
   */
  decode(buffer, pointCount, target) {
    return new Promise((resolve, reject) => {
      if (this.workers_.length === 0) {
        reject(new Error('The pool is disposed'));
        return;
      }
      const id = ++this.taskId_;
      this.tasks_.set(id, {resolve, reject});
      const worker = this.workers_[id % this.workers_.length];
      worker.postMessage({type: 'decode', id, buffer, pointCount, target}, [
        buffer,
      ]);
    });
  }

  /**
   * Terminates the workers and rejects the pending tasks.
   * @param {Error} [error] The reason.
   */
  dispose(error = new Error('The pool is disposed')) {
    this.workers_.forEach((worker) => worker.terminate());
    this.workers_ = [];
    this.tasks_.forEach((task) => task.reject(error));
    this.tasks_.clear();
  }
}

export default COPCDecoderPool;

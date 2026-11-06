/**
 * @module ol/worker/COPC
 */
import COPCTileRenderer from '../source/COPCTileRenderer.js';

/**
 * @type {*}
 */
const worker = self;

/**
 * @type {COPCTileRenderer|null}
 */
let renderer = null;

/**
 * @type {Set<number>}
 */
const aborted = new Set();

worker.onmessage = async (event) => {
  const message = event.data;
  switch (message.type) {
    case 'init':
      renderer = new COPCTileRenderer(message.options);
      break;
    case 'abort':
      aborted.add(message.id);
      break;
    case 'render': {
      const id = message.id;
      try {
        const data = await renderer.render(message.request, () =>
          aborted.has(id),
        );
        worker.postMessage({id, data}, [data.buffer]);
      } catch (error) {
        worker.postMessage({id, error: error.message});
      } finally {
        aborted.delete(id);
      }
      break;
    }
    default:
      break;
  }
};

/**
 * @module ol/source/COPCBand
 */

/**
 * The one-based band indices of the data tiles provided by the COPC source.
 *
 * - `Z`: Elevation of the highest point in the pixel
 * - `Intensity`: Intensity
 * - `Classification`: ASPRS classification
 * - `Red`, `Green`, `Blue`: Color (0 if the point cloud has no colors)
 * - `Shade`: Lighting (0-1) from a hillshade, cast shadows and ambient occlusion
 * - `Alpha`: 1 if the pixel contains a point, 0 otherwise
 *
 * @enum {number}
 * @api
 */
const COPCBand = {
  Z: 1,
  Intensity: 2,
  Classification: 3,
  Red: 4,
  Green: 5,
  Blue: 6,
  Shade: 7,
  Alpha: 8,
};

export default COPCBand;

/**
 * @module ol/renderer/COPCLayer
 */
import {asArray} from 'ol/color.js';
import {intersects} from 'ol/extent.js';
import {getPointResolution, getTransform} from 'ol/proj.js';
import LayerRenderer from 'ol/renderer/Layer.js';
import {ROOT} from '../source/COPC.js';
import WebGLPointCloud from '../webgl/PointCloud.js';

/**
 * @type {Object<number, string>}
 */
const ASPRS_CLASS_COLORS = {
  0: '#aaaaaa',
  1: '#aaaaaa',
  2: '#aa5500',
  3: '#00aaaa',
  4: '#55ff55',
  5: '#00aa00',
  6: '#ff5555',
  7: '#aa00aa',
  9: '#5555ff',
  10: '#555555',
  11: '#777777',
  13: '#ffff55',
  14: '#ffaa00',
  15: '#ff55ff',
  17: '#ffff55',
  18: '#aa00aa',
};

const DEFAULT_COLORMAP = [
  '#440154',
  '#3b528b',
  '#21918c',
  '#5ec962',
  '#fde725',
];

const COLOR_MODES = ['rgb', 'classification', 'elevation', 'intensity'];

/**
 * @param {Array<import("ol/color.js").Color|string>} colors The colors.
 * @return {Uint8Array} 256 interpolated RGBA colors.
 */
function createRamp(colors) {
  const stops = colors.map((color) => asArray(color));
  const ramp = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const position = (i / 255) * (stops.length - 1);
    const index = Math.min(Math.floor(position), stops.length - 2);
    const t = position - index;
    for (let c = 0; c < 3; c++) {
      ramp[i * 4 + c] =
        stops[index][c] + (stops[index + 1][c] - stops[index][c]) * t;
    }
    ramp[i * 4 + 3] = 255;
  }
  return ramp;
}

/**
 * @param {Object<number, import("ol/color.js").Color|string>} classColors The colors per class.
 * @return {Uint8Array} 256 RGBA colors.
 */
function createClassColors(classColors) {
  const colors = new Uint8Array(256 * 4).fill(170);
  for (const value in classColors) {
    const color = asArray(classColors[value]);
    colors.set([color[0], color[1], color[2], 255], Number(value) * 4);
  }
  return colors;
}

/**
 * @param {string} key The node key.
 * @return {Array<string>} The keys of the child nodes.
 */
function getChildKeys(key) {
  const [d, x, y, z] = key.split('-').map(Number);
  const children = [];
  for (let i = 0; i < 8; i++) {
    children.push(
      `${d + 1}-${x * 2 + (i & 1)}-${y * 2 + ((i >> 1) & 1)}-${z * 2 + ((i >> 2) & 1)}`,
    );
  }
  return children;
}

/**
 * @typedef {Object} LoadedNode
 * @property {import("../webgl/PointCloud.js").PointBuffers} points The GPU resources.
 * @property {number} lastUsed The last frame in which the node was rendered.
 */

/**
 * @classdesc
 * Renders a {@link module:ol/layer/COPC~COPCLayer}: selects the octree nodes for the
 * view, loads them through the source and draws them with WebGL.
 * @extends {LayerRenderer<import("../layer/COPC.js").default>}
 */
class COPCLayerRenderer extends LayerRenderer {
  /**
   * @param {import("../layer/COPC.js").default} layer The layer.
   */
  constructor(layer) {
    super(layer);

    /**
     * @type {WebGLPointCloud|null}
     * @private
     */
    this.pointCloud_ = null;

    /**
     * @type {string}
     * @private
     */
    this.colorsKey_ = '';

    /**
     * @type {import("../source/COPC.js").default|null}
     * @private
     */
    this.source_ = null;

    /**
     * @type {string|null}
     * @private
     */
    this.viewProjectionCode_ = null;

    /**
     * The extents of the nodes in the projection of the map.
     * @type {Object<string, import("ol/extent.js").Extent>}
     * @private
     */
    this.nodeExtents_ = {};

    /**
     * Map units per horizontal unit of the point cloud.
     * @type {number}
     * @private
     */
    this.horizontalScale_ = 1;

    /**
     * @type {Map<string, LoadedNode>}
     * @private
     */
    this.loaded_ = new Map();

    /**
     * @type {Set<string>}
     * @private
     */
    this.loading_ = new Set();

    /**
     * @type {number}
     * @private
     */
    this.loadedPoints_ = 0;

    /**
     * @type {number}
     * @private
     */
    this.frame_ = 0;
  }

  /**
   * @param {import("ol/Map.js").FrameState} frameState The frame state.
   * @return {boolean} Whether the layer can be rendered.
   * @override
   */
  prepareFrame(frameState) {
    const source = this.getLayer().getSource();
    return Boolean(source) && source.getState() === 'ready';
  }

  /**
   * Drops the loaded nodes if the source or the projection of the map changed.
   * @param {import("../source/COPC.js").default} source The source.
   * @param {import("ol/proj/Projection.js").default} viewProjection The projection of the map.
   * @private
   */
  update_(source, viewProjection) {
    const code = viewProjection.getCode();
    if (source === this.source_ && code === this.viewProjectionCode_) {
      return;
    }
    this.clear_();
    this.source_ = source;
    this.viewProjectionCode_ = code;
    this.nodeExtents_ = {};
    const cube = source.getMetadata().info.cube;
    const extent = this.getNodeExtent_(ROOT);
    this.horizontalScale_ = (extent[2] - extent[0]) / (cube[3] - cube[0]);
  }

  /**
   * @private
   */
  clear_() {
    for (const {points} of this.loaded_.values()) {
      this.pointCloud_.deleteBuffers(points);
    }
    this.loaded_.clear();
    this.loading_.clear();
    this.loadedPoints_ = 0;
  }

  /**
   * @param {string} key The node key.
   * @return {import("ol/extent.js").Extent} The extent in the projection of the map.
   * @private
   */
  getNodeExtent_(key) {
    let extent = this.nodeExtents_[key];
    if (!extent) {
      const [d, x, y] = key.split('-').map(Number);
      const cube = this.source_.getMetadata().info.cube;
      const size = (cube[3] - cube[0]) / Math.pow(2, d);
      const minX = cube[0] + x * size;
      const minY = cube[1] + y * size;
      const corners = [
        minX,
        minY,
        minX + size,
        minY,
        minX + size,
        minY + size,
        minX,
        minY + size,
      ];
      getTransform(this.source_.getProjection(), this.viewProjectionCode_)(
        corners,
        corners,
        2,
      );
      extent = [
        Math.min(corners[0], corners[2], corners[4], corners[6]),
        Math.min(corners[1], corners[3], corners[5], corners[7]),
        Math.max(corners[0], corners[2], corners[4], corners[6]),
        Math.max(corners[1], corners[3], corners[5], corners[7]),
      ];
      this.nodeExtents_[key] = extent;
    }
    return extent;
  }

  /**
   * @param {number} depth The depth in the octree.
   * @return {number} The spacing of the points at the depth in map units.
   * @private
   */
  getSpacing_(depth) {
    const spacing = this.source_.getMetadata().info.spacing;
    return (spacing * this.horizontalScale_) / Math.pow(2, depth);
  }

  /**
   * Selects the nodes to render, coarse nodes and nodes close to the center first.
   * @param {import("ol/Map.js").FrameState} frameState The frame state.
   * @param {number} reach How far points may be shifted by the tilt in map units.
   * @return {Array<string>} The node keys.
   * @private
   */
  selectNodes_(frameState, reach) {
    const layer = this.getLayer();
    const source = this.source_;
    const {center, resolution} = frameState.viewState;
    const viewExtent = frameState.extent;
    const extent = [
      viewExtent[0] - reach,
      viewExtent[1] - reach,
      viewExtent[2] + reach,
      viewExtent[3] + reach,
    ];
    const targetSpacing = layer.getPointSize() * resolution;

    /** @type {Array<{key: string, depth: number, distance: number}>} */
    const candidates = [];
    const stack = [ROOT];
    while (stack.length > 0) {
      const key = stack.pop();
      const node = source.getNode(key);
      if (!node) {
        continue;
      }
      const nodeExtent = this.getNodeExtent_(key);
      if (!intersects(nodeExtent, extent)) {
        continue;
      }
      const depth = parseInt(key, 10);
      if (node.pointCount > 0) {
        const dx = (nodeExtent[0] + nodeExtent[2]) / 2 - center[0];
        const dy = (nodeExtent[1] + nodeExtent[3]) / 2 - center[1];
        candidates.push({key, depth, distance: Math.hypot(dx, dy)});
      }
      if (this.getSpacing_(depth) > targetSpacing) {
        stack.push(...getChildKeys(key));
      }
    }
    candidates.sort((a, b) => a.depth - b.depth || a.distance - b.distance);

    const selected = [];
    let points = 0;
    for (const {key} of candidates) {
      points += source.getNode(key).pointCount;
      if (points > layer.getPointBudget()) {
        break;
      }
      selected.push(key);
    }
    return selected;
  }

  /**
   * @param {string} key The node key.
   * @param {import("ol/proj/Projection.js").default} viewProjection The projection of the map.
   * @private
   */
  loadNode_(key, viewProjection) {
    const source = this.source_;
    this.loading_.add(key);
    source
      .loadPoints(key, viewProjection)
      .then((data) => {
        // The nodes were dropped in the meantime
        if (!this.loading_.delete(key) || source !== this.source_) {
          return;
        }
        this.loaded_.set(key, {
          points: this.pointCloud_.createBuffers(data),
          lastUsed: this.frame_,
        });
        this.loadedPoints_ += data.count;
        this.getLayer().changed();
      })
      .catch(() => this.loading_.delete(key));
  }

  /**
   * Releases the least recently used nodes that are not rendered.
   * @private
   */
  releaseNodes_() {
    const max = this.getLayer().getMaxLoadedPoints();
    if (this.loadedPoints_ <= max) {
      return;
    }
    const nodes = Array.from(this.loaded_.entries()).sort(
      (a, b) => a[1].lastUsed - b[1].lastUsed,
    );
    for (const [key, loaded] of nodes) {
      if (this.loadedPoints_ <= max || loaded.lastUsed === this.frame_) {
        break;
      }
      this.pointCloud_.deleteBuffers(loaded.points);
      this.loaded_.delete(key);
      this.loadedPoints_ -= loaded.points.count;
    }
  }

  /**
   * @private
   */
  updateColors_() {
    const layer = this.getLayer();
    const classColors = layer.getClassColors() || ASPRS_CLASS_COLORS;
    const colormap = layer.getColormap() || DEFAULT_COLORMAP;
    const key = JSON.stringify([classColors, colormap]);
    if (key !== this.colorsKey_) {
      this.colorsKey_ = key;
      this.pointCloud_.setColors(
        createClassColors(classColors),
        createRamp(colormap),
      );
    }
  }

  /**
   * @param {import("ol/Map.js").FrameState} frameState The frame state.
   * @param {HTMLElement|null} target The target that may be used to render content to.
   * @return {HTMLElement} The rendered element.
   * @override
   */
  renderFrame(frameState, target) {
    const layer = this.getLayer();
    const source = layer.getSource();
    if (!this.pointCloud_) {
      this.pointCloud_ = new WebGLPointCloud();
    }
    const canvas = this.pointCloud_.canvas;
    const layerState = frameState.layerStatesArray[frameState.layerIndex];
    canvas.style.opacity = String(layerState.opacity);

    const viewProjection = frameState.viewState.projection;
    this.update_(source, viewProjection);
    this.updateColors_();
    this.frame_++;

    const {min, max} = source.getMetadata().header;
    const statistics = source.getStatistics();
    const ground =
      layer.getGroundElevation() ?? (statistics ? statistics.ground : min[2]);
    const top = statistics ? statistics.top : max[2];

    const {center, resolution} = frameState.viewState;
    const sourceProjection = source.getProjection();
    // Assumes metric elevations for geographic coordinates
    const metersPerElevation =
      sourceProjection.getUnits() === 'degrees'
        ? 1
        : sourceProjection.getMetersPerUnit();
    const elevationScale =
      metersPerElevation / getPointResolution(viewProjection, 1, center, 'm');
    const lean = Math.tan((layer.getTilt() * Math.PI) / 180) * elevationScale;
    const reach = Math.max(top - ground, ground - min[2]) * lean;

    const selected = this.selectNodes_(frameState, reach);
    const selectedKeys = new Set(selected);
    // Points beyond the deepest level are enlarged to close the gaps
    const minPointSize = Math.max(
      layer.getPointSize(),
      this.getSpacing_(source.getMaxDepth()) / resolution,
    );
    const drawCalls = [];
    const missing = [];
    for (const key of selected) {
      const loaded = this.loaded_.get(key);
      if (!loaded) {
        if (!this.loading_.has(key)) {
          missing.push(key);
        }
        continue;
      }
      loaded.lastUsed = this.frame_;
      // Enlarge the points while their children are loading to close the gaps
      const incomplete = getChildKeys(key).some(
        (child) => selectedKeys.has(child) && !this.loaded_.has(child),
      );
      const pointSize = incomplete
        ? Math.max(
            minPointSize,
            this.getSpacing_(parseInt(key, 10)) / resolution,
          )
        : minPointSize;
      drawCalls.push({points: loaded.points, pointSize});
    }
    const slots = source.getConcurrency() * 2 - this.loading_.size;
    for (const key of missing.slice(0, Math.max(0, slots))) {
      this.loadNode_(key, viewProjection);
    }
    this.releaseNodes_();

    const colorMode = layer.getColorMode();
    let valueRange = [0, 1];
    if (colorMode === 'elevation') {
      valueRange = layer.getElevationRange() || [ground, top];
    } else if (colorMode === 'intensity') {
      valueRange = layer.getIntensityRange() || [
        0,
        statistics ? statistics.intensity : 65535,
      ];
    }

    this.pointCloud_.render(frameState, drawCalls, {
      ground,
      zRange: [min[2], max[2]],
      lean,
      elevationScale,
      colorMode: COLOR_MODES.indexOf(colorMode),
      valueRange,
      colorScale: statistics ? statistics.colorScale : 1,
      edl: layer.getEDL(),
      wallHeight: layer.getWalls() ? top - min[2] : 0,
      shading: layer.getShading(),
    });
    return canvas;
  }

  /**
   * @override
   */
  disposeInternal() {
    if (this.pointCloud_) {
      this.clear_();
      this.pointCloud_.dispose();
      this.pointCloud_ = null;
    }
    super.disposeInternal();
  }
}

export default COPCLayerRenderer;

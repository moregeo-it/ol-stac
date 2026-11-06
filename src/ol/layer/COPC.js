/**
 * @module ol/layer/COPC
 */
import Layer from 'ol/layer/Layer.js';
import COPCLayerRenderer from '../renderer/COPCLayer.js';

/**
 * @typedef {'rgb'|'classification'|'elevation'|'intensity'} ColorMode
 */

/**
 * @typedef {Object} Options
 * @property {import("../source/COPC.js").default} source The COPC source.
 * @property {number} [tilt=0] The tilt of the view in degrees, up to 75.
 * Points are shifted towards the top of the screen by their height above the ground (oblique view).
 * @property {number} [groundElevation] The elevation that is not shifted by the tilt.
 * Estimated from the point cloud by default.
 * @property {number} [pointSize=2] The size of the points in CSS pixels.
 * The level of detail is chosen so that the points are about this far apart.
 * @property {number} [pointBudget=3000000] The maximum number of points to render.
 * @property {number} [maxLoadedPoints=8000000] The maximum number of points kept on the GPU.
 * @property {ColorMode} [colorMode] How to color the points. Defaults to `rgb` if the points have colors,
 * `elevation` otherwise.
 * @property {Object<number, import("ol/color.js").Color|string>} [classColors] The colors per class.
 * Defaults to the colors of the ASPRS standard classes.
 * @property {Array<import("ol/color.js").Color|string>} [colormap] The colors for elevations and intensities.
 * @property {Array<number>} [elevationRange] The [min, max] range of elevations for the colormap.
 * Estimated from the point cloud by default.
 * @property {Array<number>} [intensityRange] The [min, max] range of intensities for the colormap.
 * Estimated from the point cloud by default.
 * @property {number} [edl=1] The strength of the eye-dome lighting (0 disables it).
 * @property {boolean} [walls=true] Whether to draw walls below elevated points in the oblique view.
 * @property {boolean} [shading=true] Whether points are shaded as domes.
 * @property {string} [className='ol-layer'] A CSS class name to set to the layer element.
 * @property {number} [opacity=1] Opacity (0, 1).
 * @property {boolean} [visible=true] Visibility.
 * @property {import("ol/extent.js").Extent} [extent] The bounding extent for layer rendering.
 * @property {number} [zIndex] The z-index for layer rendering.
 * @property {number} [minResolution] The minimum resolution (inclusive) at which this layer will be visible.
 * @property {number} [maxResolution] The maximum resolution (exclusive) below which this layer will be visible.
 * @property {number} [minZoom] The minimum view zoom level (exclusive) above which this layer will be visible.
 * @property {number} [maxZoom] The maximum view zoom level (inclusive) at which this layer will be visible.
 * @property {Object<string, *>} [properties] Arbitrary observable properties.
 */

const MAX_TILT = 75;

/**
 * @classdesc
 * A layer that renders a Cloud Optimized Point Cloud (COPC) with WebGL 2,
 * top-down or in an oblique (tilted) view that follows the rotation of the map.
 * @extends {Layer<import("../source/COPC.js").default, COPCLayerRenderer>}
 * @api
 */
class COPCLayer extends Layer {
  /**
   * @param {Options} options The options.
   */
  constructor(options) {
    super({
      source: options.source,
      className: options.className,
      opacity: options.opacity,
      visible: options.visible,
      extent: options.extent,
      zIndex: options.zIndex,
      minResolution: options.minResolution,
      maxResolution: options.maxResolution,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      properties: options.properties,
    });

    /**
     * @type {number}
     * @private
     */
    this.tilt_ = Math.min(MAX_TILT, Math.max(0, options.tilt || 0));

    /**
     * @type {number|undefined}
     * @private
     */
    this.groundElevation_ = options.groundElevation;

    /**
     * @type {number}
     * @private
     */
    this.pointSize_ = options.pointSize || 2;

    /**
     * @type {number}
     * @private
     */
    this.pointBudget_ = options.pointBudget || 3000000;

    /**
     * @type {number}
     * @private
     */
    this.maxLoadedPoints_ = options.maxLoadedPoints || 8000000;

    /**
     * @type {ColorMode|undefined}
     * @private
     */
    this.colorMode_ = options.colorMode;

    /**
     * @type {Object<number, import("ol/color.js").Color|string>|undefined}
     * @private
     */
    this.classColors_ = options.classColors;

    /**
     * @type {Array<import("ol/color.js").Color|string>|undefined}
     * @private
     */
    this.colormap_ = options.colormap;

    /**
     * @type {Array<number>|undefined}
     * @private
     */
    this.elevationRange_ = options.elevationRange;

    /**
     * @type {Array<number>|undefined}
     * @private
     */
    this.intensityRange_ = options.intensityRange;

    /**
     * @type {number}
     * @private
     */
    this.edl_ = options.edl === undefined ? 1 : options.edl;

    /**
     * @type {boolean}
     * @private
     */
    this.walls_ = options.walls !== false;

    /**
     * @type {boolean}
     * @private
     */
    this.shading_ = options.shading !== false;
  }

  /**
   * @return {number} The tilt of the view in degrees.
   * @api
   */
  getTilt() {
    return this.tilt_;
  }

  /**
   * @param {number} tilt The tilt of the view in degrees, up to 75.
   * @api
   */
  setTilt(tilt) {
    this.tilt_ = Math.min(MAX_TILT, Math.max(0, tilt));
    this.changed();
  }

  /**
   * @return {number|undefined} The elevation that is not shifted by the tilt, if set.
   * @api
   */
  getGroundElevation() {
    return this.groundElevation_;
  }

  /**
   * @return {number} The size of the points in CSS pixels.
   * @api
   */
  getPointSize() {
    return this.pointSize_;
  }

  /**
   * @param {number} pointSize The size of the points in CSS pixels.
   * @api
   */
  setPointSize(pointSize) {
    this.pointSize_ = pointSize;
    this.changed();
  }

  /**
   * @return {number} The maximum number of points to render.
   * @api
   */
  getPointBudget() {
    return this.pointBudget_;
  }

  /**
   * @return {number} The maximum number of points kept on the GPU.
   * @api
   */
  getMaxLoadedPoints() {
    return this.maxLoadedPoints_;
  }

  /**
   * @return {ColorMode} How the points are colored.
   * @api
   */
  getColorMode() {
    if (this.colorMode_) {
      return this.colorMode_;
    }
    const source = this.getSource();
    return source && source.hasColors() ? 'rgb' : 'elevation';
  }

  /**
   * @param {ColorMode} colorMode How to color the points.
   * @api
   */
  setColorMode(colorMode) {
    this.colorMode_ = colorMode;
    this.changed();
  }

  /**
   * @return {Object<number, import("ol/color.js").Color|string>|undefined} The colors per class, if set.
   * @api
   */
  getClassColors() {
    return this.classColors_;
  }

  /**
   * @return {Array<import("ol/color.js").Color|string>|undefined} The colors for elevations and intensities, if set.
   * @api
   */
  getColormap() {
    return this.colormap_;
  }

  /**
   * @return {Array<number>|undefined} The range of elevations for the colormap, if set.
   * @api
   */
  getElevationRange() {
    return this.elevationRange_;
  }

  /**
   * @return {Array<number>|undefined} The range of intensities for the colormap, if set.
   * @api
   */
  getIntensityRange() {
    return this.intensityRange_;
  }

  /**
   * @return {number} The strength of the eye-dome lighting.
   * @api
   */
  getEDL() {
    return this.edl_;
  }

  /**
   * @param {number} edl The strength of the eye-dome lighting (0 disables it).
   * @api
   */
  setEDL(edl) {
    this.edl_ = edl;
    this.changed();
  }

  /**
   * @return {boolean} Whether walls are drawn in the oblique view.
   * @api
   */
  getWalls() {
    return this.walls_;
  }

  /**
   * @param {boolean} walls Whether to draw walls below elevated points in the oblique view.
   * @api
   */
  setWalls(walls) {
    this.walls_ = walls;
    this.changed();
  }

  /**
   * @return {boolean} Whether points are shaded as domes.
   * @api
   */
  getShading() {
    return this.shading_;
  }

  /**
   * @return {COPCLayerRenderer} The renderer.
   * @override
   */
  createRenderer() {
    return new COPCLayerRenderer(this);
  }
}

export default COPCLayer;

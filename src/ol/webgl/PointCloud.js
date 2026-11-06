/**
 * @module ol/webgl/PointCloud
 */

const POINT_VERTEX = `#version 300 es
layout(location = 0) in vec2 a_xy;
layout(location = 1) in float a_z;
layout(location = 2) in vec3 a_rgb;
layout(location = 3) in float a_class;
layout(location = 4) in float a_intensity;
uniform vec2 u_offset;
uniform mat2 u_rotation;
uniform vec2 u_scale;
uniform float u_lean;
uniform float u_ground;
uniform vec2 u_zRange;
uniform float u_heightRatio;
uniform float u_bottomOffset;
uniform float u_pointSize;
uniform int u_colorMode;
uniform vec2 u_valueRange;
uniform float u_colorScale;
uniform sampler2D u_classes;
uniform sampler2D u_ramp;
out vec3 v_color;
void main() {
  vec2 clip = u_rotation * (u_offset + a_xy) * u_scale;
  // Oblique view: higher points are shifted towards the top of the screen
  clip.y += (a_z - u_ground) * u_lean;
  // The target extends above and below the viewport, so that walls can
  // start above and end below it
  clip.y = (clip.y + 1.0) * u_heightRatio + u_bottomOffset - 1.0;
  // Higher points are closer to the viewer
  float depth = 1.0 - 2.0 * (a_z - u_zRange.x) / (u_zRange.y - u_zRange.x);
  gl_Position = vec4(clip, clamp(depth, -1.0, 1.0), 1.0);
  gl_PointSize = u_pointSize;
  if (u_colorMode == 0) {
    v_color = min(a_rgb * u_colorScale, vec3(1.0));
  } else if (u_colorMode == 1) {
    v_color = texelFetch(u_classes, ivec2(int(a_class), 0), 0).rgb;
  } else {
    float value = u_colorMode == 2 ? a_z : a_intensity;
    float t = clamp((value - u_valueRange.x) / (u_valueRange.y - u_valueRange.x), 0.0, 1.0);
    v_color = texture(u_ramp, vec2(t, 0.5)).rgb;
  }
}`;

const POINT_FRAGMENT = `#version 300 es
precision highp float;
in vec3 v_color;
uniform float u_dome;
uniform bool u_shading;
out vec4 color;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) {
    discard;
  }
  // Points are drawn as domes
  float h = sqrt(1.0 - r2);
  gl_FragDepth = gl_FragCoord.z - h * u_dome;
  float light = 1.0;
  if (u_shading) {
    vec3 normal = vec3(c.x, -c.y, h);
    light = 0.8 + 0.2 * max(0.0, dot(normal, normalize(vec3(-0.4, 0.4, 0.8))));
  }
  color = vec4(v_color * light, 1.0);
}`;

const COMPOSITE_VERTEX = `#version 300 es
void main() {
  // Full screen triangle
  vec2 position = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`;

const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D u_color;
uniform highp sampler2D u_depth;
uniform float u_edl;
uniform float u_edlScale;
uniform int u_wallLength;
uniform float u_wallDrop;
uniform int u_bottom;
out vec4 color;
float depthAt(ivec2 p) {
  return texelFetch(u_depth, p, 0).r;
}
void main() {
  ivec2 size = textureSize(u_depth, 0);
  ivec2 p = ivec2(gl_FragCoord.xy) + ivec2(0, u_bottom);
  float d = depthAt(p);
  vec3 c = texelFetch(u_color, p, 0).rgb;
  float light = 1.0;

  // Fill small holes with the highest neighbor
  if (d >= 1.0) {
    int filled = 0;
    float best = 1.0;
    ivec2 bestP = p;
    for (int dy = -1; dy <= 1; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        ivec2 q = clamp(p + ivec2(dx, dy), ivec2(0), size - 1);
        float dq = depthAt(q);
        if (dq < 1.0) {
          filled++;
          if (dq < best) {
            best = dq;
            bestP = q;
          }
        }
      }
    }
    if (filled >= 4) {
      d = best;
      c = texelFetch(u_color, bestP, 0).rgb;
    }
  }

  // Walls below points that are shifted upwards (oblique view): the
  // nearest (highest) wall that passes through the pixel is visible.
  // Walls must end at points in front of them, so that there are no
  // curtains at the edges of the point cloud.
  bool closed = false;
  if (d >= 1.0 && u_wallLength > 0) {
    for (int t = 1; t <= 1024; t++) {
      ivec2 q = p - ivec2(0, t);
      if (t > u_wallLength || q.y < 0) {
        break;
      }
      if (depthAt(q) < 1.0) {
        closed = true;
        break;
      }
    }
  }
  if (closed) {
    float nearest = 1.0;
    ivec2 nearestP = p;
    for (int t = 1; t <= 1024; t++) {
      // Even the highest points can't produce a nearer wall anymore
      float drop = float(t) * u_wallDrop;
      ivec2 q = p + ivec2(0, t);
      if (t > u_wallLength || drop >= nearest || q.y >= size.y) {
        break;
      }
      float wall = depthAt(q) + drop;
      if (wall < nearest) {
        nearest = wall;
        nearestP = q;
      }
    }
    if (nearest < 1.0) {
      d = nearest;
      c = texelFetch(u_color, nearestP, 0).rgb;
      light = 0.65;
    }
  }

  if (d >= 1.0) {
    color = vec4(0.0);
    return;
  }

  // Eye-dome lighting: darken points that are lower than their neighbors
  if (u_edl > 0.0 && light == 1.0) {
    float sum = 0.0;
    for (int i = 0; i < 8; i++) {
      float angle = float(i) * 0.7853982;
      ivec2 q = clamp(p + ivec2(round(vec2(cos(angle), sin(angle)) * 2.0)), ivec2(0), size - 1);
      sum += max(0.0, d - depthAt(q));
    }
    light = 0.4 + 0.6 * exp(-u_edl * sum * u_edlScale / 8.0);
  }
  color = vec4(c * light, 1.0);
}`;

/**
 * The maximum number of rows above and below the viewport (for walls).
 */
const MAX_WALL_LENGTH = 1024;

/**
 * GPU resources of an octree node.
 * @typedef {Object} PointBuffers
 * @property {WebGLVertexArrayObject} vao The vertex array.
 * @property {Array<WebGLBuffer>} buffers The buffers.
 * @property {number} count The number of points.
 * @property {Array<number>} origin The origin of the coordinates in the projection of the map.
 */

/**
 * @typedef {Object} DrawCall
 * @property {PointBuffers} points The points to draw.
 * @property {number} pointSize The point size in CSS pixels.
 */

/**
 * @typedef {Object} Parameters
 * @property {number} ground The elevation that is not shifted by the tilt.
 * @property {Array<number>} zRange The [min, max] elevations.
 * @property {number} lean The shift in map units per elevation unit (0 for a top-down view).
 * @property {number} elevationScale The map units per elevation unit.
 * @property {number} colorMode 0: RGB, 1: classification, 2: elevation, 3: intensity.
 * @property {Array<number>} valueRange The [min, max] range for the colormap.
 * @property {number} colorScale The factor to scale the colors to 16 bits.
 * @property {number} edl The strength of the eye-dome lighting (0 disables it).
 * @property {number} wallHeight The maximum height of walls in elevation units (0 disables them).
 * @property {boolean} shading Whether points are shaded as domes.
 */

/**
 * @param {WebGL2RenderingContext} gl The context.
 * @param {string} vertex The vertex shader.
 * @param {string} fragment The fragment shader.
 * @return {WebGLProgram} The program.
 */
function createProgram(gl, vertex, fragment) {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ]) {
    const shader = gl.createShader(/** @type {number} */ (type));
    gl.shaderSource(shader, /** @type {string} */ (source));
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
  return program;
}

/**
 * @param {WebGL2RenderingContext} gl The context.
 * @param {WebGLProgram} program The program.
 * @return {Object<string, WebGLUniformLocation>} The uniform locations.
 */
function getUniforms(gl, program) {
  /** @type {Object<string, WebGLUniformLocation>} */
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const name = gl.getActiveUniform(program, i).name;
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return uniforms;
}

/**
 * @classdesc
 * Draws point clouds with WebGL 2: the points are drawn as domes into an
 * offscreen target, which is composited with hole filling, walls (for the
 * oblique view) and eye-dome lighting.
 */
class WebGLPointCloud {
  constructor() {
    /**
     * @type {HTMLCanvasElement}
     */
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';

    const gl = this.canvas.getContext('webgl2', {
      antialias: false,
      premultipliedAlpha: true,
    });
    if (!gl) {
      throw new Error('WebGL 2 is required to render point clouds');
    }

    /**
     * @type {WebGL2RenderingContext}
     * @private
     */
    this.gl_ = gl;

    /**
     * @private
     */
    this.pointProgram_ = createProgram(gl, POINT_VERTEX, POINT_FRAGMENT);

    /**
     * @private
     */
    this.pointUniforms_ = getUniforms(gl, this.pointProgram_);

    /**
     * @private
     */
    this.compositeProgram_ = createProgram(
      gl,
      COMPOSITE_VERTEX,
      COMPOSITE_FRAGMENT,
    );

    /**
     * @private
     */
    this.compositeUniforms_ = getUniforms(gl, this.compositeProgram_);

    /**
     * @private
     */
    this.emptyVao_ = gl.createVertexArray();

    /**
     * @private
     */
    this.classTexture_ = this.createLookupTexture_();

    /**
     * @private
     */
    this.rampTexture_ = this.createLookupTexture_();

    /**
     * @type {WebGLFramebuffer|null}
     * @private
     */
    this.framebuffer_ = null;

    /**
     * @type {Array<WebGLTexture>}
     * @private
     */
    this.targets_ = [];

    /**
     * @type {Array<number>}
     * @private
     */
    this.targetSize_ = [0, 0];
  }

  /**
   * @return {WebGLTexture} The texture.
   * @private
   */
  createLookupTexture_() {
    const gl = this.gl_;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  /**
   * @param {Uint8Array} classes 256 RGBA colors for the classes.
   * @param {Uint8Array} ramp 256 RGBA colors for elevations and intensities.
   */
  setColors(classes, ramp) {
    const gl = this.gl_;
    for (const [texture, data] of [
      [this.classTexture_, classes],
      [this.rampTexture_, ramp],
    ]) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        256,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        /** @type {Uint8Array} */ (data),
      );
    }
  }

  /**
   * @param {import("../worker/COPC.js").Points} data The point data.
   * @return {PointBuffers} The GPU resources.
   */
  createBuffers(data) {
    const gl = this.gl_;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffers = [];
    const attribute = (location, array, size, type, normalized) => {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, type, normalized, 0, 0);
      buffers.push(buffer);
    };
    attribute(0, data.xy, 2, gl.FLOAT, false);
    attribute(1, data.z, 1, gl.FLOAT, false);
    if (data.rgb) {
      attribute(2, data.rgb, 3, gl.UNSIGNED_SHORT, true);
    } else {
      gl.disableVertexAttribArray(2);
      gl.vertexAttrib3f(2, 0.5, 0.5, 0.5);
    }
    attribute(3, data.classification, 1, gl.UNSIGNED_BYTE, false);
    attribute(4, data.intensity, 1, gl.UNSIGNED_SHORT, false);
    gl.bindVertexArray(null);
    return {vao, buffers, count: data.count, origin: data.origin};
  }

  /**
   * @param {PointBuffers} points The GPU resources.
   */
  deleteBuffers(points) {
    const gl = this.gl_;
    gl.deleteVertexArray(points.vao);
    points.buffers.forEach((buffer) => gl.deleteBuffer(buffer));
  }

  /**
   * @param {number} width The width in pixels.
   * @param {number} height The height in pixels.
   * @private
   */
  updateTargets_(width, height) {
    if (this.targetSize_[0] === width && this.targetSize_[1] === height) {
      return;
    }
    const gl = this.gl_;
    this.targets_.forEach((texture) => gl.deleteTexture(texture));
    if (this.framebuffer_) {
      gl.deleteFramebuffer(this.framebuffer_);
    }
    const create = (internalFormat, format, type) => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        internalFormat,
        width,
        height,
        0,
        format,
        type,
        null,
      );
      return texture;
    };
    const color = create(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    const depth = create(gl.DEPTH_COMPONENT32F, gl.DEPTH_COMPONENT, gl.FLOAT);
    this.framebuffer_ = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer_);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      color,
      0,
    );
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.TEXTURE_2D,
      depth,
      0,
    );
    this.targets_ = [color, depth];
    this.targetSize_ = [width, height];
  }

  /**
   * @param {import("ol/Map.js").FrameState} frameState The frame state.
   * @param {Array<DrawCall>} drawCalls The points to draw, coarse levels first.
   * @param {Parameters} params The parameters.
   */
  render(frameState, drawCalls, params) {
    const gl = this.gl_;
    const pixelRatio = frameState.pixelRatio;
    const [cssWidth, cssHeight] = frameState.size;
    const width = Math.round(cssWidth * pixelRatio);
    const height = Math.round(cssHeight * pixelRatio);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    const {center, resolution, rotation} = frameState.viewState;
    const zRange = params.zRange;
    const zSpan = Math.max(zRange[1] - zRange[0], 1e-6);
    // Elevation units per CSS pixel on the ground
    const elevationPerPixel = resolution / params.elevationScale;

    // Walls start at points above the viewport and end at points below it
    let wallLength = 0;
    let wallDrop = 0;
    if (params.wallHeight > 0 && params.lean > 0) {
      // Elevation units per device pixel along a wall
      wallDrop = resolution / pixelRatio / params.lean;
      wallLength = Math.min(
        MAX_WALL_LENGTH,
        Math.ceil(params.wallHeight / wallDrop),
      );
    }
    // Round up to avoid reallocating the target while the tilt changes
    const extraRows = Math.ceil(wallLength / 256) * 256;
    const targetHeight = height + 2 * extraRows;
    this.updateTargets_(width, targetHeight);

    // Points
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer_);
    gl.viewport(0, 0, width, targetHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.useProgram(this.pointProgram_);
    const u = this.pointUniforms_;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    gl.uniformMatrix2fv(u.u_rotation, false, [cos, -sin, sin, cos]);
    gl.uniform2f(
      u.u_scale,
      2 / (resolution * cssWidth),
      2 / (resolution * cssHeight),
    );
    gl.uniform1f(u.u_lean, (params.lean * 2) / (resolution * cssHeight));
    gl.uniform1f(u.u_ground, params.ground);
    gl.uniform2f(u.u_zRange, zRange[0], zRange[1]);
    gl.uniform1f(u.u_heightRatio, height / targetHeight);
    gl.uniform1f(u.u_bottomOffset, (2 * extraRows) / targetHeight);
    gl.uniform1i(u.u_colorMode, params.colorMode);
    gl.uniform2f(u.u_valueRange, params.valueRange[0], params.valueRange[1]);
    gl.uniform1f(u.u_colorScale, params.colorScale);
    gl.uniform1i(u.u_shading, params.shading ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.classTexture_);
    gl.uniform1i(u.u_classes, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.rampTexture_);
    gl.uniform1i(u.u_ramp, 1);
    for (const {points, pointSize} of drawCalls) {
      gl.uniform1f(u.u_pointSize, pointSize * pixelRatio);
      gl.uniform1f(u.u_dome, (0.25 * pointSize * elevationPerPixel) / zSpan);
      gl.uniform2f(
        u.u_offset,
        points.origin[0] - center[0],
        points.origin[1] - center[1],
      );
      gl.bindVertexArray(points.vao);
      gl.drawArrays(gl.POINTS, 0, points.count);
    }
    gl.bindVertexArray(null);

    // Composite
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.compositeProgram_);
    const c = this.compositeUniforms_;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.targets_[0]);
    gl.uniform1i(c.u_color, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.targets_[1]);
    gl.uniform1i(c.u_depth, 1);
    gl.uniform1f(c.u_edl, params.edl);
    // Depth difference to the slope towards the neighbors (2 pixels away)
    gl.uniform1f(c.u_edlScale, (zSpan * pixelRatio) / (2 * elevationPerPixel));
    gl.uniform1i(c.u_wallLength, wallLength);
    gl.uniform1i(c.u_bottom, extraRows);
    gl.uniform1f(c.u_wallDrop, wallDrop / zSpan);
    gl.bindVertexArray(this.emptyVao_);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  /**
   * Releases the WebGL resources.
   */
  dispose() {
    const gl = this.gl_;
    this.targets_.forEach((texture) => gl.deleteTexture(texture));
    gl.deleteTexture(this.classTexture_);
    gl.deleteTexture(this.rampTexture_);
    if (this.framebuffer_) {
      gl.deleteFramebuffer(this.framebuffer_);
    }
    gl.deleteProgram(this.pointProgram_);
    gl.deleteProgram(this.compositeProgram_);
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) {
      lose.loseContext();
    }
  }
}

export default WebGLPointCloud;

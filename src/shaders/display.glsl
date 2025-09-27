precision highp float;

varying vec2 vUv;

uniform sampler2D textureState;
uniform float threshold;
uniform float contrast;
uniform float gamma;
uniform float invert;

void main() {
  vec4 state = texture2D(textureState, vUv);
  float value = clamp(state.g - state.r * 0.6, 0.0, 1.0);
  value = clamp((value - threshold) * contrast + 0.5, 0.0, 1.0);
  value = pow(value, max(gamma, 0.0001));
  value = mix(value, 1.0 - value, invert);
  vec3 color = vec3(value);
  gl_FragColor = vec4(color, 1.0);
}

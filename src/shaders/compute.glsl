precision highp float;

uniform float du;
uniform float dv;
uniform float feed;
uniform float kill;
uniform float dt;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  vec2 texel = 1.0 / resolution;

  vec4 state = texture2D(textureState, uv);
  float u = state.r;
  float v = state.g;

  float laplaceU =
      texture2D(textureState, uv + vec2(-texel.x, 0.0)).r * 0.2 +
      texture2D(textureState, uv + vec2(texel.x, 0.0)).r * 0.2 +
      texture2D(textureState, uv + vec2(0.0, -texel.y)).r * 0.2 +
      texture2D(textureState, uv + vec2(0.0, texel.y)).r * 0.2 +
      texture2D(textureState, uv + vec2(-texel.x, -texel.y)).r * 0.05 +
      texture2D(textureState, uv + vec2(texel.x, -texel.y)).r * 0.05 +
      texture2D(textureState, uv + vec2(-texel.x, texel.y)).r * 0.05 +
      texture2D(textureState, uv + vec2(texel.x, texel.y)).r * 0.05 -
      u;

  float laplaceV =
      texture2D(textureState, uv + vec2(-texel.x, 0.0)).g * 0.2 +
      texture2D(textureState, uv + vec2(texel.x, 0.0)).g * 0.2 +
      texture2D(textureState, uv + vec2(0.0, -texel.y)).g * 0.2 +
      texture2D(textureState, uv + vec2(0.0, texel.y)).g * 0.2 +
      texture2D(textureState, uv + vec2(-texel.x, -texel.y)).g * 0.05 +
      texture2D(textureState, uv + vec2(texel.x, -texel.y)).g * 0.05 +
      texture2D(textureState, uv + vec2(-texel.x, texel.y)).g * 0.05 +
      texture2D(textureState, uv + vec2(texel.x, texel.y)).g * 0.05 -
      v;

  float reaction = u * v * v;
  float dU = du * laplaceU - reaction + feed * (1.0 - u);
  float dV = dv * laplaceV + reaction - (feed + kill) * v;

  u += dU * dt;
  v += dV * dt;

  gl_FragColor = vec4(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0), 0.0, 1.0);
}

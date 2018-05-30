precision mediump float;

#pragma glslify: inverse = require(glsl-inverse)

attribute vec3 vector;
attribute vec4 color, position;
attribute vec2 uv;
uniform float tubeScale;
uniform float minimumTubeSize;

uniform mat4 model
           , view
           , projection;
uniform vec3 eyePosition
           , lightPosition;

varying vec3 f_normal
           , f_lightDirection
           , f_eyeDirection
           , f_data;
varying vec4 f_color;
varying vec2 f_uv;


vec3 getOrthogonalVector(vec3 v) {
  // Return up-vector for only-z vector.
  // Return ax + by + cz = 0, a point that lies on the plane that has v as a normal and that isn't (0,0,0).
  // From the above if-statement we have ||a|| > 0  U  ||b|| > 0.
  // Assign z = 0, x = -b, y = a:
  // a*-b + b*a + c*0 = -ba + ba + 0 = 0
  if (v.x*v.x > v.z*v.z || v.y*v.y > v.z*v.z) {
    return normalize(vec3(-v.y, v.x, 0.0)); 
  } else {
    return normalize(vec3(0.0, v.z, -v.y));
  }
}

// Calculate the tube vertex and normal at the given index.
//
// The returned vertex is for a tube ring with its center at origin, radius of length(d), pointing in the direction of d.
//
// Each tube segment is made up of a ring of vertices.
// These vertices are used to make up the triangles of the tube by connecting them together in the vertex array.
// The indexes of tube segments run from 0 to 8.
//
vec3 getTubePosition(vec3 d, float index, out vec3 normal) {
  float segmentCount = 8.0;

  float angle = 2.0 * 3.14159 * (index / segmentCount);

  vec3 u = getOrthogonalVector(d);
  vec3 v = normalize(cross(u, d));

  vec3 x = u * cos(angle) * (minimumTubeSize + length(d));
  vec3 y = v * sin(angle) * (minimumTubeSize + length(d));
  vec3 v3 = x + y;

  normal = normalize(v3);

  return v3;
}

void main() {
  // Scale the vector magnitude to stay constant with
  // model & view changes.
  vec3 normal;
  vec4 tubePosition = model * vec4(position.xyz, 1.0) + vec4(getTubePosition(mat3(model) * ((tubeScale - minimumTubeSize) * vector), position.w, normal), 0.0);
  normal = normalize(normal * inverse(mat3(model)));

  vec4 t_position  = view * tubePosition;
  gl_Position      = projection * t_position;
  f_color          = color;
  f_normal         = normal;
  f_data           = tubePosition.xyz;
  f_eyeDirection   = eyePosition   - tubePosition.xyz;
  f_lightDirection = lightPosition - tubePosition.xyz;
  f_uv             = uv;
}
var createStreamTubes = require('../streamtube');
var wind = require('./dataset-wind');

var createCamera = require('3d-view-controls')
var perspective  = require('gl-mat4/perspective')
var createAxes   = require('gl-axes3d')
var createSpikes = require('gl-spikes3d')
var createSelect = require('gl-select-static')
var getBounds    = require('bound-points')
var mouseChange  = require('mouse-change')
var createMesh   = require('gl-mesh3d')

var canvas = document.createElement('canvas')
document.body.appendChild(canvas)
window.addEventListener('resize', require('canvas-fit')(canvas))
var gl = canvas.getContext('webgl')

var windBounds = getBounds(wind.positions);

var indexBounds = [
  new Float32Array([0,0,0]),
  new Float32Array([40, 34, 14])
];

var bounds = indexBounds;

var camera = createCamera(canvas, {
  eye:    [0,0,50],
  center: [0.5*(bounds[0][0]+bounds[1][0]),
           0.5*(bounds[0][1]+bounds[1][1]),
           0.5*(bounds[0][2]+bounds[1][2])],
  zoomMax: 500
})
var vec3 = require('gl-vec3');


var scale = vec3.subtract(vec3.create(), windBounds[1], windBounds[0]);
vec3.inverse(scale, scale);
vec3.scale(scale, scale, 0.5);


var tmp = vec3.create();
var tmp2 = vec3.create();
var sample = function(array, width, height, depth, x, y, z) {
  x = Math.max(0, Math.min(40, x));
  y = Math.max(0, Math.min(34, y));
  z = Math.max(0, Math.min(14, z));
  var xf = x - Math.floor(x);
  var yf = y - Math.floor(y);
  var zf = z - Math.floor(z);
  var x0 = Math.floor(x), x1 = Math.ceil(x);
  var y0 = Math.floor(y), y1 = Math.ceil(y);
  var z0 = Math.floor(z), z1 = Math.ceil(z);
  var v000 = array[y0*41*15 + z0*41 + x0];
  var v001 = array[y0*41*15 + z0*41 + x1];
  var v010 = array[y1*41*15 + z0*41 + x0];
  var v011 = array[y1*41*15 + z0*41 + x1];
  var v100 = array[y0*41*15 + z1*41 + x0];
  var v101 = array[y0*41*15 + z1*41 + x1];
  var v110 = array[y1*41*15 + z1*41 + x0];
  var v111 = array[y1*41*15 + z1*41 + x1];
  var result = vec3.create();
  vec3.lerp(result, v000, v001, xf);
  vec3.lerp(tmp, v010, v011, xf);
  vec3.lerp(result, result, tmp, yf);
  vec3.lerp(tmp, v100, v101, xf);
  vec3.lerp(tmp2, v110, v111, xf);
  vec3.lerp(tmp, tmp, tmp2, yf);
  vec3.lerp(result, result, tmp, zf);
  return result;
};

var findLastSmallerIndex = function(points, v) {
  for (var i=0; i<points.length; i++) {
    if (points[i] >= v) {
      return i-1;
    }
  }
  return i;
};

var sampleMeshgrid = function(array, meshgrid, x, y, z) {
  var w = meshgrid[0].length;
  var h = meshgrid[1].length;
  var d = meshgrid[2].length;

  // Find the index of the nearest smaller value in the meshgrid for each coordinate of (x,y,z).
  // The nearest smaller value index for x is the index x0 such that
  // meshgrid[0][x0] < x and for all x1 > x0, meshgrid[0][x1] >= x.
  var x0 = findLastSmallerIndex(meshgrid[0], x);
  var y0 = findLastSmallerIndex(meshgrid[1], y);
  var y0 = findLastSmallerIndex(meshgrid[2], z);

  // Get the nearest larger meshgrid value indices.
  // From the above "nearest smaller value", we know that
  //   meshgrid[0][x0] < x
  //   meshgrid[0][x0+1] >= x
  var x1 = x0 + 1;
  var y1 = y0 + 1;
  var z1 = z0 + 1;

  // Reject points outside the meshgrid, return a zero vector.
  if (x0 < 0 || y0 < 0 || z0 < 0 || x1 >= w || y1 >= h || z1 >= d) {
    return vec3.create();
  }

  // Normalize point coordinates to 0..1 scaling factor between x0 and x1.
  var xf = (x - meshgrid[0][x0]) / (meshgrid[0][x1] - meshgrid[0][x0]);
  var yf = (y - meshgrid[1][y0]) / (meshgrid[1][y1] - meshgrid[1][y0]);
  var zf = (z - meshgrid[2][z0]) / (meshgrid[2][z1] - meshgrid[2][z0]);

  var z0off = z0*w*h;
  var y0off = y0*w;
  var x0off = x0;
  var z1off = z1*w*h;
  var y1off = y1*w;
  var x1off = x1;

  // Sample data array around the (x,y,z) point.
  //  vZYX = array[zZoff + yYoff + xXoff]
  var v000 = array[y0off + z0off + x0off];
  var v001 = array[y0off + z0off + x1off];
  var v010 = array[y1off + z0off + x0off];
  var v011 = array[y1off + z0off + x1off];
  var v100 = array[y0off + z1off + x0off];
  var v101 = array[y0off + z1off + x1off];
  var v110 = array[y1off + z1off + x0off];
  var v111 = array[y1off + z1off + x1off];

  var result = vec3.create();

  // Average samples according to distance to point.
  vec3.lerp(result, v000, v001, xf);
  vec3.lerp(tmp, v010, v011, xf);
  vec3.lerp(result, result, tmp, yf);
  vec3.lerp(tmp, v100, v101, xf);
  vec3.lerp(tmp2, v110, v111, xf);
  vec3.lerp(tmp, tmp, tmp2, yf);
  vec3.lerp(result, result, tmp, zf);

  return result;
};

var startingPositions = [];
for (var y = 0; y < 35; y+=3) {
  for (var x = 0; x < 1; x++) {
    for (var z = 0; z < 15; z+=3) {
      startingPositions.push(vec3.set(vec3.create(), x, y, z));
    }
  }
}

var meshgrid =

var streams = createStreamTubes({
  startingPositions,
  maxLength: 3000,
  widthScale: 20000,
  getVelocity: function(p) {
    var [x, y, z] = p;
    var v = vec3.create();
    var u = sampleMeshgrid(wind.vectors, meshgrid, x, y, z);
    vec3.multiply(v, u, scale);
    return v;
  },
  colormap: 'portland'
}, indexBounds);

bounds = indexBounds;

var mesh = createMesh(gl, streams);
var select = createSelect(gl, [canvas.width, canvas.height])
var axes = createAxes(gl, { bounds: bounds })
var spikes = createSpikes(gl, {
  bounds: bounds
})
var spikeChanged = false

mouseChange(canvas, function(buttons, x, y) {
  var pickData = select.query(x, canvas.height - y, 10)
  var pickResult = mesh.pick(pickData)
  if(pickResult) {
    spikes.update({
      position: pickResult.position,
      enabled: [true, true, true]
    })
    spikeChanged = true
  } else {
    spikeChanged = spikes.enabled[0]
    spikes.update({
      enabled: [false, false, false]
    })
  }
})

function render() {
  requestAnimationFrame(render)

  gl.enable(gl.DEPTH_TEST)

  var needsUpdate = camera.tick()
  var cameraParams = {
    projection: perspective([], Math.PI/4, canvas.width/canvas.height, 0.01, 1000),
    view: camera.matrix
  }

  if(needsUpdate || spikeChanged) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    axes.draw(cameraParams)
    spikes.draw(cameraParams)
    mesh.draw(cameraParams)
    spikeChanged = false
  }

  if(needsUpdate) {
    select.shape = [canvas.width, canvas.height]
    select.begin()
    mesh.drawPick(cameraParams)
    select.end()
  }
}
render()
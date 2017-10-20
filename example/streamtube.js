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
var sample = function(array, x, y, z) {
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

var startingPositions = [];
for (var y = 0; y < 35; y+=3) {
  for (var x = 0; x < 1; x++) {
    for (var z = 0; z < 15; z+=3) {
      startingPositions.push(vec3.set(vec3.create(), x, y, z));
    }
  }
}

var streams = createStreamTubes({
  startingPositions,
  maxLength: 3000,
  widthScale: 20000,
  getVelocity: function(p) {
    var [x, y, z] = p;
    var v = vec3.create();
    var u = sample(wind.vectors, x, y, z);
    vec3.multiply(v, u, scale);
    return v;
  }
}, indexBounds);

bounds = indexBounds;

streams.colormap = 'jet';

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
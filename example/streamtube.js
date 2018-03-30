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
var vec3 = require('gl-vec3');

var canvas = document.createElement('canvas')
document.body.appendChild(canvas)
window.addEventListener('resize', require('canvas-fit')(canvas))
var gl = canvas.getContext('webgl')

var windBounds = getBounds(wind.positions);

var indexBounds = [
  new Float32Array([0,0,0]),
  new Float32Array([40, 34, 14])
];

var meshgrid = [[], [], []];
for (var x=0; x<40; x++) meshgrid[0].push(x);
for (var y=0; y<34; y++) meshgrid[1].push(y);
for (var z=0; z<14; z++) meshgrid[2].push(z);

var startingPositions = [];
for (var y = 0; y < 35; y+=3) {
  for (var x = 0; x < 1; x++) {
    for (var z = 0; z < 15; z+=3) {
      startingPositions.push(vec3.set(vec3.create(), x, y, z));
    }
  }
}

var bounds = indexBounds;

var camera = createCamera(canvas, {
  eye:    [0,0,50],
  center: [0.5*(bounds[0][0]+bounds[1][0]),
           0.5*(bounds[0][1]+bounds[1][1]),
           0.5*(bounds[0][2]+bounds[1][2])],
  zoomMax: 500
})

var scale = vec3.subtract(vec3.create(), windBounds[1], windBounds[0]);
vec3.inverse(scale, scale);
vec3.scale(scale, scale, 0.5);

var streams = createStreamTubes({
  startingPositions,
  maxLength: 3000,
  widthScale: 20000,
  vectorScale: scale,
  vectors: wind.vectors,
  meshgrid: meshgrid,
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
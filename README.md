gl-streamtube3d
=====================
Visualization module for vector fields.

# Example

```javascript
var createScene    = require('gl-plot3d')
var createMesh     = require('gl-mesh3d')
var createStreamTube = require('gl-streamtube3d')
var wind           = require('dataset-wind')

var scene = createScene()

var bounds = [];

var streamTube = createStreamTube({
    startingPositions: positionsArray,
    maxLength: 1000,
    widthScale: 10000,
    getVelocity: velocityFunction
}, bounds)

var mesh = createMesh(gl, streamTube)

scene.add(mesh)
```

[Try out the example in your browser](http://kig.github.io/gl-streamtube3d/)

# Install

```
npm i gl-streamtube3d
```
    
# Basic interface

## Constructor

#### `var streamTube = require('gl-streamtube3d')(params, bounds)`
Creates a stream tube plot of a vector field.

* `params` is an object that has the following properties:

    + `startingPositions` *(Required)* An array of starting positions for the vector field, encoded as arrays.
    + `maxLength` *(Optional)* The maximum number of segments to add to a streamtube. Default is 1000.
    + `widthSCale` *(Optional)* The divergence multiplier to get the width of the streamtube. Default is 10000.
    + `getVelocity(point)` *(Required)* A getter function to get the velocity at a given point.
    + `getDivergence(point)` *(Optional)* A getter function to get the divergence at a given point. Used for the width of the streamtube. Defaults to the divergence of the getVelocity function.

**Returns** A streamtube plot object that can be passed to gl-mesh3d.

# Credits
(c) 2013-2017 Mikola Lysenko, Ilmari Heikkinen. MIT License

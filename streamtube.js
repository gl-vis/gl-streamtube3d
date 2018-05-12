"use strict";

const vec3 = require('gl-vec3');
const vec4 = require('gl-vec4');

const streamToTube = function(stream) {
	const { points, velocities, divergences } = stream;
	//if (points.length < 10) return {};
	// debugger;
	var p, fwd, r, u, v, up;
	up = vec3.set(vec3.create(), 0, 1, 0);
	u = vec3.create();
	v = vec3.create();
	var p2 = vec3.create();

	var verts = [];
	var faces = [];
	var vectors = [];
	var previousVerts = [];
	var currentVerts = [];
	var intensities = [];
	var previousIntensity = 0;
	var currentIntensity = 0;
	var currentVector = vec3.create();
	var previousVector = vec3.create();

	var facets = 8;

	for (var i = 0; i < points.length; i++) {
		p = points[i];
		fwd = velocities[i];
		r = divergences[i];
		currentIntensity = vec3.length(fwd);
		currentVector = vec3.create();
		vec3.normalize(currentVector, fwd);
		vec3.scale(currentVector, currentVector, r);

		for (var a = 0; a < facets; a++) {
			currentVerts[a] = [p[0], p[1], p[2], a];
		}
		if (previousVerts.length > 0) {
			for (var a = 0; a < facets; a++) {
				var a1 = (a+1) % facets;
				verts.push(
					previousVerts[a],
					currentVerts[a],
					currentVerts[a1],

					currentVerts[a1],
					previousVerts[a1],
					previousVerts[a]
				);
				vectors.push(
					previousVector,
					currentVector,
					currentVector,

					currentVector,
					previousVector,
					previousVector
				);
				intensities.push(
					previousIntensity,
					currentIntensity,
					currentIntensity,

					currentIntensity,
					previousIntensity,
					previousIntensity
				);
				faces.push(
					[verts.length-6, verts.length-5, verts.length-4],
					[verts.length-3, verts.length-2, verts.length-1]
				);
			}
		}
		var tmp = previousVerts;
		previousVerts = currentVerts;
		currentVerts = tmp;
		tmp = previousVector;
		previousVector = currentVector;
		currentVector = tmp;
		tmp = previousIntensity;
		previousIntensity = currentIntensity;
		currentIntensity = tmp;
	}
	return {
		positions: verts,
		cells: faces,
		vectors: vectors,
		vertexIntensity: intensities
	};

};

const createTubes = function(streams, colormap) {
	var tubes = streams.map(streamToTube);
	var positions = [];
	var cells = [];
	var vectors = [];
	var vertexIntensity = [];
	for (var i=0; i < tubes.length; i++) {
		var tube = tubes[i];
		var offset = positions.length;
		positions = positions.concat(tube.positions);
		vectors = vectors.concat(tube.vectors);
		vertexIntensity = vertexIntensity.concat(tube.vertexIntensity);
		cells = cells.concat(tube.cells.map(cell => cell.map(c => c + offset)));
	}
	return {
		positions: positions,
		cells: cells,
		vectors: vectors,
		vertexIntensity: vertexIntensity,
		colormap
	};
};

const defaultGetDivergence = function(p, v0, scale) {
	var dp = vec3.create();
	var e = 1/10000;

	vec3.add(dp, p, [e, 0, 0]);
	var vx = this.getVelocity(dp);
	vec3.subtract(vx, vx, v0);

	vec3.add(dp, p, [0, e, 0]);
	var vy = this.getVelocity(dp);
	vec3.subtract(vy, vy, v0);

	vec3.add(dp, p, [0, 0, e]);
	var vz = this.getVelocity(dp);
	vec3.subtract(vz, vz, v0);

	vec3.add(dp, vx, vy);
	vec3.add(dp, dp, vz);
	return vec3.length(dp) * scale;
};

const defaultGetVelocity = function(p) {
    var u = sampleMeshgrid(p, this.vectors, this.meshgrid, this.clampBorders);
    return u;
};


const findLastSmallerIndex = function(points, v) {
  for (var i=0; i<points.length; i++) {
  	var p = points[i];
  	if (p === v) return i;
    if (p > v) return i-1;
  }
  return i;
};

const tmp = vec3.create();
const tmp2 = vec3.create();

const clamp = function(v, min, max) {
	return v < min ? min : (v > max ? max : v);
};

const sampleMeshgrid = function(point, array, meshgrid, clampOverflow) {
	const x = point[0];
	const y = point[1];
	const z = point[2];

	var w = meshgrid[0].length;
	var h = meshgrid[1].length;
	var d = meshgrid[2].length;

	// Find the index of the nearest smaller value in the meshgrid for each coordinate of (x,y,z).
	// The nearest smaller value index for x is the index x0 such that
	// meshgrid[0][x0] < x and for all x1 > x0, meshgrid[0][x1] >= x.
	var x0 = findLastSmallerIndex(meshgrid[0], x);
	var y0 = findLastSmallerIndex(meshgrid[1], y);
	var z0 = findLastSmallerIndex(meshgrid[2], z);

	// Get the nearest larger meshgrid value indices.
	// From the above "nearest smaller value", we know that
	//   meshgrid[0][x0] < x
	//   meshgrid[0][x0+1] >= x
	var x1 = x0 + 1;
	var y1 = y0 + 1;
	var z1 = z0 + 1;

	if (meshgrid[0][x0] === x) x1 = x0;
	if (meshgrid[1][y0] === y) y1 = y0;
	if (meshgrid[2][z0] === z) z1 = z0;

	if (clampOverflow) {
		x0 = clamp(x0, 0, w-1);
		x1 = clamp(x1, 0, w-1);
		y0 = clamp(y0, 0, h-1);
		y1 = clamp(y1, 0, h-1);
		z0 = clamp(z0, 0, d-1);
		z1 = clamp(z1, 0, d-1);
	}

	// Reject points outside the meshgrid, return a zero vector.
	if (x0 < 0 || y0 < 0 || z0 < 0 || x1 >= w || y1 >= h || z1 >= d) {
		return vec3.create();
	}

	// Normalize point coordinates to 0..1 scaling factor between x0 and x1.
	var xf = (x - meshgrid[0][x0]) / (meshgrid[0][x1] - meshgrid[0][x0]);
	var yf = (y - meshgrid[1][y0]) / (meshgrid[1][y1] - meshgrid[1][y0]);
	var zf = (z - meshgrid[2][z0]) / (meshgrid[2][z1] - meshgrid[2][z0]);

	if (xf < 0 || xf > 1 || isNaN(xf)) xf = 0;
	if (yf < 0 || yf > 1 || isNaN(yf)) yf = 0;
	if (zf < 0 || zf > 1 || isNaN(zf)) zf = 0;

	var z0off = z0*w*h;
	var z1off = z1*w*h;

	var y0off = y0*w;
	var y1off = y1*w;

	var x0off = x0;
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

window.testSampleMeshGrid = function() {

	// Generate random meshgrid
	var meshgrid = [];
	for (var i=0; i<3; i++) {
		var a = [];
		var alen = Math.floor(Math.random() * 30 + 1);
		var c = Math.random() * 100 - 50;
		for (var j=0; j<alen; j++) {
			a.push(c);
			c += Math.random()*10 + 0.1;
		}
		meshgrid.push(a);
	}
	var dims = meshgrid.map(m => m.length);

	// Generate random data for the meshgrid
	var data = [];
	for (var z=0; z<meshgrid[2].length; z++) {
		for (var y=0; y<meshgrid[1].length; y++) {
			for (var x=0; x<meshgrid[0].length; x++) {
				data.push([
					Math.random() > 0.2 ? Math.random() * 10 - 5 : 0,
					Math.random() > 0.2 ? Math.random() * 10 - 5 : 0,
					Math.random() > 0.2 ? Math.random() * 10 - 5 : 0
				]);
			}
		}
	}

	// Point to point equivalence
	for (var z=0; z<meshgrid[2].length; z++) {
		for (var y=0; y<meshgrid[1].length; y++) {
			for (var x=0; x<meshgrid[0].length; x++) {
				var point = [meshgrid[0][x], meshgrid[1][y], meshgrid[2][z]];
				var sampled = sampleMeshgrid(point, data, meshgrid, true);
				var dataValue = data[
					z * meshgrid[1].length * meshgrid[0].length +
					y * meshgrid[0].length +
					x
				];
				if (vec3.squaredDistance(sampled, dataValue) > 0.0001) {
					console.log('index', [x,y,z], 'dims', dims, 'sampled', sampled, 'data', dataValue, 'point coords', point, 'meshgrid', meshgrid, 'data', data, "clampOverflow")
					throw new Error("sampleMeshgrid sampling disagrees with raw data sample")
				}
				sampled = sampleMeshgrid([meshgrid[0][x], meshgrid[1][y], meshgrid[2][z]], data, meshgrid, false);
				if (vec3.squaredDistance(sampled, dataValue) > 0.0001) {
					console.log('index', [x,y,z], 'dims', dims, 'sampled', sampled, 'data', dataValue, 'point coords', point, 'meshgrid', meshgrid, 'data', data, "no clampOverflow")
					throw new Error("sampleMeshgrid sampling disagrees with raw data sample")
				}
			}
		}
	}

	// Gradient property
	for (var z=0; z<meshgrid[2].length-1; z++) {
		for (var y=0; y<meshgrid[1].length-1; y++) {
			for (var x=0; x<meshgrid[0].length-1; x++) {
				var point = [meshgrid[0][x], meshgrid[1][y], meshgrid[2][z]];
				var point2 = [meshgrid[0][x+1], meshgrid[1][y+1], meshgrid[2][z+1]];
				var p1 = vec3.lerp(point, point2, 0.25);
				var p2 = vec3.lerp(point, point2, 0.75);
				var s0 = sampleMeshgrid(point, data, meshgrid, true);
				var s1 = sampleMeshgrid(p1, data, meshgrid, true);
				var s2 = sampleMeshgrid(p2, data, meshgrid, true);
				var s3 = sampleMeshgrid(point2, data, meshgrid, true);
				if (vec3.squaredDistance(s0, s1) > vec3.squaredDistance(s0, s2) ||
					vec3.squaredDistance(s2, s3) > vec3.squaredDistance(s1, s3)
				) {
					console.log('index', [x,y,z], 'dims', dims, s0, s1, s2, s3, 'point coords', point, 'meshgrid', meshgrid, 'data', data, "clampOverflow")
					throw new Error("sampleMeshgrid sampling gradient is reversed")
				}
			}
		}
	}

	// Gradient property, no border clamping
	for (var z=0; z<meshgrid[2].length-1; z++) {
		for (var y=0; y<meshgrid[1].length-1; y++) {
			for (var x=0; x<meshgrid[0].length-1; x++) {
				var point = [meshgrid[0][x], meshgrid[1][y], meshgrid[2][z]];
				var point2 = [meshgrid[0][x+1], meshgrid[1][y+1], meshgrid[2][z+1]];
				var p1 = vec3.lerp(point, point2, 0.25);
				var p2 = vec3.lerp(point, point2, 0.75);
				var s0 = sampleMeshgrid(point, data, meshgrid, false);
				var s1 = sampleMeshgrid(p1, data, meshgrid, false);
				var s2 = sampleMeshgrid(p2, data, meshgrid, false);
				var s3 = sampleMeshgrid(point2, data, meshgrid, false);
				if (vec3.squaredDistance(s0, s1) > vec3.squaredDistance(s0, s2) ||
					vec3.squaredDistance(s2, s3) > vec3.squaredDistance(s1, s3)
				) {
					console.log('index', [x,y,z], 'dims', dims, s0, s1, s2, s3, 'point coords', point, 'meshgrid', meshgrid, 'data', data, "no clampOverflow")
					throw new Error("sampleMeshgrid sampling gradient is reversed")
				}
			}
		}
	}
};


module.exports = function(vectorField, bounds) {
	var positions = vectorField.startingPositions;
	var maxLength = vectorField.maxLength || 1000;
	var widthScale = vectorField.widthScale || 1e4;

	if (!vectorField.getDivergence) {
		vectorField.getDivergence = defaultGetDivergence;
	}

	if (!vectorField.getVelocity) {
		vectorField.getVelocity = defaultGetVelocity;
	}

	if (vectorField.clampBorders === undefined) {
		vectorField.clampBorders = true;
	}

	var streams = [];

	const [minX, minY, minZ] = bounds[0];
	const [maxX, maxY, maxZ] = bounds[1];

	var inBounds = function(bounds, p) {
		var [x,y,z] = p;
		return (
			x >= minX && x <= maxX &&
			y >= minY && y <= maxY &&
			z >= minZ && z <= maxZ
		);
	};

	var boundsSize = vec3.distance(bounds[0], bounds[1]);
	var maxStepSize = 10 * boundsSize / maxLength;
	var maxStepSizeSq = maxStepSize * maxStepSize;

	for (var i = 0; i < positions.length; i++) {
		var p = vec3.create();
		vec3.copy(p, positions[i]);

		var stream = [p];
		var velocities = [];
		var v = vectorField.getVelocity(p);
		var op = p;
		velocities.push(v);
		var divergences = [vectorField.getDivergence(p, v, widthScale)];

		streams.push({points: stream, velocities: velocities, divergences: divergences});

		while (stream.length < maxLength && inBounds(bounds, p)) {
			var np = vec3.clone(v);
			var sqLen = vec3.squaredLength(np);
			if (sqLen === 0) {
				break;
			} else if (sqLen > maxStepSizeSq) {
				vec3.scale(np, np, maxStepSize / Math.sqrt(sqLen));
			}
			vec3.add(np, np, p);

			v = vectorField.getVelocity(np);

			if (vec3.squaredDistance(op, np) - maxStepSizeSq > -0.0001 * maxStepSizeSq) {
				stream.push(np);
				op = np;
				velocities.push(v);
				var dv = vectorField.getDivergence(np, v, widthScale);
				divergences.push(dv);
			}

			p = np;
		}
	}

	return createTubes(streams, vectorField.colormap);
};

module.exports.createTubeMesh = require('./lib/tubemesh');
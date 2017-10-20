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
	var previousVerts = [];
	var currentVerts = [];
	var intensities = [];
	var previousIntensity = 0;
	var currentIntensity = 0;

	var facets = 8;

	for (var i = 0; i < points.length; i++) {
		p = points[i];
		fwd = velocities[i];
		r = divergences[i];
		currentIntensity = vec3.length(fwd);
		vec3.cross(u, up, fwd);
		vec3.normalize(u, u);
		vec3.cross(v, u, fwd);
		vec3.normalize(v, v);
		for (var a = 0; a < facets; a++) {
			var a0 = a/facets * Math.PI * 2;

			var p0 = vec3.create();
			vec3.add(p0, p0, u);
			vec3.scale(p0, p0, Math.cos(a0) * r);

			var p1 = vec3.create();
			vec3.add(p1, p1, v);
			vec3.scale(p1, p1, Math.sin(a0) * r);

			vec3.add(p0, p0, p1);
			vec3.add(p0, p0, p);

			currentVerts[a] = p0;
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
		tmp = previousIntensity;
		previousIntensity = currentIntensity;
		currentIntensity = tmp;
	}
	return {
		positions: verts,
		cells: faces,
		vertexIntensity: intensities
	};

};

const createTubes = function(streams) {
	var tubes = streams.map(streamToTube);
	var positions = [];
	var cells = [];
	var vertexIntensity = [];
	for (var i=0; i < tubes.length; i++) {
		var tube = tubes[i];
		var offset = positions.length;
		positions = positions.concat(tube.positions);
		vertexIntensity = vertexIntensity.concat(tube.vertexIntensity);
		cells = cells.concat(tube.cells.map(cell => cell.map(c => c + offset)));
	}
	return {
		positions: positions,
		cells: cells,
		vertexIntensity: vertexIntensity
	};
};

var defaultGetDivergence = function(p, v0, scale) {
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

module.exports = function(vectorField, bounds) {
	var positions = vectorField.startingPositions;	
	var maxLength = vectorField.maxLength || 1000;
	var widthScale = vectorField.widthScale || 1e4;

	if (!vectorField.getDivergence) {
		vectorField.getDivergence = defaultGetDivergence;
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

	for (var i = 0; i < positions.length; i++) {
		var p = vec3.create();
		vec3.copy(p, positions[i]);
		
		var stream = [p];
		var velocities = [];
		var v = vectorField.getVelocity(p);
		velocities.push(v);
		var divergences = [vectorField.getDivergence(p, v)];
		
		streams.push({points: stream, velocities: velocities, divergences: divergences});

		while (stream.length < maxLength && inBounds(bounds, p)) {
			var np = vec3.create();
			vec3.add(np, velocities[velocities.length-1], p);

			stream.push(np);
			var v = vectorField.getVelocity(np);
			velocities.push(v);
			divergences.push(vectorField.getDivergence(np, v, widthScale));

			p = np;
		}
	}

	return createTubes(streams);
};
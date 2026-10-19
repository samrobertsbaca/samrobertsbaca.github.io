// builds the land dots for the world of scorsby: dots on a geodesic (hexagonal) grid over the sphere that fall on land,
// each with a height level (0 lowland .. 5 high mountains) for shading. each finer grid holds every dot of the coarser one.
// run from a folder with: npm i world-atlas@2 topojson-client@3 pngjs@7 d3-geo@3
// and an elevation image saved as elevation.png (NASA, public domain, via Wikimedia Commons:
// https://commons.wikimedia.org/wiki/File:Earth_dry_elevation.png)
//   node build_land.mjs <repo>/heartstar/land.js        51 110m LAND
//   node build_land.mjs <repo>/heartstar/land_fine.bin  102  50m
//   node build_land.mjs <repo>/heartstar/land_ultra.bin 204  10m
// a .bin is quicker to load: every dot's latitude and longitude as 16-bit whole numbers (degrees x 180), then a byte per dot for its height
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { PNG } from 'pngjs';

const require = createRequire(import.meta.url);
const [, , outFile, freq = '51', res = '110m', name = 'LAND', elevFile = 'elevation.png'] = process.argv;
const topo = JSON.parse(readFileSync(require.resolve(`world-atlas/land-${res}.json`), 'utf8'));
const land = feature(topo, topo.objects.land);

// project the coastlines flat (d3 cuts them cleanly at the date line), then fill a grid with even-odd scanlines
const W = 7200, H = 3600, grid = new Uint8Array(W * H);
const rings = []; let ring = null;
geoPath(geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]).precision(0.05), {
  moveTo(x, y) { ring = [[x, y]]; rings.push(ring); },
  lineTo(x, y) { ring.push([x, y]); },
  closePath() { if (ring) ring.push(ring[0]); },
  arc() {}, beginPath() {}, rect() {},
})(land);
const rows = Array.from({ length: H }, () => []);
for (const rg of rings) for (let i = 0; i < rg.length - 1; i++) {
  const [x1, y1] = rg[i], [x2, y2] = rg[i + 1];
  if (y1 === y2) continue;
  for (let r = Math.max(0, Math.ceil(Math.min(y1, y2) - 0.5)); r <= Math.min(H - 1, Math.floor(Math.max(y1, y2) - 0.5)); r++) {
    const yc = r + 0.5;
    if ((y1 > yc) === (y2 > yc)) continue;
    rows[r].push(x1 + (yc - y1) / (y2 - y1) * (x2 - x1));
  }
}
let odd = 0;
for (let r = 0; r < H; r++) {
  const xs = rows[r].sort((a, b) => a - b);
  if (xs.length % 2) { odd++; continue; } // a row that doesn't close properly is left empty rather than filled wrong
  for (let k = 0; k + 1 < xs.length; k += 2) grid.fill(1, r * W + Math.max(0, Math.round(xs[k])), r * W + Math.min(W, Math.round(xs[k + 1])));
}
// some maps wind their outlines the other way round, which d3 reads as everything but the land: flip those back
let filled = 0; for (let i = 0; i < grid.length; i++) filled += grid[i];
if (filled > grid.length / 2) for (let i = 0; i < grid.length; i++) grid[i] ^= 1;
const onLand = (lat, lon) => grid[Math.min(H - 1, Math.floor((90 - lat) / 180 * H)) * W + Math.min(W - 1, Math.floor((lon + 180) / 360 * W))];

// height from the elevation image: about 145 is sea level, about 230 the highest peaks
const elev = PNG.sync.read(readFileSync(elevFile));
const gray = (lat, lon) => {
  const x = Math.min(elev.width - 1, Math.floor((lon + 180) / 360 * elev.width)), y = Math.min(elev.height - 1, Math.floor((90 - lat) / 180 * elev.height));
  return elev.data[(y * elev.width + x) * 4];
};
const level = (lat, lon) => Math.min(5, Math.floor(Math.pow(Math.max(0, Math.min(1, (gray(lat, lon) - 145) / 85)), 0.6) * 6));

// the geodesic grid: each face of an icosahedron divided into little triangles, bent onto the sphere along great circles
const f = +freq, phi = (1 + Math.sqrt(5)) / 2;
const V = [[-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0], [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi], [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]]
  .map((v) => { const l = Math.hypot(...v); return v.map((c) => c / l); });
const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
const slerp = (a, b, t) => {
  const d = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
  if (d < 1e-9) return a;
  const s = Math.sin(d), p = Math.sin((1 - t) * d) / s, q = Math.sin(t * d) / s;
  return [a[0] * p + b[0] * q, a[1] * p + b[1] * q, a[2] * p + b[2] * q];
};
const seen = new Set(), out = [], hs = [];
for (const [ia, ib, ic] of F) {
  const A = V[ia], B = V[ib], C = V[ic];
  for (let i = 0; i <= f; i++) {
    const P = slerp(A, B, i / f), Q = slerp(A, C, i / f);
    for (let j = 0; j <= i; j++) {
      const v = i ? slerp(P, Q, j / i) : A;
      const lat = Math.asin(v[2]) * 180 / Math.PI, lon = Math.atan2(v[1], v[0]) * 180 / Math.PI;
      const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (lat < -60) continue; // antarctica reads as noise at this scale
      if (onLand(lat, lon)) { out.push(+lat.toFixed(3), +lon.toFixed(3)); hs.push(level(lat, lon)); }
    }
  }
}
if (outFile.endsWith('.bin')) {
  const n = hs.length, buf = Buffer.alloc(n * 5);
  for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.round(out[i * 2] * 180), i * 4); buf.writeInt16LE(Math.round(out[i * 2 + 1] * 180), i * 4 + 2); buf[n * 4 + i] = hs[i]; }
  writeFileSync(outFile, buf);
} else writeFileSync(outFile, `// land dots for the world of scorsby (geodesic grid of ${seen.size} on the sphere, ${res} map). [lat, lon, ...] and a height level per dot\nwindow.${name}=[${out.join(',')}];\nwindow.${name}_H='${hs.join('')}';\n`);
console.log(name, seen.size, 'on the sphere,', out.length / 2, 'on land,', odd, 'unclosed rows');

// builds the land dots for the world of scorsby: evenly spaced dots on the sphere that fall on land,
// each with a height level (0 lowland .. 5 high mountains) for shading.
// run from a folder with: npm i world-atlas@2 topojson-client@3 pngjs@7
// and an elevation image saved as elevation.png (NASA, public domain, via Wikimedia Commons:
// https://commons.wikimedia.org/wiki/File:Earth_dry_elevation.png)
//   node build_land.mjs <repo>/heartstar/land.js        26000 110m LAND
//   node build_land.mjs <repo>/heartstar/land_fine.js  104000  50m LAND_FINE
//   node build_land.mjs <repo>/heartstar/land_ultra.js 416000  10m LAND_ULTRA
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import { PNG } from 'pngjs';

const require = createRequire(import.meta.url);
const [, , outFile, count = '26000', res = '110m', name = 'LAND', elevFile = 'elevation.png'] = process.argv;
const topo = JSON.parse(readFileSync(require.resolve(`world-atlas/land-${res}.json`), 'utf8'));
const land = feature(topo, topo.objects.land);

// draw the coastlines onto a grid once (even-odd scanlines), so each dot is a single lookup
const W = 7200, H = 3600, grid = new Uint8Array(W * H);
const rows = Array.from({ length: H }, () => []);
const geoms = land.features ? land.features.map((f) => f.geometry) : [land.geometry];
const polys = geoms.flatMap((g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates));
for (const poly of polys) for (const ring of poly) {
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
    if (Math.abs(x2 - x1) > 180) continue; // a jump across the date line, not a real edge
    const r1 = (90 - Math.max(y1, y2)) / 180 * H - 0.5, r2 = (90 - Math.min(y1, y2)) / 180 * H - 0.5;
    for (let r = Math.max(0, Math.ceil(r1)); r <= Math.min(H - 1, Math.floor(r2)); r++) {
      const lat = 90 - (r + 0.5) * 180 / H;
      if ((y1 > lat) === (y2 > lat)) continue;
      rows[r].push(x1 + (lat - y1) / (y2 - y1) * (x2 - x1));
    }
  }
}
for (let r = 0; r < H; r++) {
  const xs = rows[r].sort((a, b) => a - b);
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const c1 = Math.max(0, Math.round((xs[k] + 180) / 360 * W)), c2 = Math.min(W - 1, Math.round((xs[k + 1] + 180) / 360 * W));
    grid.fill(1, r * W + c1, r * W + c2 + 1);
  }
}
const onLand = (lat, lon) => grid[Math.min(H - 1, Math.floor((90 - lat) / 180 * H)) * W + Math.min(W - 1, Math.floor((lon + 180) / 360 * W))];

// height from the elevation image: about 145 is sea level, about 230 the highest peaks
const elev = PNG.sync.read(readFileSync(elevFile));
const gray = (lat, lon) => {
  const x = Math.min(elev.width - 1, Math.floor((lon + 180) / 360 * elev.width)), y = Math.min(elev.height - 1, Math.floor((90 - lat) / 180 * elev.height));
  return elev.data[(y * elev.width + x) * 4];
};
const level = (lat, lon) => Math.min(5, Math.floor(Math.pow(Math.max(0, Math.min(1, (gray(lat, lon) - 145) / 85)), 0.6) * 6));

const N = +count, out = [], hs = [];
const golden = Math.PI * (3 - Math.sqrt(5));
for (let i = 0; i < N; i++) {
  const y = 1 - (i / (N - 1)) * 2;
  const lat = Math.asin(y) * 180 / Math.PI;
  let lon = ((i * golden) * 180 / Math.PI) % 360;
  if (lon > 180) lon -= 360;
  if (lat < -60) continue; // antarctica reads as noise at this scale
  if (onLand(lat, lon)) { out.push(+lat.toFixed(2), +lon.toFixed(2)); hs.push(level(lat, lon)); }
}
writeFileSync(outFile, `// land dots for the world of scorsby (${N} on the sphere, ${res} map). [lat, lon, ...] and a height level per dot\nwindow.${name}=[${out.join(',')}];\nwindow.${name}_H='${hs.join('')}';\n`);
console.log(name, out.length / 2, 'dots');

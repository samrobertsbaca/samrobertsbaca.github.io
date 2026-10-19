// builds heartstar/land.js: evenly spaced dots on the sphere that fall on land.
// run from a folder with: npm i world-atlas@2 topojson-client@3 d3-geo@3
//   node build_land.mjs <path-to-repo>/heartstar/land.js
// the finer set, for zooming in (four times the dots, from the more detailed map):
//   node build_land.mjs <path-to-repo>/heartstar/land_fine.js 104000 50m LAND_FINE
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import { geoContains } from 'd3-geo';

const require = createRequire(import.meta.url);
const [, , outFile, count = '26000', res = '110m', name = 'LAND'] = process.argv;
const topo = JSON.parse(readFileSync(require.resolve(`world-atlas/land-${res}.json`), 'utf8'));
const land = feature(topo, topo.objects.land);

const N = +count, out = [];
const golden = Math.PI * (3 - Math.sqrt(5));
for (let i = 0; i < N; i++) {
  const y = 1 - (i / (N - 1)) * 2;
  const lat = Math.asin(y) * 180 / Math.PI;
  let lon = ((i * golden) * 180 / Math.PI) % 360;
  if (lon > 180) lon -= 360;
  if (lat < -60) continue; // antarctica reads as noise at this scale
  if (geoContains(land, [lon, lat])) out.push(+lat.toFixed(2), +lon.toFixed(2));
}
writeFileSync(process.argv[2], `// land dots for heartstar prime. [lat, lon, lat, lon, ...]\nwindow.LAND=[${out.join(',')}];\n`);
console.log(out.length / 2, 'dots');

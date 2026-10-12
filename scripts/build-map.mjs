// Builds a scenario map: Natural Earth admin-1 provinces are overlaid with a
// historical basemap from aourednik/historical-basemaps, then corrected by the
// scenario's tables (scripts/scenarios/<id>.mjs).
// Usage: node scripts/build-map.mjs 1911   ->  public/data/map1911.json
//
// Raw inputs (not committed, ~45 MB) are downloaded into data/raw on first run.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as turf from "@turf/turf";
import { topology } from "topojson-server";
import { presimplify, simplify } from "topojson-simplify";
import { quantize } from "topojson-client";
import { geoMiller } from "d3-geo-projection";
import { geoArea, geoPath } from "d3-geo";
import { GROUP_BY_REGION, SMALL_COUNTRY_KM2, REGION_RU, COUNTRY_RU } from "./map-common.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RAW = path.join(ROOT, "data/raw");
const SCENARIO_ID = process.argv[2] || "1911";
const scenario = (await import(`./scenarios/${SCENARIO_ID}.mjs`)).default;
const { OWNER_BY_NAME, ADM0_OWNER, ADM1_OWNER, CUSTOM_GROUPS, CITIES } = scenario;
const OUT = path.join(ROOT, `public/data/map${SCENARIO_ID}.json`);

const SOURCES = {
  [`${scenario.basemap}.geojson`]: `https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson/${scenario.basemap}.geojson`,
  "ne_admin1.geojson":
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson",
  "ne_lakes.geojson":
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_lakes.geojson",
};

function load(name) {
  const file = path.join(RAW, name);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(RAW, { recursive: true });
    console.log("downloading", SOURCES[name]);
    execFileSync("curl", ["-sSL", "-o", file, SOURCES[name]], { stdio: "inherit" });
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// ---------------------------------------------------------------------------
const admin1 = load("ne_admin1.geojson");
const world = load(`${scenario.basemap}.geojson`);
const lakesRaw = load("ne_lakes.geojson");

const area = (f) => turf.area(f) / 1e6;
const safe = (fn, fallback = null) => {
  try { return fn(); } catch { return fallback; }
};
function unionAll(features) {
  if (features.length === 1) return features[0];
  const u = safe(() => turf.union(turf.featureCollection(features)));
  if (u) return u;
  // Fallback: concatenate polygons into one MultiPolygon.
  const coords = [];
  for (const f of features) {
    if (f.geometry.type === "Polygon") coords.push(f.geometry.coordinates);
    else coords.push(...f.geometry.coordinates);
  }
  return turf.multiPolygon(coords);
}

// 1. Clean admin-1 features.
const feats = admin1.features.filter((f) => {
  const p = f.properties;
  if (["ATA", "ATF", "HMD", "SGS", "PGA", "ATC", "CSI", "IOA", "UMI"].includes(p.adm0_a3)) return false;
  const bb = turf.bbox(f);
  return bb[3] > -58;
});

// 2. Group provinces.
const byAdm0 = new Map();
for (const f of feats) {
  const a = f.properties.adm0_a3;
  if (!byAdm0.has(a)) byAdm0.set(a, []);
  byAdm0.get(a).push(f);
}

const groups = []; // { key, adm0, name, features }
for (const [adm0, list] of byAdm0) {
  const total = list.reduce((s, f) => s + (f.properties.area_sqkm || area(f)), 0);
  if (CUSTOM_GROUPS[adm0]) {
    const rest = new Set(list);
    for (const g of CUSTOM_GROUPS[adm0]) {
      const members = g.members === "*" ? [...rest] : list.filter((f) => g.members.includes(f.properties.name));
      members.forEach((m) => rest.delete(m));
      if (members.length) groups.push({ adm0, name: g.name, features: members });
    }
  } else if (GROUP_BY_REGION.has(adm0)) {
    const m = new Map();
    for (const f of list) {
      const k = f.properties.region || f.properties.name;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(f);
    }
    for (const [k, fs] of m) groups.push({ adm0, name: REGION_RU[k] || k, features: fs });
  } else if (total < SMALL_COUNTRY_KM2 && list.length > 1) {
    groups.push({ adm0, name: COUNTRY_RU[adm0] || list[0].properties.admin, features: list });
  } else {
    for (const f of list) {
      const p = f.properties;
      const name = list.length === 1 && COUNTRY_RU[adm0] ? COUNTRY_RU[adm0] : p.name_ru || p.name || p.admin;
      groups.push({ adm0, name: name.replace(/\s+—\s+/g, "-"), features: [f], adm1: p.name });
    }
  }
}
console.log("province groups:", groups.length);

// 3. Overlay with the historical polygons.
const histo = world.features
  .filter((f) => f.geometry)
  .map((f) => ({ f, owner: OWNER_BY_NAME[f.properties.NAME] || null, bbox: turf.bbox(f) }));
const unknown = new Set(world.features.map((f) => f.properties.NAME).filter((n) => n && !OWNER_BY_NAME[n]));
if (unknown.size) console.warn("unmapped basemap names:", [...unknown]);

const UNKNOWN = "__unknown";
const ownerOrNull = (o) => (!o || o === UNKNOWN ? null : o);
const bboxHit = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

// The overlay takes a few minutes; its result is cached in data/raw (delete to rebuild).
const CACHE = path.join(RAW, `pieces-cache-${SCENARIO_ID}.json`);
let pieces = []; // { adm0, name, owner, feature, area }
if (fs.existsSync(CACHE)) pieces = JSON.parse(fs.readFileSync(CACHE, "utf8"));
let n = 0;
for (const g of pieces.length ? [] : groups) {
  n++;
  if (n % 500 === 0) console.log(`  overlay ${n}/${groups.length}`);
  const geom = unionAll(g.features);
  const bb = turf.bbox(geom);
  const total = area(geom);
  const fixedOwner = (g.adm1 && ADM1_OWNER[g.adm0]?.[g.adm1]) || ADM0_OWNER[g.adm0] || null;
  if (fixedOwner) {
    pieces.push({ adm0: g.adm0, name: g.name, owner: fixedOwner, feature: geom, area: total });
    continue;
  }
  const shares = new Map();
  const parts = new Map();
  for (const h of histo) {
    if (!h.owner || !bboxHit(bb, h.bbox)) continue;
    const inter = safe(() => turf.intersect(turf.featureCollection([geom, h.f])));
    if (!inter) continue;
    const a = area(inter);
    if (a <= 0) continue;
    shares.set(h.owner, (shares.get(h.owner) || 0) + a);
    if (!parts.has(h.owner)) parts.set(h.owner, []);
    parts.get(h.owner).push(inter);
  }
  // Optionally treat land the basemap does not cover as an "unknown" owner (filled from
  // ADM0_FALLBACK later), so a province is not handed to a neighbour that touches its edge.
  if (scenario.uncoveredAsUnknown) {
    const covered = [...shares.values()].reduce((s, a) => s + a, 0);
    if (total - covered > 0) shares.set(UNKNOWN, total - covered);
  }
  const sorted = [...shares.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length <= 1) {
    pieces.push({ adm0: g.adm0, name: g.name, owner: ownerOrNull(sorted[0]?.[0]), feature: geom, area: total });
    continue;
  }
  const [dominant] = sorted[0];
  const keepSmall = scenario.KEEP_SMALL_OWNERS ?? [];
  const minors = sorted.slice(1).filter(([o, a]) => (a / total >= 0.08 && a >= 1500) || (keepSmall.includes(o) && a >= 300));
  if (!minors.length) {
    pieces.push({ adm0: g.adm0, name: g.name, owner: ownerOrNull(dominant), feature: geom, area: total });
    continue;
  }
  let rest = geom;
  const out = [];
  for (const [owner] of minors) {
    // Uncovered land has no polygon of its own: it stays in the remainder.
    if (owner === UNKNOWN) continue;
    const part = unionAll(parts.get(owner));
    const diff = safe(() => turf.difference(turf.featureCollection([rest, part])));
    if (!diff) continue;
    rest = diff;
    out.push({ owner, feature: part });
  }
  out.unshift({ owner: ownerOrNull(dominant), feature: rest });
  const center = turf.centroid(geom).geometry.coordinates;
  for (const o of out) {
    const c = turf.centroid(o.feature).geometry.coordinates;
    const dx = c[0] - center[0];
    const dy = c[1] - center[1];
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "восток" : "запад") : dy > 0 ? "север" : "юг";
    pieces.push({ adm0: g.adm0, name: `${g.name} (${dir})`, owner: o.owner, feature: o.feature, area: area(o.feature) });
  }
}

fs.writeFileSync(CACHE, JSON.stringify(pieces));

scenario.post(pieces);

// Owners for provinces that did not touch any basemap polygon: majority of the same modern country.
const majority = new Map();
for (const p of pieces) {
  if (!p.owner) continue;
  const m = majority.get(p.adm0) || new Map();
  m.set(p.owner, (m.get(p.owner) || 0) + p.area);
  majority.set(p.adm0, m);
}
const orphans = [];
for (const p of pieces) {
  if (p.owner) continue;
  const m = majority.get(p.adm0);
  if (scenario.ADM0_FALLBACK?.[p.adm0]) p.owner = scenario.ADM0_FALLBACK[p.adm0];
  else if (m) p.owner = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
  else orphans.push(p.adm0 + ":" + p.name);
}
if (orphans.length) console.warn("no owner (left neutral):", orphans.join(", "));

// 4. Project, build topology and simplify.
const projection = geoMiller().rotate([-11, 0]).scale(640).translate([2000, 1300]).precision(0.2);
const pathGen = geoPath(projection);

// d3-geo wants clockwise exterior rings (GeoJSON/turf use counter-clockwise);
// otherwise a polygon is read as "the whole globe except this shape".
const forD3 = (f) => dropInverted(turf.rewind(f, { reverse: true }));

// Overlay cuts can leave degenerate slivers (collinear points) that d3 reads as
// a polygon covering the whole globe; drop such parts.
function dropInverted(f) {
  const parts = [];
  let dropped = false;
  turf.flattenEach(f, (poly) => {
    if (geoArea(poly) > 2 * Math.PI) dropped = true;
    else parts.push(poly.geometry.coordinates);
  });
  if (!dropped) return f;
  return turf.feature({ type: "MultiPolygon", coordinates: parts }, f.properties ?? {});
}

// Use d3's own geoStream through geoPath context to get correctly clipped polygons.
function projectedRings(feature) {
  const rings = [];
  let cur = null;
  const ctx = {
    moveTo(x, y) { cur = [[x, y]]; rings.push(cur); },
    lineTo(x, y) { cur.push([x, y]); },
    closePath() { if (cur && cur.length) cur.push(cur[0]); },
    arc() {}, rect() {},
  };
  geoPath(projection, ctx)(forD3(feature));
  return rings
    .filter((r) => r.length >= 4)
    .map((r) => r.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]));
}

// Rings from a projected path are a flat list; rebuild polygons by nesting holes
// into the outer ring that contains them (planar, so sign of area tells orientation).
function ringArea(r) {
  let s = 0;
  for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  return s / 2;
}
function toMultiPolygon(rings) {
  const outers = [];
  const holes = [];
  for (const r of rings) {
    const a = ringArea(r);
    if (Math.abs(a) < 0.15) continue;
    // d3 outputs exterior rings clockwise in screen space => positive area with y down.
    (a > 0 ? outers : holes).push(r);
  }
  const polys = outers.map((o) => [o]);
  for (const h of holes) {
    const pt = h[0];
    const host = polys.find((p) => pointInRing(pt, p[0]));
    if (host) host.push(h);
  }
  return { type: "MultiPolygon", coordinates: polys };
}
function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Fit the projection to the land actually present (with a small margin).
{
  const b = geoPath(projection).bounds({ type: "FeatureCollection", features: pieces.map((p) => forD3(p.feature)) });
  const [tx, ty] = projection.translate();
  projection.translate([tx - b[0][0] + 20, ty - b[0][1] + 20]);
  globalThis.MAP_W = Math.ceil(b[1][0] - b[0][0] + 40);
  globalThis.MAP_H = Math.ceil(b[1][1] - b[0][1] + 40);
}

const usedIds = new Map();
const geometries = {};
const regions = [];
pieces.sort((a, b) => a.adm0.localeCompare(b.adm0) || b.area - a.area);
for (const p of pieces) {
  const rings = projectedRings(p.feature);
  const mp = toMultiPolygon(rings);
  if (!mp.coordinates.length) continue;
  const k = usedIds.get(p.adm0) || 0;
  usedIds.set(p.adm0, k + 1);
  const id = `${p.adm0}${k + 1}`;
  const centroid = pathGen.centroid(forD3(p.feature));
  const pof = projection(turf.pointOnFeature(p.feature).geometry.coordinates);
  const inside = mp.coordinates.some((poly) => pointInRing(centroid, poly[0]));
  const c = inside && Number.isFinite(centroid[0]) ? centroid : pof;
  geometries[id] = mp;
  regions.push({ id, name: p.name, adm0: p.adm0, owner: p.owner, km2: Math.round(p.area), c: [Math.round(c[0]), Math.round(c[1])] });
}

// Cities: projected position + the province that contains them (nearest one for coastal points).
const inPoly = (pt, mp) => mp.coordinates.some((poly) => pointInRing(pt, poly[0]) && !poly.slice(1).some((h) => pointInRing(pt, h)));
const cities = CITIES.map(([name, lon, lat, capital]) => {
  const [x, y] = projection([lon, lat]);
  let region = regions.find((r) => inPoly([x, y], geometries[r.id]));
  if (!region) {
    region = regions.reduce((best, r) => {
      const d = (r.c[0] - x) ** 2 + (r.c[1] - y) ** 2;
      return !best || d < best.d ? { r, d } : best;
    }, null).r;
  }
  return { n: name, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, r: region.id, ...(capital ? { cap: capital } : {}) };
});

const lakes = lakesRaw.features
  .filter((f) => (f.properties.scalerank ?? 9) <= 3 && area(f) > 3000)
  .map((f) => toMultiPolygon(projectedRings(f)))
  .filter((g) => g.coordinates.length);

let topo = topology(
  {
    regions: { type: "FeatureCollection", features: regions.map((r) => ({ type: "Feature", id: r.id, properties: {}, geometry: geometries[r.id] })) },
    lakes: { type: "FeatureCollection", features: lakes.map((g) => ({ type: "Feature", properties: {}, geometry: g })) },
  },
  null,
);
topo = presimplify(topo, (triangle) => {
  // planar triangle area (coordinates are already projected)
  const [a, b, c] = triangle;
  return Math.abs((a[0] - c[0]) * (b[1] - a[1]) - (a[0] - b[0]) * (c[1] - a[1])) / 2;
});
const minWeight = Number(process.env.MAP_SIMPLIFY || 0.8);
topo = simplify(topo, minWeight);
// Integer, delta-encoded arcs: 0.1 map-unit precision.
topo = quantize(topo, 40000);
delete topo.bbox;

const meta = Object.fromEntries(regions.map((r) => [r.id, { n: r.name, a: r.adm0, o: r.owner, k: r.km2, c: r.c }]));
const out = {
  width: globalThis.MAP_W,
  height: globalThis.MAP_H,
  topology: topo,
  regions: meta,
  cities,
  projection: { type: "miller", rotate: projection.rotate(), scale: projection.scale(), translate: projection.translate() },
  source: scenario.source,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
const stats = {};
for (const r of regions) stats[r.owner] = (stats[r.owner] || 0) + 1;
console.log("regions:", regions.length, "size:", (fs.statSync(OUT).size / 1e6).toFixed(2), "MB");
console.log("by owner:", JSON.stringify(stats));

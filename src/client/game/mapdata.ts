import { feature, neighbors } from "topojson-client";
import { geoPath } from "d3-geo";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";

export interface RegionMeta {
  /** name */
  n: string;
  /** modern country code the province belongs to (Natural Earth adm0) */
  a: string;
  /** owner on 1 January 1911 */
  o: string;
  /** area, km² */
  k: number;
  /** label point in map coordinates */
  c: [number, number];
}

export interface City {
  n: string;
  x: number;
  y: number;
  r: string;
  cap?: string;
}

interface RawMap {
  width: number;
  height: number;
  topology: Topology;
  regions: Record<string, RegionMeta>;
  cities: City[];
  source: string;
}

export interface MapData {
  width: number;
  height: number;
  topology: Topology;
  ids: string[];
  regions: Record<string, RegionMeta>;
  /** SVG path per province (already projected) */
  paths: Record<string, string>;
  /** projected area per province, map units² */
  areas: Record<string, number>;
  neighbors: Record<string, string[]>;
  cities: City[];
  lakesPath: string;
  source: string;
}

export async function loadMap(url = "/data/map1911.json"): Promise<MapData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Не удалось загрузить карту (${res.status})`);
  const raw = (await res.json()) as RawMap;
  const topo = raw.topology;
  const regionsObj = topo.objects.regions as GeometryCollection;
  const fc = feature(topo, regionsObj) as unknown as { features: Feature<Geometry>[] };
  const path = geoPath(null);
  const ids: string[] = [];
  const paths: Record<string, string> = {};
  const areas: Record<string, number> = {};
  for (const f of fc.features) {
    const id = String(f.id);
    ids.push(id);
    paths[id] = path(f) ?? "";
    areas[id] = Math.abs(path.area(f));
  }
  const nb = neighbors(regionsObj.geometries as never);
  const neighborMap: Record<string, string[]> = {};
  regionsObj.geometries.forEach((g, i) => {
    neighborMap[String(g.id)] = nb[i].map((j) => String(regionsObj.geometries[j].id));
  });
  const lakes = feature(topo, topo.objects.lakes as GeometryCollection) as unknown as Feature;
  return {
    width: raw.width,
    height: raw.height,
    topology: topo,
    ids,
    regions: raw.regions,
    paths,
    areas,
    neighbors: neighborMap,
    cities: raw.cities,
    lakesPath: path(lakes as never) ?? "",
    source: raw.source,
  };
}

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { mesh } from "topojson-client";
import { geoPath } from "d3-geo";
import type { GeometryCollection } from "topojson-specification";
import type { MapData } from "../game/mapdata";
import type { GameState, RelationStatus } from "../game/types";
import { countryName, ownerOf, relationOf } from "../game/engine";
import { COUNTRIES, SHORT_NAMES } from "../game/scenario1911";

export type MapMode = "political" | "diplomatic";

interface Props {
  map: MapData;
  state: GameState;
  mode: MapMode;
  selectedRegion: string | null;
  selectedArmy: string | null;
  onRegionClick: (id: string) => void;
  onArmyClick: (id: string) => void;
  focus: { x: number; y: number; k: number } | null;
}

const DIPLO_COLORS: Record<RelationStatus | "self" | "none", string> = {
  self: "#3f7cc4",
  alliance: "#3f9a55",
  entente: "#8cc07a",
  war: "#c23b2f",
  rival: "#d98c3a",
  truce: "#d8c35a",
  dominion: "#7fb6a0",
  none: "#b9b2a2",
};

const path = geoPath(null);

const Regions = memo(function Regions({ map, fills }: { map: MapData; fills: Record<string, string> }) {
  return (
    <g className="regions">
      {map.ids.map((id) => (
        <path key={id} data-id={id} d={map.paths[id]} fill={fills[id]} />
      ))}
    </g>
  );
});

function useOwners(map: MapData, state: GameState) {
  return useMemo(() => {
    const o: Record<string, string> = {};
    for (const id of map.ids) o[id] = ownerOf(state, map, id);
    return o;
  }, [map, state.owners]); // eslint-disable-line react-hooks/exhaustive-deps
}

interface Label {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
}

/**
 * Labels for connected blocks of provinces. A block close to a bigger block of
 * the same country gets no label of its own (Ireland next to Great Britain).
 */
function computeLabels(map: MapData, state: GameState, owners: Record<string, string>): Label[] {
  const seen = new Set<string>();
  const comps: { owner: string; start: string; area: number; x: number; y: number; w: number; h: number }[] = [];
  for (const start of map.ids) {
    if (seen.has(start)) continue;
    const owner = owners[start];
    const comp: string[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const r = stack.pop()!;
      comp.push(r);
      for (const n of map.neighbors[r] ?? []) {
        if (!seen.has(n) && owners[n] === owner) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    const area = comp.reduce((s, r) => s + map.areas[r], 0);
    if (area < 40 || !owner) continue;
    let x = 0;
    let y = 0;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const r of comp) {
      const [cx, cy] = map.regions[r].c;
      x += cx * map.areas[r];
      y += cy * map.areas[r];
      minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
      minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
    }
    x /= area;
    y /= area;
    // Keep the label over land: fall back to the biggest province near the weighted centre.
    let best = comp[0];
    let bestScore = Infinity;
    for (const r of comp) {
      const [cx, cy] = map.regions[r].c;
      const score = Math.sqrt((cx - x) ** 2 + (cy - y) ** 2) - Math.sqrt(map.areas[r]);
      if (score < bestScore) {
        bestScore = score;
        best = r;
      }
    }
    if (bestScore > 0) [x, y] = map.regions[best].c;
    const side = Math.sqrt(area);
    comps.push({ owner, start, area, x, y, w: Math.max(maxX - minX, side * 0.7), h: Math.max(maxY - minY, side * 0.45) });
  }
  comps.sort((a, b) => b.area - a.area);
  const kept: typeof comps = [];
  for (const c of comps) {
    if (kept.some((k) => k.owner === c.owner && Math.hypot(k.x - c.x, k.y - c.y) < 220)) continue;
    kept.push(c);
  }
  return kept.map((c) => {
    const country = state.countries[c.owner];
    const text = (country && COUNTRIES[c.owner]?.name === country.name ? SHORT_NAMES[c.owner] : undefined) ?? countryName(state, c.owner);
    const size = Math.max(1.5, Math.min(60, (c.w * 0.8) / (text.length * 0.66), c.h * 0.45));
    return { id: `${c.owner}-${c.start}`, text: text.toUpperCase(), x: c.x, y: c.y, size };
  });
}

export function MapView({ map, state, mode, selectedRegion, selectedArmy, onRegionClick, onArmyClick, focus }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [k, setK] = useState(1);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const owners = useOwners(map, state);

  const fills = useMemo(() => {
    const f: Record<string, string> = {};
    for (const id of map.ids) {
      const o = owners[id];
      if (mode === "political") f[id] = state.countries[o]?.color ?? "#cfc8b6";
      else if (o === state.player) f[id] = DIPLO_COLORS.self;
      else f[id] = DIPLO_COLORS[relationOf(state, o, state.player)?.status ?? "none"];
    }
    return f;
  }, [map, owners, mode, state.countries, state.relations, state.player]); // eslint-disable-line react-hooks/exhaustive-deps

  const borders = useMemo(() => {
    const obj = map.topology.objects.regions as GeometryCollection;
    const ownerOfGeom = (g: { id?: string | number }) => owners[String(g.id)];
    return {
      country: path(mesh(map.topology, obj, (a, b) => a !== b && ownerOfGeom(a) !== ownerOfGeom(b))) ?? "",
      province: path(mesh(map.topology, obj, (a, b) => a !== b && ownerOfGeom(a) === ownerOfGeom(b))) ?? "",
      coast: path(mesh(map.topology, obj, (a, b) => a === b)) ?? "",
    };
  }, [map, owners]);

  const labels = useMemo(() => computeLabels(map, state, owners), [map, owners, state.countries]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zoom and pan; the transform is written straight to the DOM to avoid re-rendering 3000 paths.
  useEffect(() => {
    const svg = select(svgRef.current!);
    let frame = 0;
    const behavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 60])
      .on("zoom", (e) => {
        gRef.current?.setAttribute("transform", e.transform.toString());
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => setK(e.transform.k));
      });
    zoomRef.current = behavior;
    svg.call(behavior).on("dblclick.zoom", null);
    return () => {
      svg.on(".zoom", null);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!focus || !svgRef.current || !zoomRef.current) return;
    const { width, height } = svgRef.current.getBoundingClientRect();
    const t = zoomIdentity.translate(width / 2 - focus.x * focus.k, height / 2 - focus.y * focus.k).scale(focus.k);
    select(svgRef.current).call(zoomRef.current.transform, t);
  }, [focus]);

  const armiesByRegion = useMemo(() => {
    const m = new Map<string, typeof state.armies>();
    for (const a of state.armies) {
      if (!m.has(a.region)) m.set(a.region, []);
      m.get(a.region)!.push(a);
    }
    return m;
  }, [state.armies]);

  const showCities = k >= 2.2;
  const inv = 1 / k;

  return (
    <div className="map-wrap">
      <svg
        ref={svgRef}
        className="map-svg"
        onClick={(e) => {
          const id = (e.target as Element).getAttribute("data-id");
          if (id) onRegionClick(id);
        }}
        onMouseMove={(e) => {
          const id = (e.target as Element).getAttribute("data-id");
          setHover(id ? { id, x: e.clientX, y: e.clientY } : null);
        }}
        onMouseLeave={() => setHover(null)}
      >
        <rect className="ocean" x={-1e5} y={-1e5} width={2e5} height={2e5} />
        <g ref={gRef}>
          <Regions map={map} fills={fills} />
          <path className="lakes" d={map.lakesPath} />
          <path className="province-borders" d={borders.province} />
          <path className="coast" d={borders.coast} />
          <path className="country-borders" d={borders.country} />
          {selectedRegion && map.paths[selectedRegion] && (
            <path className="selected-region" d={map.paths[selectedRegion]} />
          )}
          <g className="labels">
            {labels.map((l) => {
              const screen = l.size * k;
              if (screen < 8) return null;
              const fontSize = Math.min(screen, 40) / k;
              return (
                <text key={l.id} x={l.x} y={l.y} fontSize={fontSize} textAnchor="middle" dominantBaseline="middle">
                  {l.text}
                </text>
              );
            })}
          </g>
          <g className="cities">
            {map.cities.map((c) => {
              if (!c.cap && !showCities) return null;
              return (
                <g key={c.n} transform={`translate(${c.x},${c.y}) scale(${inv})`}>
                  {c.cap ? <rect x={-3.5} y={-3.5} width={7} height={7} className="capital" /> : <circle r={2.6} />}
                  {(showCities || k >= 1.4) && (
                    <text x={6} y={4} className={c.cap ? "cap-name" : undefined}>
                      {c.n}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
          <g className="armies">
            {[...armiesByRegion.entries()].map(([region, list]) => {
              const meta = map.regions[region];
              if (!meta) return null;
              return list.map((a, i) => {
                const color = state.countries[a.owner]?.color ?? "#888";
                const label = a.kind === "fleet" ? `${a.size}` : a.size >= 1000 ? `${(a.size / 1000).toFixed(1)}м` : `${a.size}к`;
                return (
                  <g
                    key={a.id}
                    className={`army${selectedArmy === a.id ? " selected" : ""}${a.kind === "fleet" ? " fleet" : ""}`}
                    transform={`translate(${meta.c[0]},${meta.c[1]}) scale(${inv}) translate(${i * 9 - 14},${i * 9 - 8})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onArmyClick(a.id);
                    }}
                  >
                    <title>{`${a.name} (${countryName(state, a.owner)}): ${a.kind === "fleet" ? `${a.size} линкоров` : `${a.size} тыс. чел.`}`}</title>
                    {a.kind === "fleet" ? (
                      <path d="M0 4 L28 4 L24 13 L4 13 Z M10 -3 L18 -3 L18 4 L10 4 Z" fill={color} />
                    ) : (
                      <rect width={28} height={15} rx={2} fill={color} />
                    )}
                    <text x={14} y={a.kind === "fleet" ? 11.5 : 11} textAnchor="middle">
                      {label}
                    </text>
                  </g>
                );
              });
            })}
          </g>
        </g>
      </svg>
      {hover && map.regions[hover.id] && (
        <div className="map-tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <b>{map.regions[hover.id].n}</b>
          <div>{countryName(state, owners[hover.id])}</div>
        </div>
      )}
      <div className="map-zoom">
        <button className="btn icon" title="Приблизить" onClick={() => zoomRef.current && select(svgRef.current!).call(zoomRef.current.scaleBy, 1.6)}>
          +
        </button>
        <button className="btn icon" title="Отдалить" onClick={() => zoomRef.current && select(svgRef.current!).call(zoomRef.current.scaleBy, 1 / 1.6)}>
          −
        </button>
      </div>
    </div>
  );
}

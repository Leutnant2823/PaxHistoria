import type { GameState } from "../game/types";
import type { MapData } from "../game/mapdata";
import { RELATION_LABEL, ownerOf, regionsOf, relationOf } from "../game/engine";

interface Props {
  state: GameState;
  map: MapData;
  regionId: string | null;
  countryId: string;
  onClose: () => void;
  onChat: (id: string) => void;
  onAddAction: (text: string) => void;
  locked: boolean;
}

export function CountryCard({ state, map, regionId, countryId, onClose, onChat, onAddAction, locked }: Props) {
  const c = state.countries[countryId];
  if (!c) return null;
  const me = countryId === state.player;
  const rel = me ? undefined : relationOf(state, countryId, state.player);
  const regions = regionsOf(state, map, countryId);
  const km2 = regions.reduce((s, r) => s + map.regions[r].k, 0);
  const armies = state.armies.filter((a) => a.owner === countryId);
  const troops = armies.filter((a) => a.kind === "army").reduce((s, a) => s + a.size, 0);
  const ships = armies.filter((a) => a.kind === "fleet").reduce((s, a) => s + a.size, 0);
  const region = regionId ? map.regions[regionId] : null;
  const regionName = region?.n;
  const atWar = rel?.status === "war";

  const quick = me
    ? []
    : [
        atWar
          ? { label: "Предложить мир", text: `Направить ${c.name} предложение о перемирии и мирных переговорах` }
          : { label: "Объявить войну", text: `Объявить войну государству ${c.name}` },
        rel?.status === "alliance"
          ? { label: "Укрепить союз", text: `Провести переговоры с ${c.name} об углублении военного союза и совместном планировании` }
          : { label: "Предложить союз", text: `Предложить ${c.name} оборонительный союз` },
        { label: "Торговый договор", text: `Заключить с ${c.name} торговый договор и снизить таможенные пошлины` },
        ...(regionName && ownerOf(state, map, regionId!) === countryId
          ? [{ label: `Потребовать ${regionName}`, text: `Потребовать у ${c.name} передать нам провинцию ${regionName}` }]
          : []),
      ];

  return (
    <div className="panel country-card">
      <button className="close" onClick={onClose} title="Закрыть">
        ✕
      </button>
      {regionName && <div className="muted small">Провинция: {regionName}</div>}
      <h3>
        <span className="dot big" style={{ background: c.color }} />
        {c.name}
        {me && <span className="tag">ваша страна</span>}
      </h3>
      <div className="card-grid small">
        <div>Правитель</div>
        <div>{c.leader}</div>
        <div>Строй</div>
        <div>{c.government}</div>
        <div>Территория</div>
        <div>
          {regions.length} пров., {Math.round(km2 / 1000)} тыс. км²
        </div>
        <div>Войска на карте</div>
        <div>
          {troops ? `${troops} тыс. чел.` : "нет данных"}
          {ships ? `, ${ships} линкоров` : ""}
        </div>
        {!me && (
          <>
            <div>Отношения с вами</div>
            <div className={rel ? `rel-${rel.status}` : ""}>{rel ? `${RELATION_LABEL[rel.status]}${rel.note ? ` (${rel.note})` : ""}` : "обычные"}</div>
          </>
        )}
      </div>
      <p className="small desc">{c.description}</p>
      {!me && (
        <div className="row wrap">
          <button className="btn primary small" onClick={() => onChat(countryId)}>
            Написать
          </button>
          {quick.map((q) => (
            <button key={q.label} className="btn small" disabled={locked} onClick={() => onAddAction(q.text)} title="Добавить в приказы">
              {q.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

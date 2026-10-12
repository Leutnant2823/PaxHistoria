import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ServerConfig } from "../../shared/api";
import { api } from "../api";
import type { MapData } from "../game/mapdata";
import type { GameEvent, GameState } from "../game/types";
import { applyChange, applyEvent, countryName, formatDate, migrateState, newId, ownerOf, regionsOf } from "../game/engine";
import { chronicleDue, generateJump, jumpLabel, writeChronicle, type JumpPlan } from "../game/aitasks";
import { persistGame, persistSnapshot } from "../game/persist";
import { MapView, type MapMode } from "../components/MapView";
import { ActionsPanel } from "../components/ActionsPanel";
import { DiplomacyPanel } from "../components/DiplomacyPanel";
import { SidePanel } from "../components/SidePanel";
import { CountryCard } from "../components/CountryCard";
import { JumpDialog, JumpOverlay, type JumpPhase } from "../components/Jump";
import { SettingsDialog } from "../components/SettingsDialog";
import { TimelineDialog } from "../components/TimelineDialog";
import { getScenario } from "../game/scenarios";

interface Props {
  initial: GameState;
  map: MapData;
  config: ServerConfig;
  onExit: () => void;
}

interface JumpRun {
  plan: JumpPlan;
  base: GameState;
  working: GameState;
  target: string;
  raw: GameEvent[];
  events: GameEvent[];
}

type SaveStatus = "saved" | "saving" | "error";

export function Game({ initial, map, config, onExit }: Props) {
  const [state, setState] = useState(() => migrateState(initial));
  const stateRef = useRef(state);
  stateRef.current = state;
  const update = useCallback((fn: (s: GameState) => void) => {
    setState((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  // ----- autosave
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const loaded = useRef(false);
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    setSaveStatus("saving");
    const t = setTimeout(() => {
      persistGame(stateRef.current).then(
        () => setSaveStatus("saved"),
        () => setSaveStatus("error"),
      );
    }, 1500);
    return () => clearTimeout(t);
  }, [state]);

  // ----- UI state
  const [mode, setMode] = useState<MapMode>("political");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedArmy, setSelectedArmy] = useState<string | null>(null);
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"jump" | "settings" | "timeline" | "intro" | null>(initial.turn === 1 && !initial.events.length ? "intro" : null);
  const [editorCountry, setEditorCountry] = useState(initial.player);
  const [loreBusy, setLoreBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const capital = useMemo(() => map.cities.find((c) => c.cap === initial.player), [map, initial.player]);
  const [focus, setFocus] = useState<{ x: number; y: number; k: number } | null>(capital ? { x: capital.x, y: capital.y, k: 3.2 } : null);

  // ----- jump forward
  const [phase, setPhase] = useState<JumpPhase | null>(null);
  const [working, setWorking] = useState<GameState | null>(null);
  const runRef = useRef<JumpRun | null>(null);
  const lastPlan = useRef<JumpPlan | null>(null);
  const locked = phase !== null;
  const view = working ?? state;

  const runChronicle = useCallback(
    async (range: { from: number; to: number }) => {
      setLoreBusy(true);
      try {
        const res = await writeChronicle(stateRef.current, map, range);
        update((s) => {
          s.summaries.push({ fromTurn: range.from, toTurn: range.to, text: res.summary });
          s.lore = res.lore;
        });
      } catch (e) {
        setNotice(`Летопись не обновилась: ${(e as Error).message}`);
      } finally {
        setLoreBusy(false);
      }
    },
    [map, update],
  );

  async function startJump(plan: JumpPlan) {
    setDialog(null);
    setSelectedArmy(null);
    lastPlan.current = plan;
    const abort = new AbortController();
    setPhase({ stage: "generating", chars: 0, thinking: true, abort });
    const base = stateRef.current;
    try {
      const { events: raw, target } = await generateJump(
        base,
        map,
        plan,
        (p) => setPhase((ph) => (ph?.stage === "generating" ? { ...ph, chars: p.text.length, thinking: p.thinking } : ph)),
        abort.signal,
      );
      const w = structuredClone(base);
      const events = [...raw];
      const step = base.settings.stepEvents;
      const upto = step ? 1 : raw.length;
      for (let i = 0; i < upto; i++) events[i] = applyEvent(w, map, { ...raw[i], id: newId(w, "e") });
      runRef.current = { plan, base, working: w, target, raw, events };
      setWorking(w);
      setPhase({ stage: "playback", events, index: step ? 0 : raw.length - 1, list: !step });
    } catch (e) {
      if (abort.signal.aborted) setPhase(null);
      else setPhase({ stage: "error", message: (e as Error).message });
    }
  }

  function advance(toIndex: number, list: boolean) {
    const run = runRef.current;
    if (!run || phase?.stage !== "playback") return;
    const w = structuredClone(run.working);
    for (let i = phase.index + 1; i <= toIndex; i++) run.events[i] = applyEvent(w, map, { ...run.raw[i], id: newId(w, "e") });
    run.working = w;
    setWorking(w);
    setPhase({ stage: "playback", events: [...run.events], index: toIndex, list });
  }

  async function finishJump(intervened: boolean) {
    const run = runRef.current;
    if (!run) return;
    const final = structuredClone(run.working);
    if (!intervened && run.target > final.date) final.date = run.target;
    final.turns.push({
      turn: run.base.turn,
      from: run.base.date,
      to: final.date,
      actions: run.base.pending,
      mode: jumpLabel(run.plan),
      intervened,
    });
    final.pending = [];
    final.turn = run.base.turn + 1;
    runRef.current = null;
    setWorking(null);
    setPhase(null);
    setState(final);
    try {
      await persistGame(final);
      await persistSnapshot(final);
    } catch (e) {
      setNotice(`Не удалось сохранить ход: ${(e as Error).message}`);
    }
    const due = chronicleDue(final);
    if (due) runChronicle(due);
  }

  function cancelJump() {
    if (phase?.stage === "generating") phase.abort.abort();
    runRef.current = null;
    setWorking(null);
    setPhase(null);
  }

  // ----- map interaction
  const addAction = useCallback(
    (text: string) =>
      update((s) => {
        s.pending.push({ id: newId(s, "p"), text });
      }),
    [update],
  );

  function onRegionClick(id: string) {
    if (locked) return;
    const s = stateRef.current;
    if (s.settings.mapEditor) {
      update((st) => {
        applyChange(st, map, { type: "transfer", regions: [id], to: editorCountry });
      });
      return;
    }
    if (selectedArmy) {
      const army = s.armies.find((a) => a.id === selectedArmy);
      if (army && army.owner === s.player && army.region !== id) {
        addAction(`Переместить «${army.name}» из провинции ${map.regions[army.region].n} в провинцию ${map.regions[id].n}`);
        setNotice(`Приказ добавлен: ${army.name} → ${map.regions[id].n}`);
      }
      setSelectedArmy(null);
      return;
    }
    setSelectedRegion(id);
    setSelectedCountry(ownerOf(s, map, id));
  }

  function onArmyClick(id: string) {
    if (locked) return;
    const army = stateRef.current.armies.find((a) => a.id === id);
    if (!army) return;
    setSelectedArmy(selectedArmy === id ? null : id);
    setSelectedCountry(army.owner);
    setSelectedRegion(army.region);
  }

  function focusCountry(id: string) {
    const s = stateRef.current;
    const cap = map.cities.find((c) => c.cap === id && ownerOf(s, map, c.r) === id);
    const regions = regionsOf(s, map, id);
    const biggest = regions.sort((a, b) => map.areas[b] - map.areas[a])[0];
    const [x, y] = cap ? [cap.x, cap.y] : biggest ? map.regions[biggest].c : [0, 0];
    setFocus({ x, y, k: 3 });
    setSelectedCountry(id);
    setSelectedRegion(null);
  }

  function openChatWith(id: string) {
    let chatId = "";
    update((s) => {
      const existing = s.chats.find((c) => c.participants.length === 1 && c.participants[0] === id);
      if (existing) chatId = existing.id;
      else {
        chatId = newId(s, "c");
        s.chats.push({ id: chatId, participants: [id], messages: [], unread: false });
      }
    });
    setTimeout(() => setOpenChatId(chatId));
  }

  async function rewind(turn: number) {
    const snap = migrateState(await api.loadSnapshot<GameState>(state.id, turn));
    await api.deleteSnapshotsAfter(state.id, turn);
    await persistGame(snap);
    loaded.current = false;
    setState(snap);
    setSelectedRegion(null);
    setSelectedCountry(null);
  }

  async function exit() {
    try {
      await persistGame(stateRef.current);
    } finally {
      onExit();
    }
  }

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const player = view.countries[view.player];
  const scenario = getScenario(view.scenario);
  const armyHint = selectedArmy ? view.armies.find((a) => a.id === selectedArmy) : null;

  return (
    <div className="game">
      <MapView
        map={map}
        state={view}
        mode={mode}
        selectedRegion={selectedRegion}
        selectedArmy={selectedArmy}
        onRegionClick={onRegionClick}
        onArmyClick={onArmyClick}
        focus={focus}
      />

      <header className="topbar">
        <div className="row">
          <button className="btn ghost small" onClick={exit}>
            Меню
          </button>
          <span className={`save-status ${saveStatus}`}>
            {saveStatus === "saved" ? "сохранено" : saveStatus === "saving" ? "сохранение..." : "ошибка сохранения"}
          </span>
        </div>
        <div className="topbar-center">
          <span className="dot big" style={{ background: player?.color }} />
          <div>
            <div className="player-name">{player?.name}</div>
            <div className="date">
              {formatDate(view.date)} · ход {view.turn}
            </div>
          </div>
        </div>
        <div className="row">
          <button className="btn small" onClick={() => setMode(mode === "political" ? "diplomatic" : "political")} title="Режим карты">
            {mode === "political" ? "Карта: политическая" : "Карта: дипломатическая"}
          </button>
          <button className="btn small" onClick={() => setDialog("timeline")} disabled={locked}>
            Хронология
          </button>
          <button className="btn small" onClick={() => setDialog("settings")} disabled={locked}>
            Настройки
          </button>
          <button className="btn primary jump-btn" onClick={() => setDialog("jump")} disabled={locked}>
            Перемотать время ▸
          </button>
        </div>
      </header>

      <SidePanel
        state={view}
        map={map}
        onSelectCountry={focusCountry}
        loreBusy={loreBusy}
        onRefreshLore={() => {
          const last = state.summaries.length ? state.summaries[state.summaries.length - 1].toTurn : 0;
          if (state.turn - 1 > last) runChronicle({ from: last + 1, to: state.turn - 1 });
          else setNotice("Новых ходов для летописи пока нет");
        }}
      />

      <DiplomacyPanel
        state={view}
        map={map}
        update={update}
        stateRef={stateRef}
        openChatId={openChatId}
        setOpenChatId={setOpenChatId}
        locked={locked}
      />

      <ActionsPanel state={view} map={map} update={update} locked={locked} />

      {selectedCountry && !locked && (
        <CountryCard
          state={view}
          map={map}
          regionId={selectedRegion}
          countryId={selectedCountry}
          locked={locked}
          onClose={() => {
            setSelectedCountry(null);
            setSelectedRegion(null);
          }}
          onChat={openChatWith}
          onAddAction={(t) => {
            addAction(t);
            setNotice("Добавлено в приказы");
          }}
        />
      )}

      {armyHint && armyHint.owner === view.player && (
        <div className="hint-bar">Выберите провинцию, куда направить «{armyHint.name}». Повторный клик по армии отменяет выбор.</div>
      )}
      {view.settings.mapEditor && !locked && (
        <div className="hint-bar warn">Редактор карты включён: клик передаёт провинцию стране {countryName(view, editorCountry)}</div>
      )}
      {notice && <div className="notice">{notice}</div>}

      {dialog === "intro" && (
        <div className="modal-backdrop" onClick={() => setDialog(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>
              {player?.name}, {formatDate(scenario.startDate)}
            </h2>
            <p>{scenario.intro}</p>
            <p className="muted small">{player?.description}</p>
            <ol className="small">
              <li>Пишите приказы своими словами на панели «Действия» справа внизу.</li>
              <li>Ведите переговоры с другими странами на панели «Дипломатия» слева внизу или кликнув по стране на карте.</li>
              <li>Спрашивайте совета у советника, а когда будете готовы, нажмите «Перемотать время».</li>
              <li>Армии можно двигать: кликните по своей армии, затем по провинции назначения.</li>
            </ol>
            <div className="modal-actions">
              <button className="btn primary" onClick={() => setDialog(null)}>
                К делу
              </button>
            </div>
          </div>
        </div>
      )}
      {dialog === "jump" && <JumpDialog state={state} onCancel={() => setDialog(null)} onJump={startJump} />}
      {dialog === "settings" && (
        <SettingsDialog
          state={state}
          map={map}
          config={config}
          update={update}
          onClose={() => setDialog(null)}
          editorCountry={editorCountry}
          setEditorCountry={setEditorCountry}
        />
      )}
      {dialog === "timeline" && <TimelineDialog state={state} onClose={() => setDialog(null)} onRewind={rewind} />}

      {phase && (
        <JumpOverlay
          phase={phase}
          onCancel={cancelJump}
          onRetry={() => lastPlan.current && startJump(lastPlan.current)}
          onNext={() => phase.stage === "playback" && advance(phase.index + 1, false)}
          onShowAll={() => phase.stage === "playback" && advance(phase.events.length - 1, true)}
          onIntervene={() => {
            if (phase.stage !== "playback" || !runRef.current) return;
            runRef.current.events = runRef.current.events.slice(0, phase.index + 1);
            finishJump(true);
          }}
          onFinish={() => finishJump(false)}
        />
      )}
    </div>
  );
}

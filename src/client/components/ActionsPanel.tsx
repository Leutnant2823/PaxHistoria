import { useState } from "react";
import type { GameState } from "../game/types";
import type { MapData } from "../game/mapdata";
import { advisorReply, brainstorm, enhanceAction } from "../game/aitasks";
import { formatDate, newId } from "../game/engine";
import { Markdown } from "./Markdown";

interface Props {
  state: GameState;
  map: MapData;
  update: (fn: (s: GameState) => void) => void;
  locked: boolean;
}

export function ActionsPanel(props: Props) {
  const [tab, setTab] = useState<"actions" | "advisor">("actions");
  const [open, setOpen] = useState(true);
  return (
    <div className={`panel actions-panel${open ? "" : " collapsed"}`}>
      <div className="panel-tabs">
        <button className={tab === "actions" ? "active" : ""} onClick={() => { setTab("actions"); setOpen(true); }}>
          Действия {props.state.pending.length ? `(${props.state.pending.length})` : ""}
        </button>
        <button className={tab === "advisor" ? "active" : ""} onClick={() => { setTab("advisor"); setOpen(true); }}>
          Советник
        </button>
        <button className="collapse" onClick={() => setOpen(!open)} title={open ? "Свернуть" : "Развернуть"}>
          {open ? "▾" : "▴"}
        </button>
      </div>
      {open && (tab === "actions" ? <Actions {...props} /> : <Advisor {...props} />)}
    </div>
  );
}

function Actions({ state, map, update, locked }: Props) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [ideas, setIdeas] = useState<string[]>([]);
  const [busy, setBusy] = useState<"enhance" | "ideas" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const add = (text: string) => {
    const t = text.trim();
    if (!t) return;
    update((s) => {
      s.pending.push({ id: newId(s, "p"), text: t });
    });
  };

  async function run(kind: "enhance" | "ideas") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "enhance") setDraft(await enhanceAction(state, map, draft));
      else setIdeas(await brainstorm(state, map));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="panel-body">
      <p className="muted small">
        Опишите своими словами, что делает ваше правительство в этом ходу. Приказы исполнятся при перемотке времени.
      </p>
      <ul className="action-list">
        {state.pending.map((a, i) => (
          <li key={a.id}>
            {editing === a.id ? (
              <>
                <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} />
                <div className="row">
                  <button
                    className="btn small"
                    onClick={() => {
                      update((s) => {
                        const it = s.pending.find((p) => p.id === a.id);
                        if (it) it.text = editText.trim() || it.text;
                      });
                      setEditing(null);
                    }}
                  >
                    Сохранить
                  </button>
                  <button className="btn small ghost" onClick={() => setEditing(null)}>
                    Отмена
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="action-num">{i + 1}.</span>
                <span className="action-text">{a.text}</span>
                {!locked && (
                  <span className="action-tools">
                    <button className="link" onClick={() => { setEditing(a.id); setEditText(a.text); }}>
                      изменить
                    </button>
                    <button className="link danger" onClick={() => update((s) => { s.pending = s.pending.filter((p) => p.id !== a.id); })}>
                      удалить
                    </button>
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <textarea
        className="action-input"
        placeholder="Например: предложить Британии соглашение об ограничении флотов в обмен на нейтралитет"
        value={draft}
        rows={3}
        disabled={locked}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            add(draft);
            setDraft("");
          }
        }}
      />
      <div className="row wrap">
        <button className="btn primary small" disabled={locked || !draft.trim()} onClick={() => { add(draft); setDraft(""); }}>
          Добавить приказ
        </button>
        <button className="btn small" disabled={locked || !draft.trim() || !!busy} onClick={() => run("enhance")}>
          {busy === "enhance" ? "Улучшаю..." : "Улучшить формулировку"}
        </button>
        <button className="btn small" disabled={locked || !!busy} onClick={() => run("ideas")}>
          {busy === "ideas" ? "Думаю..." : "Идеи"}
        </button>
      </div>
      {error && <div className="error-text small">{error}</div>}
      {ideas.length > 0 && (
        <div className="ideas">
          <div className="muted small">Предложения советников:</div>
          {ideas.map((idea, i) => (
            <div key={i} className="idea">
              <span>{idea}</span>
              <button className="btn small" disabled={locked} onClick={() => { add(idea); setIdeas(ideas.filter((_, j) => j !== i)); }}>
                +
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const QUICK = ["Как обстоят дела в стране и мире?", "Что нам делать в ближайшие месяцы?", "Оцени мои приказы на этот ход", "Кто наши главные угрозы?"];

function Advisor({ state, map, update }: Props) {
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || pending !== null) return;
    setQuestion("");
    setError(null);
    setPending("");
    try {
      const answer = await advisorReply(state, map, text, (p) => setPending(p.text));
      update((s) => {
        s.advisor.push({ role: "user", text, date: s.date }, { role: "advisor", text: answer.text, date: s.date, by: answer.by });
      });
    } catch (e) {
      setError((e as Error).message);
      setQuestion(text);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="panel-body advisor">
      <div className="messages">
        {state.advisor.length === 0 && <p className="muted small">Спросите советника о положении дел, рисках и возможных шагах.</p>}
        {state.advisor.map((m, i) => (
          <div key={i} className={`msg ${m.role === "user" ? "mine" : "theirs"}`}>
            <div className="msg-head">{m.role === "user" ? "Вы" : "Советник"}, {formatDate(m.date)}</div>
            {m.role === "advisor" ? <Markdown text={m.text} /> : <p>{m.text}</p>}
            {m.by && <div className="msg-by">ответил: {m.by}</div>}
          </div>
        ))}
        {pending !== null && (
          <div className="msg theirs">
            <div className="msg-head">Советник</div>
            {pending ? <Markdown text={pending} /> : <p className="muted">обдумывает ответ...</p>}
          </div>
        )}
      </div>
      {error && <div className="error-text small">{error}</div>}
      <div className="row wrap">
        {QUICK.map((q) => (
          <button key={q} className="chip" disabled={pending !== null} onClick={() => ask(q)}>
            {q}
          </button>
        ))}
      </div>
      <div className="row">
        <input
          value={question}
          placeholder="Вопрос советнику"
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(question)}
        />
        <button className="btn primary small" disabled={pending !== null || !question.trim()} onClick={() => ask(question)}>
          Спросить
        </button>
      </div>
      {state.advisor.length > 0 && (
        <button className="link small" onClick={() => update((s) => { s.advisor = []; })}>
          очистить разговор
        </button>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import type { Chat, GameState } from "../game/types";
import type { MapData } from "../game/mapdata";
import { chatReply, describeAction, nextSpeaker } from "../game/aitasks";
import { countryName, formatDate, newId } from "../game/engine";

interface Props {
  state: GameState;
  map: MapData;
  update: (fn: (s: GameState) => void) => void;
  stateRef: React.MutableRefObject<GameState>;
  openChatId: string | null;
  setOpenChatId: (id: string | null) => void;
  locked: boolean;
}

const MAX_GROUP_REPLIES = 3;

export function DiplomacyPanel(props: Props) {
  const { state, openChatId, setOpenChatId, update } = props;
  const [open, setOpen] = useState(true);
  const [picking, setPicking] = useState(false);
  const chat = state.chats.find((c) => c.id === openChatId);
  const unread = state.chats.filter((c) => c.unread).length;

  return (
    <div className={`panel diplomacy-panel${open ? "" : " collapsed"}`}>
      <div className="panel-tabs">
        <button className="active" onClick={() => setOpen(true)}>
          Дипломатия {unread ? <span className="badge">{unread}</span> : null}
        </button>
        <button className="collapse" onClick={() => setOpen(!open)}>
          {open ? "▾" : "▴"}
        </button>
      </div>
      {open &&
        (chat ? (
          <ChatWindow {...props} chat={chat} onClose={() => setOpenChatId(null)} />
        ) : picking ? (
          <NewChat
            state={state}
            onCancel={() => setPicking(false)}
            onCreate={(ids) => {
              let id = "";
              update((s) => {
                const existing = s.chats.find((c) => c.participants.length === ids.length && ids.every((p) => c.participants.includes(p)));
                if (existing) id = existing.id;
                else {
                  id = newId(s, "c");
                  s.chats.push({ id, participants: ids, messages: [], unread: false });
                }
              });
              setPicking(false);
              setTimeout(() => setOpenChatId(id));
            }}
          />
        ) : (
          <div className="panel-body">
            <button className="btn primary small" onClick={() => setPicking(true)}>
              Новая переписка
            </button>
            {state.chats.length === 0 && <p className="muted small">Начните переговоры с любой страной или группой стран. Можно также нажать на страну на карте.</p>}
            <ul className="chat-list">
              {[...state.chats].reverse().map((c) => {
                const last = c.messages[c.messages.length - 1];
                return (
                  <li key={c.id} className={c.unread ? "unread" : ""} onClick={() => setOpenChatId(c.id)}>
                    <div className="chat-title">
                      {c.participants.map((p) => (
                        <span key={p} className="dot" style={{ background: state.countries[p]?.color }} />
                      ))}
                      {c.participants.map((p) => countryName(state, p)).join(", ")}
                    </div>
                    {last && <div className="muted small ellipsis">{last.text}</div>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
    </div>
  );
}

function NewChat({ state, onCancel, onCreate }: { state: GameState; onCancel: () => void; onCreate: (ids: string[]) => void }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const list = useMemo(
    () =>
      Object.values(state.countries)
        .filter((c) => c.alive && c.id !== state.player && c.name.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => Number(b.major) - Number(a.major) || a.name.localeCompare(b.name, "ru")),
    [state, query],
  );
  return (
    <div className="panel-body">
      <input placeholder="Поиск страны" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      <div className="pick-list">
        {list.map((c) => (
          <label key={c.id} className="pick">
            <input
              type="checkbox"
              checked={picked.includes(c.id)}
              onChange={(e) => setPicked(e.target.checked ? [...picked, c.id] : picked.filter((p) => p !== c.id))}
            />
            <span className="dot" style={{ background: c.color }} />
            {c.name}
          </label>
        ))}
      </div>
      <div className="row">
        <button className="btn ghost small" onClick={onCancel}>
          Отмена
        </button>
        <button className="btn primary small" disabled={!picked.length} onClick={() => onCreate(picked)}>
          {picked.length > 1 ? "Создать конференцию" : "Открыть переписку"}
        </button>
      </div>
    </div>
  );
}

function ChatWindow({ state, map, update, stateRef, chat, onClose, locked }: Props & { chat: Chat; onClose: () => void }) {
  const [text, setText] = useState("");
  const [typing, setTyping] = useState<{ who: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chat.unread)
      update((s) => {
        const c = s.chats.find((x) => x.id === chat.id);
        if (c) c.unread = false;
      });
  }, [chat.unread, chat.id, update]);

  const scroll = () => setTimeout(() => scrollRef.current?.scrollTo({ top: 1e6, behavior: "smooth" }), 30);

  async function send() {
    const message = text.trim();
    if (!message || typing) return;
    setText("");
    setError(null);
    // Work on a local copy for AI context; push results into the real state as they arrive.
    const local: GameState = structuredClone(stateRef.current);
    const localChat = local.chats.find((c) => c.id === chat.id)!;
    const push = (from: string, body: string, by?: string) => {
      const msg = { id: newId(local, "m"), from, text: body, date: local.date, ...(by ? { by } : {}) };
      localChat.messages.push(msg);
      update((s) => {
        s.nextId = Math.max(s.nextId, local.nextId);
        s.chats.find((c) => c.id === chat.id)?.messages.push(msg);
      });
      scroll();
    };
    push("player", message);
    try {
      if (chat.participants.length === 1) {
        const speaker = chat.participants[0];
        setTyping({ who: speaker, text: "" });
        {
          const reply = await chatReply(local, map, localChat, speaker, (p) => setTyping({ who: speaker, text: p.text }));
          push(speaker, reply.text, reply.by);
        }
      } else {
        for (let i = 0; i < MAX_GROUP_REPLIES; i++) {
          setTyping({ who: "", text: "" });
          // Somebody always answers the player's message; later turns may end the round.
          const speaker = (await nextSpeaker(local, localChat)) ?? (i === 0 ? localChat.participants[0] : null);
          if (!speaker) break;
          setTyping({ who: speaker, text: "" });
          {
          const reply = await chatReply(local, map, localChat, speaker, (p) => setTyping({ who: speaker, text: p.text }));
          push(speaker, reply.text, reply.by);
        }
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTyping(null);
    }
  }

  async function toAction() {
    setBusyAction(true);
    setError(null);
    try {
      const action = await describeAction(state, chat);
      update((s) => {
        s.pending.push({ id: newId(s, "p"), text: action });
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyAction(false);
    }
  }

  return (
    <div className="panel-body chat-window">
      <div className="chat-head">
        <button className="link" onClick={onClose}>
          ← все переписки
        </button>
        <b>{chat.participants.map((p) => countryName(state, p)).join(", ")}</b>
      </div>
      <div className="messages" ref={scrollRef}>
        {chat.messages.length === 0 && <p className="muted small">Напишите первое послание. Собеседники ответят от лица своих правительств.</p>}
        {chat.messages.map((m) => (
          <div key={m.id} className={`msg ${m.from === "player" ? "mine" : "theirs"}`}>
            <div className="msg-head">
              <span className="dot" style={{ background: state.countries[m.from === "player" ? state.player : m.from]?.color }} />
              {m.from === "player" ? countryName(state, state.player) : countryName(state, m.from)}, {formatDate(m.date)}
            </div>
            <p className="pre">{m.text}</p>
            {m.by && <div className="msg-by">ответил: {m.by}</div>}
          </div>
        ))}
        {typing && (
          <div className="msg theirs">
            <div className="msg-head">{typing.who ? countryName(state, typing.who) : "Собеседники"}</div>
            <p className="pre">{typing.text || "пишет ответ..."}</p>
          </div>
        )}
      </div>
      {error && <div className="error-text small">{error}</div>}
      <textarea
        rows={2}
        value={text}
        disabled={locked}
        placeholder="Ваше послание (Ctrl+Enter для отправки)"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send();
        }}
      />
      <div className="row wrap">
        <button className="btn primary small" disabled={locked || !!typing || !text.trim()} onClick={send}>
          Отправить
        </button>
        <button className="btn small" disabled={locked || busyAction || chat.messages.length === 0} onClick={toAction}>
          {busyAction ? "Формулирую..." : "Оформить как приказ"}
        </button>
      </div>
    </div>
  );
}

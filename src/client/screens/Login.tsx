import { useState, type FormEvent } from "react";
import { api } from "../api";

export function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(username, password);
      onLogin();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen title-bg">
      <form className="login-card" onSubmit={submit}>
        <h1 className="brand">Strategia</h1>
        <p className="muted">Историческая стратегия с искусственным интеллектом</p>
        <label>
          Логин
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
        </label>
        <label>
          Пароль
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <div className="error-text">{error}</div>}
        <button className="btn primary" disabled={busy || !username || !password}>
          {busy ? "Вход..." : "Войти"}
        </button>
      </form>
    </div>
  );
}

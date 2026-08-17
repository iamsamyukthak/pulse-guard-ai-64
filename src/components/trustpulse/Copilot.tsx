import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bot, Loader2, Send, ShieldCheck } from "lucide-react";
import { copilotFn } from "@/lib/fraud.functions";

const SUGGESTIONS = [
  "Why was this blocked?",
  "What related accounts should I check?",
  "Could this be a false positive?",
  "Summarise the evidence for escalation",
];

type Msg = { role: "user" | "assistant"; content: string; provider?: string };

export function Copilot({ transactionId }: { transactionId: string }) {
  const ask = useServerFn(copilotFn);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (question: string) => {
    if (!question.trim() || busy) return;
    setMessages((m) => [...m, { role: "user", content: question }]);
    setInput("");
    setBusy(true);
    try {
      const res = await ask({ data: { transactionId, question } });
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.answer, provider: res.provider },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: e instanceof Error ? e.message : "The copilot is unavailable right now.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel flex h-full flex-col overflow-hidden">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Bot className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">AI Fraud Copilot</h2>
        <span className="ml-auto flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="h-3 w-3" /> evidence-grounded
        </span>
      </header>

      <div className="flex-1 space-y-3 overflow-auto px-4 py-3">
        <p className="rounded-md border border-border bg-surface-2/60 p-3 text-xs text-muted-foreground">
          The copilot reads the engine's evidence packet only. It never computes or changes the risk
          score — the backend risk engine is authoritative.
        </p>
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] rounded-lg bg-primary/15 px-3 py-2 text-sm"
                : "max-w-[92%] rounded-lg border border-border bg-surface-2/70 px-3 py-2 text-sm"
            }
          >
            <p className="whitespace-pre-wrap">{m.content}</p>
            {m.provider && (
              <span className="mt-1.5 block font-mono text-[10px] text-muted-foreground">
                {m.provider}
              </span>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> analysing evidence…
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => void send(s)}
              disabled={busy}
              className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this transaction…"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="inline-flex items-center rounded-md bg-primary px-3 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </section>
  );
}

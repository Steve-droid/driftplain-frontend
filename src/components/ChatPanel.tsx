import { BRAND_NAME } from "../lib/brand";
import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Terminal } from "lucide-react";
import type { ChatMessage, RetrievalTrace } from "../types/chat";
import { getChatHistory, postChat } from "../api/chat";
import { ApiError } from "../api/client";
import { ChatMessageBubble } from "./ChatMessageBubble";
import type { BubbleVariant } from "./ChatMessageBubble";

const MAX_CHARS = 2000; // mirrors the backend's question cap (avoids a 422 round-trip)

// A renderable message: a real turn from history/POST, or a local-only system line
// (429 notice / error) the panel injects in-thread.
interface UiMessage {
  key: string;
  role: ChatMessage["role"];
  text: string | null;
  trace: RetrievalTrace[];
  variant: BubbleVariant;
}

function fromHistory(m: ChatMessage): UiMessage {
  return {
    key: `m${m.id}`,
    role: m.role,
    text: m.text,
    trace: m.retrievalTrace,
    variant: "answer",
  };
}

export function ChatPanel({
  projectId,
  onUnauthorized,
  onForbidden,
}: {
  projectId: number;
  onUnauthorized?: () => void;
  onForbidden?: () => void;
}) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const localSeq = useRef(0); // stable keys for locally-appended messages
  const localKey = (p: string) => `${p}${(localSeq.current += 1)}`;
  const scrollRef = useRef<HTMLDivElement>(null);
  // Always holds the currently-selected project, so an in-flight answer issued for a
  // previous project can be dropped instead of landing in the new conversation.
  const activeProjectRef = useRef(projectId);

  // Load (or reload) the persisted conversation when the project changes. The first
  // assistant message is the server-seeded "explain my spend" opener.
  useEffect(() => {
    activeProjectRef.current = projectId;
    let live = true;
    setLoading(true);
    setLoadError(null);
    setMessages([]);
    setSending(false);
    getChatHistory(projectId)
      .then((res) => live && setMessages(res.messages.map(fromHistory)))
      .catch((e: unknown) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 401) onUnauthorized?.();
        else if (e instanceof ApiError && e.status === 403) {
          onForbidden?.();
          setLoadError("You don't have access to this project's chat.");
        }
        else if (e instanceof ApiError) setLoadError(e.message);
        else setLoadError("Could not reach the backend.");
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [projectId, onUnauthorized, onForbidden]);

  // Keep the latest message in view as the thread grows / while sending.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const trimmed = input.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_CHARS && !sending;

  function append(msg: UiMessage) {
    setMessages((prev) => [...prev, msg]);
  }

  async function handleSend() {
    if (!canSend) return;
    const question = trimmed;
    const reqProjectId = projectId; // the project this answer belongs to
    const isStale = () => activeProjectRef.current !== reqProjectId;
    append({ key: localKey("u"), role: "user", text: question, trace: [], variant: "answer" });
    setInput("");
    setSending(true);
    try {
      const res = await postChat(reqProjectId, question);
      if (isStale()) return; // user switched projects mid-request — drop the answer
      append({
        key: localKey("a"),
        role: "assistant",
        text: res.answer,
        trace: res.retrievalTrace,
        variant: "answer",
      });
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) {
        onUnauthorized?.();
        return;
      }
      if (isStale()) return; // stale failure — don't surface it in the new conversation
      if (e instanceof ApiError && e.status === 403) onForbidden?.();
      const notice =
        e instanceof ApiError && e.status === 429
          ? { text: "I've hit the model's hourly limit. Please try again shortly.", variant: "notice" as const }
          : e instanceof ApiError && e.status === 403
            ? { text: "You don't have access to this project's chat.", variant: "error" as const }
            : e instanceof ApiError
              ? { text: "Sorry, I couldn't answer that just now. Please try again.", variant: "error" as const }
              : { text: "Could not reach the backend.", variant: "error" as const };
      append({ key: localKey("s"), role: "assistant", text: notice.text, trace: [], variant: notice.variant });
    } finally {
      if (!isStale()) setSending(false); // a stale request must not touch the new project's state
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const nearLimit = input.length > MAX_CHARS - 200;

  return (
    <section className="card flex h-full min-w-0 flex-col gap-0 overflow-hidden p-0" aria-label="Grounded chat">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-signal/10 text-signal">
          <Terminal size={17} />
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-gray-100">
            Ask {BRAND_NAME}
          </div>
          <div className="mt-1 text-xs leading-relaxed text-muted">
            Legacy conversation · historical cost calculations and catalog
          </div>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={14} className="animate-spin" />
            Loading conversation…
          </div>
        )}

        {loadError && !loading && (
          <div className="rounded border border-risk/40 bg-risk/10 px-3 py-2 text-sm text-risk">
            {loadError}
          </div>
        )}

        {!loading && !loadError && messages.length === 0 && (
          <p className="text-sm text-muted">
            Ask about your spend, quality, or which models you're running.
          </p>
        )}

        <div className="flex flex-col gap-5">
          {messages.map((m) => (
            <ChatMessageBubble
              key={m.key}
              role={m.role}
              text={m.text}
              trace={m.trace}
              variant={m.variant}
            />
          ))}

          {sending && (
            <div className="flex items-center gap-2 rounded border border-border bg-panel-2 px-3 py-2 text-sm text-muted">
              <Loader2 size={13} className="animate-spin" />
              Thinking…
            </div>
          )}
        </div>
      </div>

      {/* composer */}
      <div className="border-t border-border p-4">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-canvas/40 px-3 py-3 focus-within:border-accent">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={MAX_CHARS}
            disabled={loading || !!loadError}
            placeholder="Ask a follow-up…"
            aria-label="Ask a question"
            className="max-h-28 min-w-0 flex-1 resize-none bg-transparent text-sm text-fg placeholder:text-faint focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend}
            aria-label="Send"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </div>
        {nearLimit && (
          <div className="mt-1 text-right text-[10px] text-faint num">
            {input.length}/{MAX_CHARS}
          </div>
        )}
      </div>
    </section>
  );
}

import { useState } from "react";
import { useParams } from "react-router-dom";
import { trpc } from "../trpc.js";
import { NotFoundPage } from "./NotFoundPage.js";

interface PendingMessage {
  key: string;
  text: string;
}

export function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const characterQuery = trpc.character.get.useQuery(
    { id: id ?? "" },
    { enabled: Boolean(id), retry: false },
  );
  const historyQuery = trpc.conversation.history.useQuery(
    { id: id ?? "" },
    { enabled: Boolean(id), retry: false },
  );
  const utils = trpc.useUtils();
  const sendMessage = trpc.conversation.sendMessage.useMutation();

  const [draft, setDraft] = useState("");
  // Tracked locally rather than via the mutation's own isPending, since a burst
  // of sends can have several sendMessage calls in flight at once and the
  // "composing" indicator must reflect all of them (ticket 17: client-only,
  // driven purely from request-pending state).
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!id) {
    return <NotFoundPage />;
  }

  if (characterQuery.isLoading) {
    return (
      <main>
        <p>Loading…</p>
      </main>
    );
  }

  if (characterQuery.error?.data?.code === "NOT_FOUND") {
    return <NotFoundPage />;
  }

  if (characterQuery.error) {
    return (
      <main>
        <p role="alert">Something went wrong.</p>
      </main>
    );
  }

  const character = characterQuery.data;
  if (!character) {
    return <NotFoundPage />;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setDraft("");
    setError(null);
    const key = crypto.randomUUID();
    setPending((prev) => [...prev, { key, text }]);

    try {
      await sendMessage.mutateAsync({ id: id as string, text });
    } catch {
      setError("Something went wrong sending that message. Please try again.");
    } finally {
      // History is refetched before the optimistic entry is dropped, so the
      // sent message never briefly disappears from the list mid-transition.
      await utils.conversation.history.invalidate({ id: id as string });
      setPending((prev) => prev.filter((message) => message.key !== key));
    }
  }

  const composing = pending.length > 0;

  return (
    <main>
      <h1>{character.name}</h1>
      <ul>
        {historyQuery.data?.map((message) => (
          <li key={message.id}>
            <strong>{message.sender === "user" ? "You" : character.name}:</strong> {message.text}
          </li>
        ))}
        {pending.map((message) => (
          <li key={message.key}>
            <strong>You:</strong> {message.text}
          </li>
        ))}
      </ul>

      {composing && <p>{character.name} is composing…</p>}
      {error && <p role="alert">{error}</p>}

      <form onSubmit={handleSubmit}>
        <label>
          Message
          <input value={draft} onChange={(e) => setDraft(e.target.value)} />
        </label>
        <button type="submit" disabled={!draft.trim()}>
          Send
        </button>
      </form>
    </main>
  );
}

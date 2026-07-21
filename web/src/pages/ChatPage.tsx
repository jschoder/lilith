import { useParams } from "react-router-dom";
import { trpc } from "../trpc.js";
import { NotFoundPage } from "./NotFoundPage.js";

export function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const characterQuery = trpc.character.get.useQuery(
    { id: id ?? "" },
    { enabled: Boolean(id), retry: false },
  );

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

  return (
    <main>
      <h1>{character.name}</h1>
      <p>{character.personalityDescription}</p>
    </main>
  );
}

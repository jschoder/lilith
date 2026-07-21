import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../trpc.js";

export function CreateCharacterPage() {
  const navigate = useNavigate();
  const avatarSetsQuery = trpc.character.listAvatarSets.useQuery();
  const createCharacter = trpc.character.create.useMutation();

  const [name, setName] = useState("");
  const [personalityDescription, setPersonalityDescription] = useState("");
  const [emotionalTendency, setEmotionalTendency] = useState("");
  const [drive, setDrive] = useState("");
  const [avatarSet, setAvatarSet] = useState<string | null>(null);

  const canSubmit =
    personalityDescription.trim().length > 0 &&
    emotionalTendency.trim().length > 0 &&
    drive.trim().length > 0 &&
    avatarSet !== null &&
    !createCharacter.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || avatarSet === null) return;

    const created = await createCharacter.mutateAsync({
      name: name.trim() || undefined,
      personalityDescription,
      emotionalTendency,
      drive,
      avatarSet,
    });
    navigate(`/chat/${created.id}`);
  }

  return (
    <main>
      <h1>Create a Character</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Name (leave blank to have one inferred)
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label>
          Personality description
          <textarea
            required
            value={personalityDescription}
            onChange={(e) => setPersonalityDescription(e.target.value)}
          />
        </label>

        <label>
          Emotional tendency
          <textarea
            required
            value={emotionalTendency}
            onChange={(e) => setEmotionalTendency(e.target.value)}
          />
        </label>

        <label>
          Drive
          <textarea required value={drive} onChange={(e) => setDrive(e.target.value)} />
        </label>

        <fieldset>
          <legend>Avatar set</legend>
          {avatarSetsQuery.isLoading && <p>Loading avatar sets…</p>}
          {avatarSetsQuery.error && <p role="alert">Could not load avatar sets.</p>}
          <div>
            {avatarSetsQuery.data?.map((set) => (
              <label key={set}>
                <input
                  type="radio"
                  name="avatarSet"
                  value={set}
                  checked={avatarSet === set}
                  onChange={() => setAvatarSet(set)}
                />
                {set}
              </label>
            ))}
          </div>
        </fieldset>

        {createCharacter.error && <p role="alert">{createCharacter.error.message}</p>}

        <button type="submit" disabled={!canSubmit}>
          {createCharacter.isPending ? "Creating…" : "Create"}
        </button>
      </form>
    </main>
  );
}

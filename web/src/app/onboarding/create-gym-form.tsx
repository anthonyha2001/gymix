"use client";

import { useActionState } from "react";
import { createGym, type CreateGymState } from "./actions";
import { Alert, Button, Field, inputClass } from "@/components/ui";

export function CreateGymForm() {
  const [state, action, pending] = useActionState<CreateGymState, FormData>(createGym, {});

  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Gym name">
        <input name="name" required minLength={2} maxLength={80} placeholder="e.g. Iron House Beirut" className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create my gym"}
      </Button>
    </form>
  );
}

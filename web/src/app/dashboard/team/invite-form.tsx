"use client";

import { useActionState } from "react";
import { inviteToGym, type InviteState } from "./actions";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { ROLE_LABELS, type GymRole } from "@/lib/roles";

export function InviteForm({ roles }: { roles: GymRole[] }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteToGym, {});

  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="grid gap-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <Field label="Email">
          <input name="email" type="email" required placeholder="name@example.com" className={inputClass} />
        </Field>
        <Field label="Role">
          <select name="role" defaultValue={roles.includes("trainer") ? "trainer" : roles[0]} className={inputClass}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Inviting…" : "Invite"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useDialogAction } from "@/components/dialog";
import { SearchSelect } from "@/components/search-select";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";

// Front desk subscribes a member to a monthly course.
export function SubscribeCourseForm({
  action,
  courses,
  defaultStart,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  courses: { id: string; label: string }[];
  defaultStart: string;
}) {
  const [state, formAction, pending] = useDialogAction(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Course">
        <SearchSelect name="class_id" required defaultValue="">
          <option value="" disabled>
            Choose a course
          </option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </SearchSelect>
      </Field>
      <Field label="Starts on" hint="One month from this date. They're booked into every session.">
        <input name="starts_on" type="date" required defaultValue={defaultStart} className={inputClass} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Subscribing…" : "Subscribe"}
        </Button>
      </div>
    </form>
  );
}

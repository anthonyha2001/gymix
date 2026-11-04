"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type AuthFormState } from "./actions";
import { Alert, Button, Field, inputClass } from "@/components/ui";

export function LoginForm({ next, email }: { next?: string; email?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signIn, {});

  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Email, phone or member code">
        <input name="email" type="text" autoComplete="username" autoCapitalize="none" required defaultValue={state.email ?? email} className={inputClass} />
      </Field>
      <Field label="Password">
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <p className="-mt-2 text-right text-sm">
        <Link href="/forgot-password" className="text-muted underline underline-offset-4 hover:text-ink">
          Forgot password?
        </Link>
      </p>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}

export function SignupForm({ next, email }: { next?: string; email?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUp, {});

  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Full name">
        <input name="full_name" autoComplete="name" required minLength={2} maxLength={120} className={inputClass} />
      </Field>
      <Field label="Email" hint="If your gym invited you, use the same email they have.">
        <input name="email" type="email" autoComplete="email" required defaultValue={state.email ?? email} className={inputClass} />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <input name="password" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}

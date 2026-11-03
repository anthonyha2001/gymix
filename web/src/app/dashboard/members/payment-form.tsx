"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import { PaymentFields } from "./payment-fields";

export function PaymentForm({
  action,
  balance,
  rate,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  balance: number;
  rate: number;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [amount, setAmount] = useState(balance.toFixed(2));

  return (
    <form action={formAction} className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <PaymentFields amountUsd={amount} onAmountChange={setAmount} rate={rate} />
      <Field label="Note (optional)">
        <input name="note" maxLength={200} className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Record payment"}
      </Button>
    </form>
  );
}

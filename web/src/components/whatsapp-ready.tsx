import { Suspense, type ReactNode } from "react";
import { whatsappReady } from "@/lib/whatsapp";

// Renders `render(ready)` once Gymix knows whether this gym can send WhatsApp
// messages, inside its own boundary so the rest of the page never waits for
// it: until then it renders as "not ready" (copy buttons only).
export function WithWhatsApp({ gymId, render }: { gymId: string; render: (ready: boolean) => ReactNode }) {
  return (
    <Suspense fallback={render(false)}>
      <Resolved gymId={gymId} render={render} />
    </Suspense>
  );
}

async function Resolved({ gymId, render }: { gymId: string; render: (ready: boolean) => ReactNode }) {
  return render(await whatsappReady(gymId));
}

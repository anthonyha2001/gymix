"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Search, XCircle } from "lucide-react";
import { Badge, Card, buttonClass, inputClass } from "@/components/ui";
import { MEMBER_STATUS, formatDate, formatUSD, type MemberStatus } from "@/lib/format";
import { checkIn, searchMembers, type CheckInResult, type MemberHit } from "../members/actions";

const CODE_RE = /^[0-9A-F]{10}$/i;

// Front desk: type a name/phone (or swipe a key fob, which types its code + Enter)
// and check the member in. Taps on the NFC sticker show up in the live feed.
export function CheckInStation() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<MemberHit[]>([]);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function search(value: string) {
    setQuery(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setHits(value.trim().length >= 2 ? await searchMembers(value) : []);
    }, 200);
  }

  function run(target: { code?: string; memberId?: string }) {
    startTransition(async () => {
      setResult(await checkIn(target));
      setQuery("");
      setHits([]);
      input.current?.focus();
    });
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = query.trim();
          if (CODE_RE.test(value)) run({ code: value });
          else if (hits.length === 1) run({ memberId: hits[0].id });
        }}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input
            ref={input}
            autoFocus
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Type a member's name or phone…"
            aria-label="Find member"
            className={`${inputClass} h-14 pl-12 text-lg`}
          />
        </div>
      </form>

      {hits.length > 0 && (
        <Card>
          <ul className="divide-y divide-line">
            {hits.map((m) => {
              const s = MEMBER_STATUS[m.status as MemberStatus];
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{m.fullName}</p>
                    <p className="text-xs text-muted">
                      {[m.phone, m.planName && `${m.planName} until ${formatDate(m.endsOn)}`].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <Badge tone={s.tone}>{s.label}</Badge>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run({ memberId: m.id })}
                    className={buttonClass("primary", "h-9")}
                  >
                    Check in
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {result && <ResultCard result={result} />}
    </div>
  );
}

function ResultCard({ result }: { result: CheckInResult }) {
  if (result.error) {
    return <Card className="border-danger/30 bg-danger-soft p-5 text-danger">{result.error}</Card>;
  }
  const ok = result.allowed;
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <Card
      role="status"
      className={`flex items-center gap-4 p-5 ${ok ? "border-success/30 bg-success-soft" : "border-danger/30 bg-danger-soft"}`}
    >
      <Icon className={`size-12 shrink-0 ${ok ? "text-success" : "text-danger"}`} />
      <div className="min-w-0">
        <p className={`text-xl font-semibold ${ok ? "text-success" : "text-danger"}`}>
          {ok ? (result.alreadyIn ? "Already checked in" : "Welcome!") : "Not allowed in"}
        </p>
        <p className="text-lg font-medium text-ink">{result.fullName ?? "Unknown member"}</p>
        <p className="text-sm text-ink/70">
          {ok
            ? [
                result.planName,
                result.endsOn && `until ${formatDate(result.endsOn)}`,
                result.visitsLeft !== null && `${result.visitsLeft} visits left`,
              ]
                .filter(Boolean)
                .join(" · ")
            : result.reason}
        </p>
        {result.balanceUsd > 0 && (
          <p className="mt-1 text-sm font-medium text-danger">Owes {formatUSD(result.balanceUsd)}</p>
        )}
      </div>
    </Card>
  );
}

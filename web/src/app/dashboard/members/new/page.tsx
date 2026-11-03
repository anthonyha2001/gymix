import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, PageHeader, Skeleton } from "@/components/ui";
import { BILLING_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createMember } from "../actions";
import { MemberForm } from "../member-form";

export const metadata: Metadata = { title: "Add member" };

export default function NewMemberPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/dashboard/members" className="text-sm text-muted hover:text-ink">
        ← Members
      </Link>
      <PageHeader title="Add member" description="Only the name is required. You can sell a membership on the next screen." />
      <Card className="p-5">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <Gate />
        </Suspense>
      </Card>
    </div>
  );
}

async function Gate() {
  await requireStaff(BILLING_ROLES);
  return <MemberForm action={createMember} submitLabel="Add member" showInvite />;
}

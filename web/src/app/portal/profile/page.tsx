import type { Metadata } from "next";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { Card, SectionTitle, Skeleton } from "@/components/ui";
import { mediaUrl } from "@/lib/exercises";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadTrainingPlan } from "@/lib/training-plan";
import { signOut } from "../../(auth)/actions";
import { NotificationPrefsForm, PasswordForm, PhotoForm, ProfileForm, ShakeSetting, TrainingDaysForm } from "./forms";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <Suspense fallback={<Skeleton className="h-[40rem]" />}>
        <Profile />
      </Suspense>
    </div>
  );
}

async function Profile() {
  const { viewer, membership } = await requireMember();
  const supabase = await createClient();
  const [{ data: profile }, { data: me }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, email, avatar_path, notify_prefs, language").eq("id", viewer.id).single(),
    supabase.from("members").select("id").eq("gym_id", membership.gymId).eq("user_id", viewer.id).maybeSingle(),
  ]);
  const plan = me ? await loadTrainingPlan(supabase, me.id, membership.timezone) : null;
  const name = profile?.full_name || viewer.fullName || "";
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "G";
  const prefs = (profile?.notify_prefs ?? {}) as Record<string, boolean>;

  return (
    <>
      <Card className="space-y-5 p-5">
        <PhotoForm photoUrl={profile?.avatar_path ? mediaUrl(profile.avatar_path) : null} initials={initials} />
        <div className="border-t border-line pt-5">
          <h2 className="mb-3 font-semibold">Personal information</h2>
          <ProfileForm fullName={name} phone={profile?.phone ?? ""} email={profile?.email ?? viewer.email} />
        </div>
      </Card>

      <Card id="training-days" className="scroll-mt-20 p-5">
        <h2 className="font-semibold">Training days</h2>
        <p className="mb-4 text-sm text-muted">Pick the days you come to {membership.gymName}, and which workout each day is.</p>
        {plan ? (
          <TrainingDaysForm
            initial={plan.days}
            programDays={plan.programDays.map((d) => ({ id: d.id, name: d.name, programName: d.programName }))}
          />
        ) : (
          <p className="text-sm text-muted">Your account isn&apos;t linked to a membership yet.</p>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Notifications</h2>
        <NotificationPrefsForm initial={prefs} />
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">App settings</h2>
        <div className="divide-y divide-line">
          <div className="flex items-center justify-between gap-4 py-3 text-sm">
            <span>
              <span className="block font-medium">Language</span>
              <span className="text-muted">The app is in English.</span>
            </span>
            <span className="rounded-lg bg-canvas px-3 py-1.5 font-medium">English</span>
          </div>
          <ShakeSetting />
        </div>
      </Card>

      <Card>
        <SectionTitle>Login and security</SectionTitle>
        <div className="space-y-5 border-t border-line p-5">
          <PasswordForm />
          <form action={signOut} className="border-t border-line pt-5">
            <button className="inline-flex items-center gap-2 text-sm font-medium text-danger hover:underline">
              <LogOut className="size-4" /> Log out
            </button>
          </form>
        </div>
      </Card>
    </>
  );
}

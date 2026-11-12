import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal-page";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of use", description: "The rules for using Gymix, for gyms and their members." };

const contact = CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> : <>the contact address in the Gymix app store listing</>;

const sections: LegalSection[] = [
  {
    id: "about",
    title: "About these terms",
    body: <p>These terms cover using Gymix, the website and the app. By creating an account or using the app, you agree to them. If you&apos;re a member, your gym&apos;s own rules and contract also apply to your membership.</p>,
  },
  {
    id: "account",
    title: "Your account",
    body: (
      <ul>
        <li>Keep your login to yourself. You&apos;re responsible for what&apos;s done with it.</li>
        <li>Give true details, and keep them up to date.</li>
        <li>You must be 13 or older to have an account.</li>
        <li>You can delete your account at any time from Account → Delete account.</li>
      </ul>
    ),
  },
  {
    id: "members",
    title: "For members",
    body: (
      <ul>
        <li>Your membership, prices, refunds and gym rules are agreed between you and your gym, not Gymix.</li>
        <li>Door stickers and codes are for your own entry only. Don&apos;t share them or let others in with them.</li>
        <li>Workouts, programs and nutrition plans are guidance, not medical advice. Check with a doctor before starting a new training plan, and stop if something hurts.</li>
      </ul>
    ),
  },
  {
    id: "gyms",
    title: "For gyms",
    body: (
      <ul>
        <li>You&apos;re responsible for the data you record about your members, and for having their permission where the law requires it.</li>
        <li>Subscriptions are billed as shown on <Link href="/pricing">the pricing page</Link>. If a payment is missed, Gymix may limit your account after a reminder; your data stays yours.</li>
        <li>You can export your data and close your gym&apos;s account at any time.</li>
      </ul>
    ),
  },
  {
    id: "fair",
    title: "Fair use",
    body: (
      <ul>
        <li>Don&apos;t try to break into, overload or copy Gymix, or read data that isn&apos;t yours.</li>
        <li>Don&apos;t use chat to harass anyone. Gyms can remove people who do.</li>
        <li>We may suspend accounts that break these rules.</li>
      </ul>
    ),
  },
  {
    id: "service",
    title: "The service",
    body: (
      <>
        <p>We work hard to keep Gymix running and your data safe, and we keep improving it, so features may change. Doors, readers and phones depend on hardware and networks we don&apos;t control; always keep a manual way into your gym.</p>
        <p>As far as the law allows, Gymix isn&apos;t liable for indirect losses, and our total liability to a gym is limited to what it paid us in the last 12 months.</p>
      </>
    ),
  },
  {
    id: "law",
    title: "Law and contact",
    body: (
      <p>
        These terms are governed by the laws of Lebanon. If we change them in a way that matters, we&apos;ll tell you in the app first. Questions: {contact}. See also our <Link href="/privacy">privacy policy</Link>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return <LegalPage eyebrow="Terms" title="The rules, short and clear." intro={<p>What you can expect from Gymix, and what we expect from you.</p>} updated={LEGAL_UPDATED} sections={sections} />;
}

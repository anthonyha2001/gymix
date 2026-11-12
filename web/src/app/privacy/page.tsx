import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal-page";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy policy", description: "What Gymix collects, why, who it's shared with, and your rights." };

const contact = CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> : <>the contact address in the Gymix app store listing</>;

const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <>
        <p>
          Gymix is software that gyms use to run their business: memberships, payments, check-ins, classes, doors and a member app. Each gym decides what it records about its members; Gymix
          stores and processes it for them.
        </p>
        <p>
          For your gym membership, your <b>gym</b> is responsible for your data and Gymix acts on its behalf. For your Gymix login and the app itself, <b>Gymix</b> is responsible.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <ul>
        <li><b>Account:</b> your name, email or phone number, password (stored scrambled, never readable), and profile photo if you add one.</li>
        <li><b>Membership:</b> your plan, dates, payments and receipts, as recorded by your gym.</li>
        <li><b>Visits:</b> when you check in and out, and how (desk, QR code, door sticker, card or fingerprint reader).</li>
        <li><b>Training:</b> workouts, sets, programs, body measurements, nutrition plans and challenges you join.</li>
        <li><b>Messages:</b> chats between you and your gym&apos;s staff.</li>
        <li><b>Device:</b> basic technical details (browser, app version, rough country from your connection) to keep the service secure and working.</li>
        <li><b>Site analytics, if you accept them:</b> which pages you visit, for how long, how far you scroll, which buttons you click, and the city your connection comes from. Gymix&apos;s own, never shared or used for ads. Choose &quot;Essential only&quot; and none of it is recorded.</li>
      </ul>
    ),
  },
  {
    id: "location",
    title: "Location, motion and camera",
    body: (
      <>
        <p>These are only used when you allow them, and only for the feature that asks:</p>
        <ul>
          <li><b>Location:</b> if your gym turns on &quot;phone must be at the gym&quot;, your phone&apos;s position is checked when you tap a door sticker, and every few minutes while the app is open at the gym, to keep the live count right. Gymix stores whether you were at the gym and the distance, not a history of where you go. It never tracks you when the app is closed.</li>
          <li><b>Motion:</b> shake-to-start and the dropped-phone animation read the motion sensor on your phone only. Nothing is sent.</li>
          <li><b>Camera:</b> used to scan QR codes. Images aren&apos;t stored.</li>
          <li><b>NFC:</b> used to read door and machine stickers, or to write them (staff).</li>
        </ul>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <ul>
        <li>To run your membership: check you in, open doors, record payments and remind you before your plan ends.</li>
        <li>To run the app: your programs, progress, challenges and messages.</li>
        <li>To keep Gymix safe: preventing fraud and misuse, and fixing errors.</li>
        <li>We don&apos;t sell your data, and we don&apos;t show you ads.</li>
      </ul>
    ),
  },
  {
    id: "share",
    title: "Who we share it with",
    body: (
      <>
        <p>Your data is visible to your gym&apos;s staff, according to their role. Other members only see what you choose (for example your first name and initial on a challenge leaderboard). We use these providers to run Gymix:</p>
        <ul>
          <li><b>Supabase:</b> database, logins and login emails.</li>
          <li><b>Vercel:</b> hosting the website and app.</li>
          <li><b>Meta (WhatsApp Business):</b> if your gym sends you WhatsApp messages from Gymix.</li>
          <li><b>OpenStreetMap:</b> map pictures and address search, for gym locations.</li>
          <li><b>Payment providers</b> your gym connects, when you pay online.</li>
        </ul>
        <p>We share data with authorities only when the law requires it.</p>
      </>
    ),
  },
  {
    id: "keep",
    title: "How long we keep it",
    body: (
      <>
        <p>We keep your data while you have an account. When you delete your account, your login and personal app data are deleted at once.</p>
        <p>Your gym may keep your membership, payment and visit records for as long as it needs them for its accounts and the law.</p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <ul>
        <li><b>See and download</b> your data: Account → Download my data.</li>
        <li><b>Correct</b> it: edit your profile, or ask your gym.</li>
        <li><b>Delete</b> your account: Account → Delete account, inside the app.</li>
        <li><b>Turn off</b> location, motion, camera and notifications at any time in your phone&apos;s settings.</li>
        <li>Ask us anything, or object to how we use your data, at {contact}.</li>
      </ul>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: <p>Data is encrypted on its way to and from Gymix. Each gym&apos;s data is kept apart by rules in the database itself, so one gym can never read another&apos;s. Door stickers and devices use secret, changeable codes.</p>,
  },
  {
    id: "children",
    title: "Children",
    body: <p>Gymix accounts are for people aged 13 and over. Gyms that train younger members manage their records without giving them an app login.</p>,
  },
  {
    id: "changes",
    title: "Changes and contact",
    body: (
      <p>
        If we change this policy in a way that matters, we&apos;ll tell you in the app before it applies. Questions: {contact}.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return <LegalPage eyebrow="Privacy" title="Your data, plainly." intro={<p>What Gymix collects, why, who sees it, and how to download or delete it. No legal maze.</p>} updated={LEGAL_UPDATED} sections={sections} />;
}

// The demo guide's stops, in order: what each page is for and a few things to
// try with the sample data (Atlas Fitness). Pages behind a feature switch only
// appear when that page is in the gym's menu. Client-safe.

export type GuideStop = {
  path: string;
  // Also matches deeper pages (e.g. a member's profile under /dashboard/members/…).
  match?: "exact" | "prefix";
  title: string;
  body: string;
  tryThis: string[];
};

export const OWNER_STOPS: GuideStop[] = [
  {
    path: "/dashboard",
    match: "exact",
    title: "Your gym today",
    body: "The overview shows who's active, today's check-ins, memberships ending this week, what you collected this month and what members owe.",
    tryThis: ["See whose membership ends this week, then open one to renew it", "\"Owed by members\" is money still to collect: Billing shows who"],
  },
  {
    path: "/dashboard/check-in",
    title: "Check-in",
    body: "Members tap their phone on the Gymix sticker at the entrance. Here the front desk checks anyone in by name or member code, and sees every entry today.",
    tryThis: ["Search \"Rami\" and check him in", "Try \"Tarek Mansour\": his membership expired, so Gymix refuses and says why"],
  },
  {
    path: "/dashboard/live",
    title: "Live",
    body: "How many people are inside right now against your capacity, today's flow, and the hours that are usually busy. Members see it in their app too.",
    tryThis: ["Look at the busy hours: evenings are the rush"],
  },
  {
    path: "/dashboard/reception",
    title: "Self-service reception",
    body: "A tablet at the entrance where members check themselves in, and visitors join and pay, while the desk confirms payments here.",
    tryThis: ["Add a kiosk and open its link in a new tab"],
  },
  {
    path: "/dashboard/members",
    match: "exact",
    title: "Members",
    body: "Everyone at your gym with their status and balance. Filter by active, expired, frozen or owing money, and add new members in seconds.",
    tryThis: ["Filter by \"Owing money\"", "Add a member with just a name", "Open Lynn Tannous: her membership is paused"],
  },
  {
    path: "/dashboard/members/",
    match: "prefix",
    title: "A member's profile",
    body: "Everything about one member: membership, payments and invoices, check-ins, their program, measurements and chat. Sell, renew, freeze or refund from here.",
    tryThis: ["Fadi still owes $25: record the rest of his payment on the Billing tab", "Renew or sell a membership (try a discount)", "Freeze the membership, then unfreeze it"],
  },
  {
    path: "/dashboard/schedule",
    title: "Schedule",
    body: "Classes, monthly courses and personal training on a calendar. Members book from their app, and you see who's coming.",
    tryThis: ["Open Spinning or Boxing to see who booked", "Add a new class"],
  },
  {
    path: "/dashboard/messages",
    title: "Messages",
    body: "Private chat with members, plus the automatic WhatsApp messages each member was sent.",
    tryThis: ["Karim is asking about the whey: reply to him"],
  },
  {
    path: "/dashboard/programs",
    title: "Programs",
    body: "Build training programs from 800+ exercises with how-tos, save templates, and answer members' program requests.",
    tryThis: ["Open \"Beginner full body\" and add an exercise", "Start a program for a member from the template"],
  },
  {
    path: "/dashboard/machines",
    title: "Equipment",
    body: "Your machines and free weights. Each machine gets a sticker or QR code: members scan it to see how to use it and log their sets.",
    tryThis: ["Open the leg press", "Add a machine"],
  },
  {
    path: "/dashboard/billing",
    title: "Billing",
    body: "Every invoice and payment, in dollars or lira, by cash, Whish, OMT, card or transfer. See who owes, void mistakes and refund.",
    tryThis: ["Open the \"Owing\" tab", "Look at \"Payments\" to see how members paid"],
  },
  {
    path: "/dashboard/shop",
    title: "Shop",
    body: "Sell supplements, drinks and merch: scan barcodes, charge in cash or card or to a member's account, and track stock and profit.",
    tryThis: ["Sell a water and a protein bar", "Creatine is low on stock: record a delivery"],
  },
  {
    path: "/dashboard/plans",
    title: "Membership plans",
    body: "What you sell at the desk: monthly, yearly, multi-month or a punch card with a visit limit.",
    tryThis: ["Create a \"Ladies Monthly\" plan", "Edit the price of a plan"],
  },
  {
    path: "/dashboard/access",
    title: "Door access",
    body: "Connect ZKTeco or Hikvision doors and turnstiles: paid members get in, expired or unpaid ones are blocked automatically.",
    tryThis: ["Add a device to see the setup steps"],
  },
  {
    path: "/dashboard/screens",
    title: "Screens",
    body: "Turn any TV into a gym screen: today's classes, the leaderboard, how busy it is, and your own news and offers.",
    tryThis: ["Open the Lobby TV preview", "Add a slide with an offer"],
  },
  {
    path: "/dashboard/team",
    title: "Team",
    body: "Invite managers, front desk and trainers. Each role sees only what it needs: trainers never see money.",
    tryThis: ["Look at the pending invites", "Invite a trainer"],
  },
  {
    path: "/dashboard/settings",
    title: "Settings",
    body: "Your gym's name and lira rate, renewal reminders, which pages members see in their app, WhatsApp, and the tap-to-check-in sticker.",
    tryThis: ["Open the WhatsApp tab and look at the message log", "Hide a page from the member app"],
  },
];

export const MEMBER_STOPS: GuideStop[] = [
  {
    path: "/portal",
    match: "exact",
    title: "Karim's app",
    body: "This is what your members see on their phone, installed from a link with no app store. Membership, today's workout, how busy the gym is.",
    tryThis: ["Look at the membership card and today's workout"],
  },
  {
    path: "/portal/train",
    title: "Train",
    body: "Members start today's workout from their program and log every set. Gymix tracks personal records.",
    tryThis: ["Start the workout and log a set"],
  },
  {
    path: "/portal/programs",
    title: "Programs",
    body: "The program from their trainer, their own programs, and requests for a new one.",
    tryThis: ["Open \"Strength foundations\""],
  },
  {
    path: "/portal/schedule",
    title: "Classes",
    body: "Members book and cancel classes themselves. The gym sees the bookings straight away.",
    tryThis: ["Book a class this week"],
  },
  {
    path: "/portal/progress",
    title: "Progress",
    body: "Body measurements over time and workout history, with records highlighted.",
    tryThis: ["Look at the weight and body fat trend"],
  },
  {
    path: "/portal/messages",
    title: "Chat",
    body: "Members message the gym directly: no personal numbers, everything stays in one place.",
    tryThis: ["Send a message, then switch back and answer it as the owner"],
  },
  {
    path: "/portal/profile",
    title: "Profile",
    body: "Login details, the member code for the kiosk and desk, and privacy choices like hiding from the leaderboard.",
    tryThis: ["Look at the member QR code"],
  },
];

// The stop for this page: the most specific match.
export function stopIndex(stops: GuideStop[], pathname: string) {
  let best = -1;
  let bestLen = -1;
  stops.forEach((s, i) => {
    const hit = s.match === "prefix" ? pathname.startsWith(s.path) : s.match === "exact" ? pathname === s.path : pathname === s.path || pathname.startsWith(`${s.path}/`);
    if (hit && s.path.length > bestLen) {
      best = i;
      bestLen = s.path.length;
    }
  });
  return best;
}

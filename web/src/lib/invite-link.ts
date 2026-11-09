// Client-safe helpers for invite links and WhatsApp numbers.

// Turns a Lebanese-style phone number into WhatsApp's international format:
// "71 123 456" / "03 123456" / "+961 71 123 456" / "00961…" -> "96171123456".
export function waNumber(phone: string | null | undefined) {
  let d = (phone ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("961")) return d;
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 7 || d.length === 8) return `961${d}`;
  return d.length >= 10 ? d : null;
}

export function memberInviteMessage(firstName: string, gymName: string, url: string) {
  return (
    `Hi ${firstName}, ${gymName} has set up your Gymix member account.\n\n` +
    `See your membership, program and invoices, book classes and check in with a tap of your phone.\n\n` +
    `Open your portal (one tap, nothing to sign up for): ${url}`
  );
}

export function staffInviteMessage(gymName: string, roleLabel: string, url: string) {
  return `Hi, you've been invited to join ${gymName} on Gymix as ${roleLabel}.\n\nCreate your account here: ${url}`;
}

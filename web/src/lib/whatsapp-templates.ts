// The Gymix WhatsApp templates (English, Utility). Gymix creates them on a
// gym's own WhatsApp Business account when it connects, and on the Gymix
// account from the super admin console. {{1}}, {{2}}… are filled in order.
// Meta doesn't accept a template that starts or ends with a variable.
export const TEMPLATES = {
  renewal: "gymix_renewal_reminder",
  payment: "gymix_payment_received",
  welcome: "gymix_member_welcome",
  invite: "gymix_member_welcome",
  login: "gymix_login_details",
} as const;

export type WhatsAppKind = keyof typeof TEMPLATES;

const TEXT: Record<WhatsAppKind, string> = {
  renewal: "Hi {{1}}, your {{2}} membership ends on {{3}}. Renew at the front desk to keep training.",
  payment: "Hi {{1}}, {{2}} received your payment of {{3}}. Thank you!",
  welcome: "Hi {{1}}, {{2}} has set up your Gymix account. Open your member app here: {{3}} (one tap, nothing to sign up for).",
  invite: "Hi {{1}}, {{2}} has set up your Gymix account. Open your member app here: {{3}} (one tap, nothing to sign up for).",
  login: "Hi {{1}}, here is your {{2}} member app login. Log in with {{3}} and the password {{4}} at {{5}} and keep this message private.",
};

// The template text, or (with params) what the member actually reads.
export function templateBody(kind: WhatsAppKind, params: string[] | null) {
  return params ? TEXT[kind].replace(/\{\{(\d)\}\}/g, (_, n) => params[Number(n) - 1] ?? "") : TEXT[kind];
}

export const KIND_LABELS: Record<WhatsAppKind, string> = {
  renewal: "Renewal reminder",
  payment: "Payment receipt",
  welcome: "Welcome",
  invite: "Invite link",
  login: "Login details",
};

// Each template once (the invite shares the welcome template).
export const TEMPLATE_LIST = [
  { name: TEMPLATES.renewal, label: "Renewal reminders" },
  { name: TEMPLATES.payment, label: "Payment receipts" },
  { name: TEMPLATES.welcome, label: "Welcome and invite links" },
  { name: TEMPLATES.login, label: "Login details" },
];

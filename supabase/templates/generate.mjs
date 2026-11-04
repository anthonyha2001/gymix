// Generates the Gymix auth emails in this folder. Run after editing:
//   node supabase/templates/generate.mjs
// Supabase fills in {{ .SiteURL }}, {{ .TokenHash }}, {{ .Email }}, {{ .NewEmail }}
// and {{ .Token }}. Links go to /auth/confirm, which verifies the token.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const INK = "#0d1117";
const LIME = "#c8f135";
const MUTED = "#5d6470";
const LINE = "#e2e4de";
const CANVAS = "#f4f5f2";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const link = (type, next) =>
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}${next ? `&next=${encodeURIComponent(next)}` : ""}`;

function button(href, label) {
  return `
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;">
                        <tr>
                          <td align="center" bgcolor="${LIME}" style="border-radius:12px;">
                            <a href="${href}" target="_blank" style="display:inline-block; padding:16px 36px; font-family:${FONT}; font-size:16px; font-weight:700; color:${INK}; text-decoration:none; border-radius:12px;">${label} &rarr;</a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:28px 0 6px; font-size:13px; line-height:20px; color:${MUTED};">Button not working? Copy this link into your browser:</p>
                      <p style="margin:0; font-size:12px; line-height:18px; word-break:break-all;"><a href="${href}" target="_blank" style="color:${MUTED}; text-decoration:underline;">${href.replace(/&/g, "&amp;")}</a></p>`;
}

function codeBox(label) {
  return `
                      <p style="margin:8px 0 10px; font-size:13px; line-height:20px; color:${MUTED};">${label}</p>
                      <div style="display:inline-block; padding:16px 28px; background-color:${CANVAS}; border:1px solid ${LINE}; border-radius:12px; font-family:'SFMono-Regular', Menlo, Consolas, monospace; font-size:30px; font-weight:700; letter-spacing:8px; color:${INK};">{{ .Token }}</div>`;
}

function steps(items) {
  const rows = items
    .map(
      ([title, body], i) => `
                        <tr>
                          <td valign="top" style="padding:0 14px 16px 0; width:28px;">
                            <div style="width:28px; height:28px; border-radius:14px; background-color:${INK}; color:${LIME}; font-family:${FONT}; font-size:13px; font-weight:700; line-height:28px; text-align:center;">${i + 1}</div>
                          </td>
                          <td valign="top" style="padding:3px 0 16px; font-family:${FONT}; font-size:14px; line-height:21px; color:${MUTED};">
                            <strong style="color:${INK};">${title}</strong><br />${body}
                          </td>
                        </tr>`,
    )
    .join("");
  return `
                  <tr>
                    <td style="padding:8px 40px 24px; border-top:1px solid ${LINE};">
                      <p style="margin:24px 0 16px; font-family:${FONT}; font-size:12px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:${MUTED};">What happens next</p>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rows}
                      </table>
                    </td>
                  </tr>`;
}

function email({ title, preview, eyebrow, heading, intro, action, after = "", note }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light" />
    <title>${title}</title>
  </head>
  <body style="margin:0; padding:0; background-color:${CANVAS}; -webkit-text-size-adjust:100%;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${preview}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CANVAS};">
      <tr>
        <td align="center" style="padding:32px 12px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
            <tr>
              <td style="background-color:${INK}; border-radius:20px 20px 0 0; padding:28px 40px 36px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;"><img src="{{ .SiteURL }}/icons/192" width="40" height="40" alt="" style="display:block; border:0; border-radius:10px;" /></td>
                    <td style="vertical-align:middle; padding-left:12px; font-family:${FONT}; font-size:22px; font-weight:800; color:#ffffff; letter-spacing:-0.5px;">Gymix</td>
                  </tr>
                </table>
                <p style="margin:32px 0 10px; font-family:${FONT}; font-size:12px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:${LIME};">${eyebrow}</p>
                <h1 style="margin:0; font-family:${FONT}; font-size:28px; line-height:34px; font-weight:800; letter-spacing:-0.5px; color:#ffffff;">${heading}</h1>
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff; border:1px solid ${LINE}; border-top:0; border-radius:0 0 20px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding:32px 40px 32px; font-family:${FONT}; color:${INK};">
                      <p style="margin:0 0 20px; font-size:16px; line-height:25px; color:${INK};">${intro}</p>${action}
                    </td>
                  </tr>${after}
                  <tr>
                    <td style="padding:18px 40px; background-color:#fafbf8; border-top:1px solid ${LINE}; border-radius:0 0 20px 20px; font-family:${FONT}; font-size:13px; line-height:20px; color:${MUTED};">${note}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 16px 0; font-family:${FONT}; font-size:12px; line-height:18px; color:#8a909a;">
                Gymix, the operating system for gyms in Lebanon<br />
                <a href="{{ .SiteURL }}" target="_blank" style="color:#8a909a; text-decoration:underline;">Visit Gymix</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

const IGNORE = "If this wasn't you, you can safely ignore this email.";

export const TEMPLATES = {
  confirmation: {
    subject: "Confirm your email to start your free trial",
    html: email({
      title: "Confirm your email",
      preview: "One click and your Gymix account is ready.",
      eyebrow: "Welcome to Gymix",
      heading: "One click and you're in.",
      intro: `Thanks for signing up. Confirm that <strong>{{ .Email }}</strong> is your email address and we'll take you straight to setting up your gym.`,
      action: button(link("email"), "Confirm my email"),
      after: steps([
        ["Name your gym", "It takes ten seconds, and your free trial starts right away."],
        ["Add your plans and team", "Monthly, yearly or visit packs, in dollars or lira."],
        ["Invite your members on WhatsApp", "They tap in at the door with their phone."],
      ]),
      note: `This link works once and expires in 1 hour. ${IGNORE}`,
    }),
  },
  recovery: {
    subject: "Reset your Gymix password",
    html: email({
      title: "Reset your password",
      preview: "Choose a new password for your Gymix account.",
      eyebrow: "Password reset",
      heading: "Let's get you back in.",
      intro: `Someone asked to reset the password for <strong>{{ .Email }}</strong>. Click below to choose a new one.`,
      action: button(link("recovery", "/reset-password"), "Choose a new password"),
      note: `This link works once and expires in 1 hour. If you didn't ask for this, your password stays the same and you can ignore this email.`,
    }),
  },
  magic_link: {
    subject: "Your Gymix sign-in link",
    html: email({
      title: "Sign in to Gymix",
      preview: "Your one-time link to sign in to Gymix.",
      eyebrow: "Sign in",
      heading: "Your sign-in link is here.",
      intro: `Click below to sign in to Gymix as <strong>{{ .Email }}</strong>. No password needed.`,
      action: button(link("magiclink"), "Sign in to Gymix"),
      note: `This link works once and expires in 1 hour. ${IGNORE}`,
    }),
  },
  email_change: {
    subject: "Confirm your new email for Gymix",
    html: email({
      title: "Confirm your new email",
      preview: "Confirm the new email address for your Gymix account.",
      eyebrow: "Email change",
      heading: "Confirm your new email.",
      intro: `You asked to change your Gymix email from <strong>{{ .Email }}</strong> to <strong>{{ .NewEmail }}</strong>. Confirm it below.`,
      action: button(link("email_change"), "Confirm new email"),
      note: `Until you confirm, you keep signing in with your current email. ${IGNORE}`,
    }),
  },
  invite: {
    subject: "You've been invited to Gymix",
    html: email({
      title: "You're invited to Gymix",
      preview: "Accept your invitation to Gymix.",
      eyebrow: "Invitation",
      heading: "You've been invited to Gymix.",
      intro: `Click below to accept the invitation for <strong>{{ .Email }}</strong> and open Gymix.`,
      action: button(link("invite"), "Accept invitation"),
      note: `This link works once and expires in 24 hours. ${IGNORE}`,
    }),
  },
  reauthentication: {
    subject: "Your Gymix security code",
    html: email({
      title: "Your security code",
      preview: "Your Gymix security code.",
      eyebrow: "Security check",
      heading: "Confirm it's you.",
      intro: `Enter this code in Gymix to continue.`,
      action: codeBox("Your code:"),
      note: `The code expires in 1 hour. Never share it with anyone, including people saying they are from Gymix.`,
    }),
  },
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const [name, { html }] of Object.entries(TEMPLATES)) writeFileSync(join(here, `${name}.html`), html);
  writeFileSync(
    join(here, "subjects.json"),
    `${JSON.stringify(Object.fromEntries(Object.entries(TEMPLATES).map(([k, v]) => [k, v.subject])), null, 2)}\n`,
  );
  console.log(`Wrote ${Object.keys(TEMPLATES).length} templates.`);
}

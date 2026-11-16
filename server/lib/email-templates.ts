/**
 * Branded transactional emails: one layout, every message as HTML + plain text.
 *
 * Built for real inboxes: table layout, inline styles, bgcolor attributes (so dark
 * mode clients don't invert it into mud), a "bulletproof" button, a hidden preheader,
 * no remote images or fonts (both are often blocked), and every value escaped.
 */

export interface EmailContent { template: string; subject: string; text: string; html: string }

const C = { bg: "#030716", card: "#0a1430", line: "#1b2a52", text: "#e6edff", muted: "#9aa7c7", dim: "#6b7a9e", accent: "#4f8cff", accentText: "#ffffff", halo: "#9cc2ff", warn: "#f5b544" };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

interface Layout {
  preheader: string;
  heading: string;
  paragraphs: string[];          // plain sentences; escaped here
  button?: { label: string; url: string };
  code?: string;                 // 6-digit code shown large
  details?: [string, string][];  // label/value rows (security info)
  tone?: "default" | "alert";
  footnote: string;              // why you got this / what to do if it wasn't you
  appUrl: string;
}

function layout(l: Layout): { html: string; text: string } {
  const host = new URL(l.appUrl).host;
  const bar = l.tone === "alert" ? C.warn : C.accent;
  const p = (s: string) => `<p style="margin:0 0 16px;font:400 15px/1.6 ${FONT};color:${C.muted}">${esc(s)}</p>`;
  const button = l.button ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px">
        <tr><td bgcolor="${C.accent}" style="border-radius:10px;background:${C.accent}">
          <a href="${esc(l.button.url)}" target="_blank" style="display:inline-block;padding:13px 26px;font:600 15px/1 ${FONT};color:${C.accentText};text-decoration:none;border-radius:10px">${esc(l.button.label)}</a>
        </td></tr>
      </table>
      <p style="margin:0 0 20px;font:400 12px/1.6 ${FONT};color:${C.dim}">Button not working? Paste this link into your browser:<br>
        <a href="${esc(l.button.url)}" style="color:${C.halo};word-break:break-all;text-decoration:underline">${esc(l.button.url)}</a></p>` : "";
  const code = l.code ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg};border:1px solid ${C.line};border-radius:14px;margin:4px 0 24px">
        <tr><td align="center" style="padding:22px 12px;font:700 34px/1 'SFMono-Regular',Consolas,Menlo,monospace;letter-spacing:10px;color:${C.text}">${esc(l.code)}</td></tr>
      </table>` : "";
  const details = l.details?.length ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg};border:1px solid ${C.line};border-radius:12px;margin:4px 0 24px">
        ${l.details.map(([k, v], i) => `<tr><td style="padding:${i ? "0" : "14px"} 16px ${i === l.details!.length - 1 ? "14px" : "8px"};font:400 13px/1.5 ${FONT};color:${C.dim};width:38%;vertical-align:top">${esc(k)}</td><td style="padding:${i ? "0" : "14px"} 16px ${i === l.details!.length - 1 ? "14px" : "8px"} 0;font:500 13px/1.5 ${FONT};color:${C.text};vertical-align:top">${esc(v)}</td></tr>`).join("")}
      </table>` : "";

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>${esc(l.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg}" bgcolor="${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(l.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg}">
  <tr><td align="center" style="padding:40px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
      <tr><td style="padding:0 4px 20px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="32" height="32" style="width:32px;height:32px"><img src="${esc(l.appUrl)}/static/brand/mark-128.png" width="32" height="32" alt="" style="display:block;width:32px;height:32px;border:0"></td>
          <td style="padding-left:8px;font:700 16px/1 ${FONT};letter-spacing:.02em;color:${C.text}">LORN.LOL</td>
        </tr></table>
      </td></tr>
      <tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.line};border-radius:18px;overflow:hidden">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td height="4" bgcolor="${bar}" style="height:4px;line-height:4px;font-size:0;background:${bar}">&nbsp;</td></tr>
          <tr><td style="padding:32px 32px 12px">
            <h1 style="margin:0 0 18px;font:700 23px/1.3 ${FONT};color:${C.text}">${esc(l.heading)}</h1>
            ${l.paragraphs.map(p).join("\n            ")}
            ${code}
            ${details}
            ${button}
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:22px 8px 0;font:400 12px/1.6 ${FONT};color:${C.dim}">
        ${esc(l.footnote)}<br><br>
        <a href="${esc(l.appUrl)}" style="color:${C.halo};text-decoration:none">${esc(host)}</a> &nbsp;·&nbsp;
        <a href="${esc(l.appUrl)}/dashboard/support" style="color:${C.halo};text-decoration:none">Support</a> &nbsp;·&nbsp;
        <a href="${esc(l.appUrl)}/dashboard/security" style="color:${C.halo};text-decoration:none">Security settings</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    l.heading, "",
    ...l.paragraphs.flatMap((s) => [s, ""]),
    ...(l.code ? [`Your code: ${l.code}`, ""] : []),
    ...(l.details?.length ? [...l.details.map(([k, v]) => `${k}: ${v}`), ""] : []),
    ...(l.button ? [`${l.button.label}: ${l.button.url}`, ""] : []),
    "—", l.footnote, `${host} · Support: ${l.appUrl}/dashboard/support`,
  ].join("\n");
  return { html, text };
}

const when = (d: Date) => d.toUTCString().replace("GMT", "UTC");

export const emails = {
  verifyEmail(appUrl: string, o: { username: string; url: string; code?: string }): EmailContent {
    const r = layout({
      appUrl, preheader: o.code ? `${o.code} is your LORN.LOL confirmation code.` : "One click to confirm your email and finish setting up your account.",
      heading: "Confirm your email",
      paragraphs: [`Hi @${o.username}, welcome to LORN.LOL.`, o.code ? "Enter this code on the sign-up screen to confirm your email address. It works for 10 minutes." : "Confirm this is your email address so you can recover your account and get security alerts."],
      code: o.code,
      button: { label: o.code ? "Or confirm with one click" : "Confirm email", url: o.url },
      footnote: "The link expires in 24 hours. If you didn't create a LORN.LOL account, you can ignore this email.",
    });
    return { template: "verify_email", subject: o.code ? `${o.code} is your LORN.LOL code` : "Confirm your email for LORN.LOL", ...r };
  },

  loginCode(appUrl: string, o: { username: string; code: string; device: string }): EmailContent {
    const r = layout({
      appUrl, preheader: `${o.code} is your LORN.LOL sign-in code.`,
      heading: "Your sign-in code",
      paragraphs: [`Hi @${o.username}, someone entered your password on a browser we don't recognise. Enter this code to finish signing in. It works for 10 minutes.`],
      code: o.code,
      details: [["Browser", o.device]],
      footnote: "If this wasn't you, your password is known to someone else: don't share this code, and reset your password at " + `${appUrl}/forgot-password`,
    });
    return { template: "login_code", subject: `${o.code} is your LORN.LOL sign-in code`, ...r };
  },

  resetPassword(appUrl: string, o: { username: string; url: string; byStaff?: boolean }): EmailContent {
    const r = layout({
      appUrl, preheader: "Use this link within an hour to choose a new password.",
      heading: "Reset your password",
      paragraphs: [
        o.byStaff ? `Hi @${o.username}, a LORN.LOL staff member started a password reset for your account at your request.` : `Hi @${o.username}, we got a request to reset the password for your account.`,
        "Choose a new password using the link below. Your current password keeps working until you do.",
      ],
      button: { label: "Choose a new password", url: o.url },
      footnote: "This link expires in 1 hour and works once. If you didn't ask for this, ignore this email — your password won't change.",
    });
    return { template: "reset_password", subject: "Reset your LORN.LOL password", ...r };
  },

  changeEmail(appUrl: string, o: { username: string; url: string; newEmail: string }): EmailContent {
    const r = layout({
      appUrl, preheader: "Confirm this address to finish changing your account email.",
      heading: "Confirm your new email",
      paragraphs: [`Hi @${o.username}, you asked to use ${o.newEmail} for your LORN.LOL account.`, "Confirm it to finish the change. Until then, your old address stays in place."],
      button: { label: "Confirm new email", url: o.url },
      footnote: "This link expires in 24 hours. If you didn't ask for this, ignore this email.",
    });
    return { template: "change_email", subject: "Confirm your new LORN.LOL email", ...r };
  },

  emailChanged(appUrl: string, o: { username?: string; newEmail: string; byStaff?: { reason: string } }): EmailContent {
    const r = layout({
      appUrl, tone: "alert", preheader: `Your account email is now ${o.newEmail}.`,
      heading: "Your email was changed",
      paragraphs: [
        `${o.username ? `Hi @${o.username}, the` : "The"} email on your LORN.LOL account was changed. This is the last email we'll send to this address.`,
        "If you didn't make this change, contact support right away so we can secure your account.",
      ],
      details: [["New email", o.newEmail], ["Changed", when(new Date())], ...(o.byStaff ? [["Changed by", "LORN.LOL staff"], ["Reason", o.byStaff.reason]] as [string, string][] : [])],
      button: { label: "Contact support", url: `${appUrl}/dashboard/support` },
      footnote: "You're getting this because it's a security change to your account.",
    });
    return { template: "email_changed_notice", subject: "Your LORN.LOL email was changed", ...r };
  },

  newSignIn(appUrl: string, o: { username: string; device: string; ip: string; at: Date }): EmailContent {
    const r = layout({
      appUrl, tone: "alert", preheader: `New sign-in from ${o.device}. Was this you?`,
      heading: "New sign-in to your account",
      paragraphs: [`Hi @${o.username}, your account was just signed in to from a device or network we haven't seen before.`, "If this was you, you don't need to do anything. If it wasn't, secure your account now: reset your password and sign out other sessions."],
      details: [["Device", o.device], ["Network", o.ip], ["Time", when(o.at)]],
      button: { label: "Review security", url: `${appUrl}/dashboard/security` },
      footnote: "You're getting this because it's a security alert for your account. Reset your password any time at " + `${appUrl}/forgot-password`,
    });
    return { template: "login_new_device", subject: "New sign-in to your LORN.LOL account", ...r };
  },
};

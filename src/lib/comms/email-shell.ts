export const KIMCHI_EMAIL_FROM = "Kimchi <hello@kimchi.so>";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://app.kimchi.so";
}

export function emailPreferencesUrl(): string {
  return `${appBaseUrl()}/dashboard?settings=email`;
}

export type EmailShellOptions = {
  /** Header label — default "Kimchi" */
  brand?: string;
  subtitle?: string;
  title: string;
  bodyHtml: string;
  footerHtml?: string;
};

export function ctaButton(href: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr><td style="background:#1C3A2F;border-radius:10px;">
    <a href="${href}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#F2EDE3;text-decoration:none;">${escapeHtml(label)}</a>
  </td></tr></table>`;
}

export function emailShell(options: EmailShellOptions): string {
  const brand = options.brand ?? "Kimchi";
  const subtitle = options.subtitle
    ? `<p style="margin:4px 0 0;font-size:11px;color:rgba(232,213,163,0.55);">${escapeHtml(options.subtitle)}</p>`
    : "";
  const footer =
    options.footerHtml ??
    `<p style="margin:0;font-size:12px;color:#6B6258;line-height:1.6;">
      You're receiving this from Kimchi. <a href="${emailPreferencesUrl()}" style="color:#2A6B4A;text-decoration:underline;">Manage email preferences</a>
      &nbsp;·&nbsp; Questions? Reply to this email.
    </p>`;

  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:#F2EDE3;font-family:'Source Sans 3',system-ui,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE3;padding:48px 0;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFDF9;border:1px solid #E5DDD0;border-radius:16px;overflow:hidden;">
          <tr><td style="background:#1C3A2F;padding:32px 40px;">
            <p style="margin:0;font-size:22px;font-weight:500;color:#E8D5A3;">${escapeHtml(brand)}</p>
            ${subtitle}
          </td></tr>
          <tr><td style="padding:40px;">
            <p style="margin:0 0 16px;font-size:24px;font-weight:500;color:#1C3A2F;font-style:italic;font-family:Georgia,serif;">${escapeHtml(options.title)}</p>
            ${options.bodyHtml}
          </td></tr>
          <tr><td style="padding:24px 40px;border-top:1px solid #E5DDD0;">${footer}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/** Coach-branded shell: "Kimchi · {Coach Name}" header */
export function coachEmailShell(coachName: string, title: string, bodyHtml: string, footerHtml?: string): string {
  return emailShell({
    brand: `Kimchi · ${coachName}`,
    subtitle: "by Second Ladder",
    title,
    bodyHtml,
    footerHtml,
  });
}

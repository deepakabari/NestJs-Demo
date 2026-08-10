export const inlineStyles = {
  details: 'background-color: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 32px;',
  detailRow: 'display: block; margin-bottom: 12px; clear: both; width: 100%;',
  label: 'color: #64748b; font-size: 14px; float: left; line-height: 20px;',
  value:
    'color: #0f172a; font-size: 14px; font-weight: 600; float: right; text-align: right; line-height: 20px;',
  amount: 'font-size: 36px; color: #0f172a; font-weight: 800; font-family: "Courier New", monospace; letter-spacing: 2px;'
};

/**
 * Wraps HTML content in the Code Crafters branded email layout.
 * Based on the theme in CognitoUserPool.yml
 */
export function withAppLayout(
  contentHtml: string,
  options: {
    title: string;
    badgeText?: string;
    showBottomSupport?: boolean;
  }
) {
  const currentYear = new Date().getFullYear();

  const styles = {
    body: "font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;",
    containerTable: 'max-width: 500px; width: 100%; margin: 0 auto; color: #475569;',
    header: 'background-color: #0f172a; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;',
    card: 'background-color: #ffffff; border-radius: 0 0 12px 12px; padding: 40px 32px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);',
    h1: 'color: #0f172a; font-size: 24px; font-weight: 700; margin: 0 0 16px 0; letter-spacing: -0.01em;',
    statusBadge:
      'display: inline-block; background-color: #f1f5f9; color: #0f172a; padding: 6px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-bottom: 20px; border: 1px solid #e2e8f0;',
    footer:
      'background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #f1f5f9; border-radius: 0 0 12px 12px; margin-top: 0;',
    footerText: 'color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.5;'
  };

  const badgeHtml = options.badgeText
    ? `<div style="${styles.statusBadge}">${options.badgeText}</div>`
    : '';

  const bottomSupportHtml =
    options.showBottomSupport !== false
      ? `<p style="color: #64748b; font-size: 14px; margin-top: 24px; margin-bottom: 0;">If you have any questions, please contact the <a href="mailto:support@codecrafters.com" style="color: #0f172a; text-decoration: underline;">Code Crafters Team</a>.</p>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
    body { font-family: 'Inter', Arial, sans-serif !important; }
    @media only screen and (max-width: 600px) {
      .container-table { width: 100% !important; padding: 10px !important; }
      .card { padding: 24px !important; }
    }
  </style>
</head>
<body style="${styles.body}">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; min-width: 100%;">
    <tr>
      <td align="center" style="padding: 50px 10px;">
        <table border="0" cellspacing="0" cellpadding="0" style="${styles.containerTable}" class="container-table">
          <!-- Header -->
          <tr>
            <td style="${styles.header}">
              <span style="color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">CODE CRAFTERS</span>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="${styles.card}" class="card">
              ${badgeHtml}
              <h1 style="${styles.h1}">${options.title}</h1>
              <div style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 0;">
                ${contentHtml}
              </div>
              ${bottomSupportHtml}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="${styles.footer}">
              <p style="${styles.footerText}">
                &copy; ${currentYear} The Code Crafters Team<br>
                This is an automated message. Please do not reply.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

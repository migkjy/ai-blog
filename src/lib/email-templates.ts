export interface EmailTemplateInput {
  title: string;
  content: string;
  excerpt?: string;
  blogUrl?: string;
  category?: string;
}

export function generateNewsletterHtml(input: EmailTemplateInput): string {
  const { title, content, excerpt, blogUrl, category } = input;

  const isHtml = /<[a-z][\s\S]*>/i.test(content);
  const htmlContent = isHtml ? content : content.replace(/\n/g, '<br/>');

  const categoryBadge = category
    ? `<span style="display:inline-block;background:#e8f4fd;color:#0077cc;padding:4px 12px;border-radius:12px;font-size:12px;margin-bottom:16px;">${category}</span>`
    : '';

  const ctaButton = blogUrl
    ? `<div style="text-align:center;margin:32px 0;">
        <a href="${blogUrl}" style="display:inline-block;background:#0077cc;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px;">블로그에서 전체 보기</a>
      </div>`
    : '';

  const preheader = excerpt
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${excerpt}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  ${preheader}
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" style="width:600px;max-width:100%;border-collapse:collapse;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:#0077cc;padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">AI AppPro</h1>
              <p style="margin:4px 0 0;color:#cce5ff;font-size:13px;">AI로 비즈니스를 한 단계 업그레이드</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${categoryBadge}
              <h2 style="margin:0 0 20px;color:#1a1a1a;font-size:22px;line-height:1.4;font-weight:700;">${title}</h2>
              <div style="color:#333333;font-size:16px;line-height:1.7;">
                ${htmlContent}
              </div>
              ${ctaButton}
            </td>
          </tr>
          <tr>
            <td style="background:#f9f9f9;padding:20px 32px;border-top:1px solid #eeeeee;">
              <p style="margin:0;color:#888888;font-size:12px;line-height:1.5;text-align:center;">
                이 메일은 <a href="https://apppro.kr" style="color:#0077cc;text-decoration:none;">AI AppPro</a>에서 발송했습니다.<br/>
                더 이상 수신을 원하지 않으시면 <a href="{{ unsubscribe }}" style="color:#0077cc;text-decoration:none;">구독 해지</a>해 주세요.
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

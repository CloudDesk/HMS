// Keep the authenticated document in memory; prohibit scripts and external resources.
export function consentPreviewHtml(html: string): string {
  const policy = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; form-action \'none\'; base-uri \'none\'">';
  return /<head\b[^>]*>/i.test(html)
    ? html.replace(/<head\b[^>]*>/i, (head) => `${head}${policy}`)
    : `${policy}${html}`;
}

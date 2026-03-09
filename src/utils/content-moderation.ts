export function normalizeTextForModeration(text: string): string {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function containsBlockedContactOrOffPlatformContent(
  input?: string,
): boolean {
  if (!input) return false;

  const text = normalizeTextForModeration(input);

  const patterns: RegExp[] = [
    // emails
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,

    // phone numbers
    /\b(?:\+?\d[\d\s\-().]{6,}\d)\b/,

    // obvious social handles
    /(^|\s)@[a-z0-9._]{2,}\b/i,

    // messaging / social apps
    /\b(whatsapp|telegram|signal|snapchat|instagram|insta|facebook|messenger|wechat|discord)\b/i,

    // off-platform payment language
    /\b(pay cash|cash only|cash on arrival|bank transfer|wire transfer|revolut|venmo|paypal friends|pay outside|pay me directly)\b/i,

    // generic move-off-platform wording
    /\b(text me|call me|email me|dm me|message me privately|contact me directly|reach me on)\b/i,
  ];

  return patterns.some((pattern) => pattern.test(text));
}

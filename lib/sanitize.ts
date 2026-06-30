export function sanitizeText(value: unknown, maxLength = 1600): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function isSensitiveTopic(message: string): boolean {
  const lowered = message.toLowerCase();
  return [
    "deposit",
    "kaution",
    "refund",
    "lease",
    "vertrag",
    "price",
    "rent",
    "miete",
    "legal",
    "urgent",
    "emergency",
    "notfall",
    "repair",
    "reparatur"
  ].some((word) => lowered.includes(word));
}


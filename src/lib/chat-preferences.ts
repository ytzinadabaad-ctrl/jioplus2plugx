export const chatLanguages = [
  { value: "auto", label: "Auto", instruction: "Match the language and script of the user's latest message, including code-switching. Switch immediately when requested." },
  { value: "hi", label: "हिन्दी", instruction: "Reply in natural Hindi using Devanagari." },
  { value: "en", label: "English", instruction: "Reply in clear, natural English." },
  { value: "hinglish", label: "Hinglish", instruction: "Reply in friendly Hinglish: conversational Hindi mixed with English, written in Latin script." },
  { value: "pa", label: "ਪੰਜਾਬੀ", instruction: "Reply in natural Punjabi using Gurmukhi." },
  { value: "bn", label: "বাংলা", instruction: "Reply in natural Bengali (Bangla) using Bengali script." },
  { value: "te", label: "తెలుగు", instruction: "Reply in natural Telugu using Telugu script." },
  { value: "ta", label: "தமிழ்", instruction: "Reply in natural Tamil using Tamil script." },
] as const;

export function languageInstruction(value: unknown): string {
  return (chatLanguages.find((language) => language.value === value) ?? chatLanguages[0]).instruction;
}

// Discard history saved by older versions; new conversations live in memory only.
export function discardLegacyChat(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem("plugx_chat_v1");
}
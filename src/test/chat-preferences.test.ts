import { describe, expect, it, vi } from "vitest";
import { chatLanguages, discardLegacyChat, languageInstruction } from "@/lib/chat-preferences";

describe("Plugo preferences", () => {
  it.each([
    ["hi", "Hindi"], ["en", "English"], ["hinglish", "Hinglish"],
    ["pa", "Punjabi"], ["bn", "Bengali"], ["te", "Telugu"], ["ta", "Tamil"],
  ])("supports %s replies", (value, language) => {
    expect(chatLanguages.some((entry) => entry.value === value)).toBe(true);
    expect(languageInstruction(value)).toContain(language);
  });
  it("discards previously saved chats without saving a new conversation", () => {
    const storage = { removeItem: vi.fn(), setItem: vi.fn() };
    discardLegacyChat(storage);
    expect(storage.removeItem).toHaveBeenCalledWith("plugx_chat_v1");
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
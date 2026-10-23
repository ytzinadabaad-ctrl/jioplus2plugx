# Roadmap

- [x] Improve Plugo multilingual and guide-grounded replies.
- [x] Remove saved chat history and verify reload clears chats.
- [x] Move Telegram join icon to a one-per-session join dialog; no fixed top-right icon.
- [x] Fix unrelated chat replies changing earlier schedule answers.
- [x] Fix preview Forbidden errors and verify channels load.
- [x] Remove bright chat scrollbar and verify the conversation flow.
- [x] Reduce startup buffering; verify settings, retry, and channel switching.
- [x] Stabilize sound and quality icons; verify mute, resolution selection, and fullscreen with local playback, plus narrow-width menus.
- [ ] Verify time to first frame on a permitted network — blocked by stream provider HTTP 451 in the test environment.
- [x] Replace Plugo's credit-based AI calls with the requested Rebix Cohere API; verified real Hindi chat and reload clearing, with language/guide forwarding and failure handling tests passing.
- [x] Match the index reference with compact dark-red styling and a brief boot-up screen; verified live channel cards, search, favourites, watch navigation, boot reveal, and mobile layout without overflow.
- [x] Start playback at the live edge, auto re-sync watchdog, one silent auto-reconnect on stream error, and dedupe repeated channel ids on the index.
- [ ] Confirm TelegramJoinPrompt visual appearance (boot screen overlapped the screenshot).

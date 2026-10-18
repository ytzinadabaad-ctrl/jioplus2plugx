<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Channels come from an external JSON feed fetched via a server function (avoids CORS); playback uses Shaka Player loaded client-only with ClearKey DRM and the __hdnea__ token appended as a query param (browsers can't send Cookie headers).
- Compose Plugo with AI Elements and message parts; keep its transcript in React memory only and share language selection rules between client and server to prevent inconsistent replies.

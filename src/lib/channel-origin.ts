const SITE_HOSTS = new Set([
  "localhost", "127.0.0.1", "premiumplugx.com", "www.premiumplugx.com",
  "channel-cove-live.lovable.app",
  "id-preview--e2c2a609-a5e8-45f6-8477-636f05809263.lovable.app",
  "project--e2c2a609-a5e8-45f6-8477-636f05809263-dev.lovable.app",
  "project--e2c2a609-a5e8-45f6-8477-636f05809263.lovable.app",
  "e2c2a609-a5e8-45f6-8477-636f05809263.lovableproject.com",
]);

export function assertChannelOrigin(request: Request) {
  const reference = request.headers.get("origin") ?? request.headers.get("referer");
  if (!reference) return; // SSR and direct public reads have no browser origin.
  let origin: URL;
  try { origin = new URL(reference); } catch { throw new Error("Forbidden"); }
  if (!SITE_HOSTS.has(origin.hostname) && origin.origin !== new URL(request.url).origin) {
    throw new Error("Forbidden");
  }
}
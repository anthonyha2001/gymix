// iOS Universal Links: proves this website belongs to the Gymix iPhone app, so
// Gymix links open the app (after the NFC banner, straight into the app).
// APPLE_TEAM_ID: the 10-character Team ID (developer.apple.com → Membership).
const PATHS = ["/d/*", "/c/*", "/join/*", "/m/*", "/p/*", "/portal", "/portal/*"];

export function GET() {
  const team = (process.env.APPLE_TEAM_ID ?? "").trim().toUpperCase();
  const appId = `${team}.${process.env.GYMIX_APP_ID ?? "com.gymix.app"}`;
  const body = /^[A-Z0-9]{10}$/.test(team)
    ? { applinks: { details: [{ appIDs: [appId], components: PATHS.map((p) => ({ "/": p })) }] }, webcredentials: { apps: [appId] } }
    : { applinks: { details: [] } };
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}

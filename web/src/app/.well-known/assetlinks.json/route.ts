// Android App Links: proves this website belongs to the Gymix Android app, so
// door stickers, invites and other Gymix links open the app directly.
// ANDROID_CERT_SHA256: the app's signing certificate fingerprint(s), comma
// separated (Google Play Console → App integrity → App signing).
export function GET() {
  const fingerprints = (process.env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));
  const body = fingerprints.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: { namespace: "android_app", package_name: process.env.GYMIX_APP_ID ?? "com.gymix.app", sha256_cert_fingerprints: fingerprints },
        },
      ]
    : [];
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}

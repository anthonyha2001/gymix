// Adds (or replaces) one query parameter on a same-site path.
export function withParam(path: string, key: string, value: string) {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set(key, value);
  return `${base}?${params.toString()}`;
}

// The link written on a machine's NFC sticker. `?n=1` tells the machine page
// it was opened from the sticker (so the owner sees the sticker works); the
// printed QR codes use the plain link.
export const machineStickerUrl = (origin: string, id: string) => `${origin}/m/${id}?n=1`;

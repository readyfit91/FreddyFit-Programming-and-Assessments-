// ── SIGNATURE IMAGE SIZE ─────────────────────────────────────────────────────
// Signature canvases are drawn at 2x resolution, so on a wide iPad screen each signature PNG was
// ~50-60KB. Every sign-in signature is stored inside the client's trainer_notes JSON, so clients
// with many sessions blew past the ~4.5MB serverless request limit (and iPad Safari's ~5MB
// localStorage quota) and their new signatures silently never saved. Signatures are now stored
// as small (max 400px wide) images, and any older oversized ones are shrunk on the next save.
const SIG_MAX_W = 400
const SIG_MAX_LEN = 20000

function shrinkCanvasToDataUrl(source, srcW, srcH) {
  const scale = Math.min(1, SIG_MAX_W / srcW)
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d').drawImage(source, 0, 0, w, h)
  return out.toDataURL('image/png')
}

export function exportSignature(canvas) {
  try { return shrinkCanvasToDataUrl(canvas, canvas.width, canvas.height) } catch { return canvas.toDataURL() }
}

export function compressSignature(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || dataUrl.length <= SIG_MAX_LEN || !dataUrl.startsWith('data:image')) return Promise.resolve(dataUrl)
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      try {
        const small = shrinkCanvasToDataUrl(img, img.naturalWidth || img.width, img.naturalHeight || img.height)
        resolve(small.length < dataUrl.length ? small : dataUrl)
      } catch { resolve(dataUrl) }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export async function shrinkSignInEntries(entries) {
  return Promise.all((entries || []).map(async e => (e && e.signature ? { ...e, signature: await compressSignature(e.signature) } : e)))
}

export async function shrinkSubscription(sub) {
  if (!sub || !Array.isArray(sub.periods)) return sub
  const periods = await Promise.all(sub.periods.map(async p => ({
    ...p,
    sessions: await Promise.all((p.sessions || []).map(async ss => (ss && ss.sig ? { ...ss, sig: await compressSignature(ss.sig) } : ss)))
  })))
  return { ...sub, periods }
}

// Shrinks every signature stored in a client's trainer_notes object (sign-in sheet + subscription).
export async function shrinkNotesSignatures(notes) {
  if (!notes || typeof window === 'undefined') return notes
  const out = { ...notes }
  if (Array.isArray(out.sign_in_entries)) out.sign_in_entries = await shrinkSignInEntries(out.sign_in_entries)
  if (out.subscription) out.subscription = await shrinkSubscription(out.subscription)
  return out
}

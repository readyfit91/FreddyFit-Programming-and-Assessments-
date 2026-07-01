import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return Response.json({ ok: false, error: 'Missing env vars', url: !!url, key: !!key })
  }

  const supabase = createClient(url, key)

  // Test 1: simple count
  const { count, error: countErr } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })

  if (countErr) {
    return Response.json({ ok: false, stage: 'count', error: countErr.message, code: countErr.code })
  }

  // Test 2: fetch with updated_at sort
  const { data: byUpdated, error: updErr } = await supabase
    .from('leads')
    .select('id, name, status, updated_at, date_added')
    .order('updated_at', { ascending: false })
    .limit(5)

  // Test 3: fetch with no sort (most basic)
  const { data: plain, error: plainErr } = await supabase
    .from('leads')
    .select('id, name, status')
    .limit(5)

  return Response.json({
    ok: true,
    count,
    byUpdated: byUpdated || null,
    byUpdatedError: updErr?.message || null,
    plain: plain || null,
    plainError: plainErr?.message || null,
  })
}

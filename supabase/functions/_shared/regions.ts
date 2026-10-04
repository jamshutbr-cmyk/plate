// Справочник регионов для Edge Functions. Кэшируется на время жизни инстанса.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { Region } from './engine.ts';

let regCache: Record<string, Region[]> | null = null;
let regAt = 0;
export async function loadRegions(admin: SupabaseClient): Promise<Record<string, Region[]>> {
  if (regCache && Date.now() - regAt < 10 * 60_000) return regCache;
  const { data, error } = await admin.from('regions').select('country, code, name, mult, rich');
  if (error || !data?.length) throw new Error('regions');
  const m: Record<string, Region[]> = { RU: [], BY: [] };
  for (const r of data) m[r.country].push({ code: r.code, name: r.name, mult: Number(r.mult), rich: r.rich });
  regCache = m; regAt = Date.now();
  return m;
}

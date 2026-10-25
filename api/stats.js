// GET /api/stats  ->  { "minecraft-mod-1": 12, "otro-juego": 5 }
const SB_URL = process.env.SUPABASE_URL || 'https://eqgsffrjufrcbczqdawm.supabase.co';
const SB_KEY = process.env.SUPABASE_KEY || 'sb_publishable_he18YRBnf4GJWRP_IVUTig_KVf5-nsN';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'metodo_no_permitido' });
  }

  try {
    const r = await fetch(SB_URL + '/rest/v1/stats?select=game_key,count&stat_type=eq.download', {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    });
    if (!r.ok) return res.status(502).json({ error: 'supabase', status: r.status });
    const filas = await r.json();
    const total = {};
    (filas || []).forEach(f => { total[f.game_key] = (total[f.game_key] || 0) + (Number(f.count) || 0); });
    return res.status(200).json(total);
  } catch (e) {
    return res.status(500).json({ error: 'error_interno' });
  }
};

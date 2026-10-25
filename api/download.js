// POST /api/download  { "game_id": "minecraft-mod-1" }  ->  suma +1 en Supabase (una fila por juego)
const SB_URL = process.env.SUPABASE_URL || 'https://eqgsffrjufrcbczqdawm.supabase.co';
const SB_KEY = process.env.SUPABASE_KEY || 'sb_publishable_he18YRBnf4GJWRP_IVUTig_KVf5-nsN';

const recientes = new Map(); // antirrebote simple por IP + juego (5 s)

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'metodo_no_permitido' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const id = String((body && body.game_id) || '').trim();
  if (!id || id.length > 100) {
    return res.status(400).json({ ok: false, error: 'game_id_invalido' });
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'sin-ip';
  const clave = ip + '|' + id;
  const ahora = Date.now();
  if (recientes.has(clave) && ahora - recientes.get(clave) < 5000) {
    return res.status(200).json({ ok: true, counted: false });
  }
  recientes.set(clave, ahora);
  if (recientes.size > 5000) recientes.clear();

  try {
    const r = await fetch(SB_URL + '/rest/v1/rpc/increment_download', {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_game_key: id })
    });
    if (!r.ok) {
      const detalle = (await r.text()).slice(0, 300);
      return res.status(502).json({ ok: false, error: 'supabase', status: r.status, detalle });
    }
    return res.status(200).json({ ok: true, counted: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'error_interno' });
  }
};

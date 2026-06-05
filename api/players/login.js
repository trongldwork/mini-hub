import supabase from './_db.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Credentials': true,
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
  'Access-Control-Allow-Headers':
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
};

// POST /api/players/login — Re-authenticate returning player with name + secret
export default async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, secret } = req.body;

  if (!name || !secret || typeof name !== 'string' || typeof secret !== 'string') {
    return res.status(400).json({ error: 'Name and secret are required' });
  }

  try {
    const { data: player, error: selectError } = await supabase
      .from('players')
      .select('name, secret')
      .eq('name', name)
      .maybeSingle();

    if (selectError) throw selectError;

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    if (player.secret !== secret.trim().toUpperCase()) {
      return res.status(401).json({ error: 'Incorrect secret key' });
    }

    return res.status(200).json({ success: true, name: player.name });
  } catch (error) {
    console.error('Database error in /api/players/login:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

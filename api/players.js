import supabase from './_db.js';
import crypto from 'crypto';

function generateSecret() {
  return [0, 0, 0, 0]
    .map(() => crypto.randomBytes(2).toString('hex').toUpperCase())
    .join('-');
}

const CORS_HEADERS = {
  'Access-Control-Allow-Credentials': true,
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
  'Access-Control-Allow-Headers':
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
};

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ---- POST /api/players/check — Register new player ----
  if (req.method === 'POST' && !req.url.endsWith('/login')) {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ available: false, error: 'Player name is required' });
    }

    const nameRegex = /^[a-zA-Z0-9]{3,20}$/;
    if (!nameRegex.test(name)) {
      return res.status(400).json({
        available: false,
        error: 'Player name must be between 3 and 20 alphanumeric characters',
      });
    }

    try {
      const { data: existing, error: selectError } = await supabase
        .from('players')
        .select('*')
        .eq('name', name)
        .maybeSingle();

      if (selectError) throw selectError;

      if (existing) {
        return res.status(409).json({
          available: false,
          error: 'This player name is already taken',
        });
      }

      const secret = generateSecret();
      const { error: insertError } = await supabase
        .from('players')
        .insert([{ name, secret }]);

      if (insertError) throw insertError;

      return res.status(200).json({
        available: true,
        message: 'Player registered successfully',
        name,
        secret, // returned ONCE — user must save this
      });
    } catch (error) {
      console.error('Database error in players.js serverless function:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

import supabase from '../_db.js';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expected = process.env.ADMIN_SECRET;
  if (!expected) {
    return res.status(500).json({ error: 'ADMIN_SECRET not configured' });
  }

  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== expected) {
    return res.status(401).json({ error: 'Unauthorized: invalid admin secret' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Missing id parameter' });
  }

  try {
    const { error } = await supabase.from('scores').delete().eq('id', id);
    if (error) throw error;
    
    return res.status(200).json({ success: true, message: 'Score deleted successfully.' });
  } catch (error) {
    console.error('Error deleting score in serverless function:', error);
    return res.status(500).json({ error: 'Internal server error while removing score.' });
  }
}

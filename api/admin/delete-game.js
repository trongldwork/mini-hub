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

  // 1. Authorize admin
  const expected = process.env.ADMIN_SECRET;
  if (!expected) {
    return res.status(500).json({ error: 'ADMIN_SECRET not configured on server' });
  }

  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== expected) {
    return res.status(401).json({ error: 'Unauthorized: invalid admin secret' });
  }

  // 2. Get gameId from query parameter
  const { gameId } = req.query;
  if (!gameId) {
    return res.status(400).json({ error: 'Missing gameId parameter' });
  }

  try {
    const hasSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY;
    if (!hasSupabase || process.env.SUPABASE_URL.includes('placeholder')) {
      return res.status(500).json({ error: 'Supabase is not configured on production server.' });
    }

    console.log(`Deleting game ${gameId} from Supabase DB...`);
    const { error: dbError } = await supabase
      .from('games')
      .delete()
      .eq('id', gameId);

    if (dbError) {
      console.warn("Failed to delete game from Supabase DB:", dbError);
    }

    console.log(`Deleting game ${gameId} files from Supabase Storage...`);
    const { data: fileList, error: listError } = await supabase.storage
      .from('games')
      .list(gameId);

    if (!listError && fileList && fileList.length > 0) {
      const pathsToDelete = fileList.map(f => `${gameId}/${f.name}`);
      const { error: removeError } = await supabase.storage
        .from('games')
        .remove(pathsToDelete);

      if (removeError) {
        console.warn("Failed to remove files from Supabase Storage:", removeError);
      }
    }

    return res.status(200).json({ success: true, message: `Game '${gameId}' removed successfully from remote storage.` });
  } catch (error) {
    console.error('Error deleting game in serverless function:', error);
    return res.status(500).json({ error: 'Internal server error while removing game.' });
  }
}

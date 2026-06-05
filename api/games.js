import fs from 'fs';
import path from 'path';
import supabase from './_db.js';

function getGameConfig(gameId) {
  try {
    const configPath = path.join(process.cwd(), 'public/games', gameId, 'game.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.error(`Error loading game config for ${gameId}:`, e);
  }
  return null;
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Try querying Supabase
    const { data: dbGames, error } = await supabase
      .from('games')
      .select('*');

    if (!error && dbGames && dbGames.length > 0) {
      const supabaseUrl = process.env.SUPABASE_URL || '';
      const remoteGames = dbGames.map(g => ({
        id: g.id,
        name: g.name,
        description: g.description,
        icon: g.icon,
        scoreLabel: g.score_label,
        scoreDirection: g.score_direction,
        iframeUrl: `${supabaseUrl}/storage/v1/object/public/games/${g.id}/index.html`,
        isRemote: true
      }));
      return res.json(remoteGames);
    }
  } catch (dbError) {
    console.warn("Supabase database fetch failed/empty, falling back to local files:", dbError);
  }

  // 2. Fallback to local files
  try {
    const gamesListPath = path.join(process.cwd(), 'public/games.json');
    let gameIds = [];
    if (fs.existsSync(gamesListPath)) {
      gameIds = JSON.parse(fs.readFileSync(gamesListPath, 'utf8'));
    } else {
      const gamesDir = path.join(process.cwd(), 'public/games');
      if (fs.existsSync(gamesDir)) {
        gameIds = fs.readdirSync(gamesDir).filter(f => {
          const itemPath = path.join(gamesDir, f);
          return fs.statSync(itemPath).isDirectory();
        });
      }
    }

    const gamesConfigs = gameIds
      .map(id => getGameConfig(id))
      .filter(config => config !== null)
      .map(g => ({
        ...g,
        iframeUrl: `games/${g.id}/index.html`
      }));

    return res.json(gamesConfigs);
  } catch (error) {
    console.error("Error in serverless GET /api/games:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

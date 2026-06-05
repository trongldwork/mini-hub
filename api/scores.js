import supabase from './_db.js';
import fs from 'fs';
import path from 'path';

function getGameConfig(gameId) {
  try {
    const configPath = path.join(process.cwd(), 'public/games', gameId, 'game.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.error(`Error loading game config in serverless for ${gameId}:`, e);
  }
  return null;
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { gameId, playerName, score, metadata } = req.body;

    if (!gameId || !playerName || score === undefined || typeof score !== 'number') {
      return res.status(400).json({
        error: "Invalid score data submitted"
      });
    }

    try {
      // Check if player exists
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('name', playerName)
        .maybeSingle();

      if (playerError) throw playerError;

      if (!player) {
        return res.status(403).json({
          error: "Player name does not exist. Please register first."
        });
      }

      const gameConfig = getGameConfig(gameId);
      const direction = gameConfig ? gameConfig.scoreDirection : 'higher-is-better';

      // Insert score
      const { data: newScore, error: insertError } = await supabase
        .from('scores')
        .insert([{
          game_id: gameId,
          player_name: playerName,
          score: score,
          metadata: metadata || {}
        }])
        .select()
        .maybeSingle();

      if (insertError) throw insertError;

      // Calculate rank
      let query = supabase
        .from('scores')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameId);

      if (direction === 'lower-is-better') {
        query = query.lt('score', score);
      } else {
        query = query.gt('score', score);
      }

      const { count, error: countError } = await query;
      if (countError) throw countError;
      const rank = (count || 0) + 1;

      return res.status(201).json({
        success: true,
        id: newScore ? newScore.id : null,
        playerName,
        score,
        rank
      });
    } catch (error) {
      console.error("Database error in POST /api/scores:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (req.method === 'GET') {
    const { gameId, limit } = req.query;
    if (!gameId) {
      return res.status(400).json({
        error: "gameId parameter is required"
      });
    }

    const limitNum = limit ? parseInt(limit, 10) : 10;

    try {
      const gameConfig = getGameConfig(gameId);
      const direction = gameConfig ? gameConfig.scoreDirection : 'higher-is-better';

      const { data: scoresList, error: fetchError } = await supabase
        .from('scores')
        .select('*')
        .eq('game_id', gameId)
        .order('score', { ascending: direction === 'lower-is-better' })
        .order('created_at', { ascending: true })
        .limit(limitNum);

      if (fetchError) throw fetchError;

      const response = (scoresList || []).map((s, index) => {
        let parsedMetadata = {};
        if (s.metadata) {
          if (typeof s.metadata === 'string') {
            try {
              parsedMetadata = JSON.parse(s.metadata);
            } catch (e) {
              console.error("Error parsing metadata string:", e);
            }
          } else {
            parsedMetadata = s.metadata;
          }
        }

        return {
          id: s.id,
          rank: index + 1,
          playerName: s.player_name,
          score: s.score,
          metadata: parsedMetadata,
          date: s.created_at
        };
      });

      return res.json(response);
    } catch (error) {
      console.error("Database error in GET /api/scores:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

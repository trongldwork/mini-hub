import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import multer from 'multer';
import AdmZip from 'adm-zip';
import supabase from './db.js';

// Generate a readable secret: e.g. "A3F9-KX72-MP41-2BQR"
function generateSecret() {
  return [0, 0, 0, 0]
    .map(() => crypto.randomBytes(2).toString('hex').toUpperCase())
    .join('-');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Helper function to read game configuration
function getGameConfig(gameId) {
  try {
    const configPath = path.join(__dirname, `../public/games/${gameId}/game.json`);
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.error(`Error loading game config for ${gameId}:`, e);
  }
  return null;
}

// 1. POST /api/players/check: Check name & register
app.post('/api/players/check', async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({
      available: false,
      error: "Player name is required"
    });
  }

  // Validate: between 3 and 20 alphanumeric characters
  const nameRegex = /^[a-zA-Z0-9]{3,20}$/;
  if (!nameRegex.test(name)) {
    return res.status(400).json({
      available: false,
      error: "Player name must be between 3 and 20 alphanumeric characters"
    });
  }

  // Check unique in DB
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
        error: "This player name is already taken"
      });
    }

    // Register player with generated secret
    const secret = generateSecret();
    const { error: insertError } = await supabase
      .from('players')
      .insert([{ name, secret }]);

    if (insertError) throw insertError;

    return res.status(200).json({
      available: true,
      message: "Player registered successfully",
      name,
      secret  // returned ONCE — user must save this
    });
  } catch (error) {
    console.error("Database error in /api/players/check:", error);
    return res.status(500).json({
      error: "Internal server error"
    });
  }
});

// 1b. POST /api/players/login: Re-authenticate a returning player by name + secret
app.post('/api/players/login', async (req, res) => {
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
});

// 2. POST /api/scores: Submit score
app.post('/api/scores', async (req, res) => {
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

    // Load game config to determine scoring direction
    const gameConfig = getGameConfig(gameId);
    const direction = gameConfig ? gameConfig.scoreDirection : 'higher-is-better';

    // Insert score into database
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
    console.error("Database error in /api/scores:", error);
    return res.status(500).json({
      error: "Internal server error"
    });
  }
});

// 3. GET /api/scores: Retrieve leaderboard
app.get('/api/scores', async (req, res) => {
  const { gameId, limit } = req.query;
  if (!gameId) {
    return res.status(400).json({
      error: "gameId parameter is required"
    });
  }

  const limitNum = limit ? parseInt(limit, 10) : 10;

  try {
    // Get scoreDirection
    const gameConfig = getGameConfig(gameId);
    const direction = gameConfig ? gameConfig.scoreDirection : 'higher-is-better';

    // Fetch scores from database ordered by direction
    const { data: scoresList, error: fetchError } = await supabase
      .from('scores')
      .select('*')
      .eq('game_id', gameId)
      .order('score', { ascending: direction === 'lower-is-better' })
      .order('created_at', { ascending: true })
      .limit(limitNum);

    if (fetchError) throw fetchError;

    // Map to API response format
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
    return res.status(500).json({
      error: "Internal server error"
    });
  }
});

// 4. GET /api/games: Retrieve games configuration list
app.get('/api/games', async (req, res) => {
  try {
    // 1. Try querying Supabase database
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
    const gamesListPath = path.join(__dirname, '../public/games.json');
    let gameIds = [];
    if (fs.existsSync(gamesListPath)) {
      gameIds = JSON.parse(fs.readFileSync(gamesListPath, 'utf8'));
    } else {
      const gamesDir = path.join(__dirname, '../public/games');
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
    console.error("Error in GET /api/games:", error);
    return res.status(500).json({
      error: "Internal server error"
    });
  }
});


// Configure Multer for zip file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Helper to recursively delete directory
function deleteFolderRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

// Admin authentication middleware
function adminAuth(req, res, next) {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) {
    return res.status(500).json({ error: 'ADMIN_SECRET not configured on server' });
  }
  const header = req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== expected) {
    return res.status(401).json({ error: 'Unauthorized: invalid admin secret' });
  }
  next();
}

// 4b. POST /api/admin/verify: Validate admin secret (login gate)
app.post('/api/admin/verify', adminAuth, (req, res) => {
  return res.json({ success: true });
});

// Helper to determine mime type for Supabase Storage
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html';
    case '.htm': return 'text/html';
    case '.js': return 'application/javascript';
    case '.css': return 'text/css';
    case '.json': return 'application/json';
    case '.png': return 'image/png';
    case '.jpg': return 'image/jpeg';
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.svg': return 'image/svg+xml';
    case '.ico': return 'image/x-icon';
    default: return 'application/octet-stream';
  }
}

// 5. POST /api/admin/upload-game: Upload a zip file with game build
app.post('/api/admin/upload-game', adminAuth, upload.single('gameZip'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No zip file uploaded' });
  }

  try {
    const zip = new AdmZip(req.file.buffer);
    const zipEntries = zip.getEntries();

    // 1. Locate game.json
    let gameJsonEntry = null;
    let pathPrefix = '';

    for (const entry of zipEntries) {
      if (entry.entryName.endsWith('game.json')) {
        gameJsonEntry = entry;
        const lastSlash = entry.entryName.lastIndexOf('game.json');
        if (lastSlash > 0) {
          pathPrefix = entry.entryName.substring(0, lastSlash);
        }
        break;
      }
    }

    if (!gameJsonEntry) {
      return res.status(400).json({ error: 'Invalid game zip: game.json not found in archive.' });
    }

    // 2. Parse and validate game.json
    const configContent = gameJsonEntry.getData().toString('utf8');
    let gameConfig;
    try {
      gameConfig = JSON.parse(configContent);
    } catch (e) {
      return res.status(400).json({ error: 'Failed to parse game.json. Ensure it is valid JSON.' });
    }

    const { id: gameId, name, description, icon, scoreLabel, scoreDirection } = gameConfig;
    if (!gameId || !name) {
      return res.status(400).json({ error: 'game.json must contain at least "id" and "name" fields.' });
    }

    // 3. Extract locally (for backward compatibility and local testing)
    const targetDir = path.join(__dirname, `../public/games/${gameId}`);
    deleteFolderRecursive(targetDir);
    fs.mkdirSync(targetDir, { recursive: true });

    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;
      if (pathPrefix && !entry.entryName.startsWith(pathPrefix)) continue;

      const relativePath = pathPrefix 
        ? entry.entryName.substring(pathPrefix.length) 
        : entry.entryName;

      const destPath = path.join(targetDir, relativePath);
      const destDir = path.dirname(destPath);

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.writeFileSync(destPath, entry.getData());
    }

    // 4. Update local games.json list
    const gamesListPath = path.join(__dirname, '../public/games.json');
    let gameIds = [];
    if (fs.existsSync(gamesListPath)) {
      try {
        gameIds = JSON.parse(fs.readFileSync(gamesListPath, 'utf8'));
      } catch (e) {
        console.error('Error reading games list', e);
      }
    }

    if (!gameIds.includes(gameId)) {
      gameIds.push(gameId);
      fs.writeFileSync(gamesListPath, JSON.stringify(gameIds, null, 2), 'utf8');
    }

    // 5. Upload to Supabase Storage & Database if configured
    const hasSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY;
    if (hasSupabase && !process.env.SUPABASE_URL.includes('placeholder')) {
      console.log(`Uploading game ${gameId} files to Supabase Storage...`);
      for (const entry of zipEntries) {
        if (entry.isDirectory) continue;
        if (pathPrefix && !entry.entryName.startsWith(pathPrefix)) continue;

        const relativePath = pathPrefix 
          ? entry.entryName.substring(pathPrefix.length) 
          : entry.entryName;

        const fileBuffer = entry.getData();
        const storagePath = `${gameId}/${relativePath}`;
        const contentType = getMimeType(relativePath);

        const { error: uploadError } = await supabase.storage
          .from('games')
          .upload(storagePath, fileBuffer, {
            contentType,
            upsert: true
          });

        if (uploadError) {
          console.error(`Failed to upload ${storagePath} to Supabase Storage:`, uploadError);
          return res.status(500).json({ 
            error: `Failed to upload game file ${relativePath} to Supabase Storage: ${uploadError.message}` 
          });
        }
      }

      console.log(`Saving game ${gameId} metadata to Supabase DB...`);
      const { error: dbError } = await supabase
        .from('games')
        .upsert({
          id: gameId,
          name,
          description: description || null,
          icon: icon || '🎮',
          score_label: scoreLabel || 'Score',
          score_direction: scoreDirection || 'higher-is-better',
          created_at: new Date().toISOString()
        });

      if (dbError) {
        console.error("Failed to save game metadata to Supabase DB:", dbError);
        return res.status(500).json({ 
          error: `Failed to save game metadata to Supabase DB: ${dbError.message}` 
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: `Game '${name}' uploaded successfully!`,
      gameId
    });

  } catch (error) {
    console.error('Error extracting/uploading game zip:', error);
    return res.status(500).json({ error: 'Internal server error while extracting/uploading build files.' });
  }
});

// DELETE /api/admin/scores/:id: Remove a specific score
app.delete('/api/admin/scores/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('scores').delete().eq('id', id);
    if (error) throw error;
    return res.json({ success: true, message: 'Score deleted successfully.' });
  } catch (error) {
    console.error("Database error in DELETE /api/admin/scores/:id:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/scores/game/:gameId: Clear leaderboard for a game
app.delete('/api/admin/scores/game/:gameId', adminAuth, async (req, res) => {
  const { gameId } = req.params;
  try {
    const { error } = await supabase.from('scores').delete().eq('game_id', gameId);
    if (error) throw error;
    return res.json({ success: true, message: `Leaderboard for '${gameId}' cleared successfully.` });
  } catch (error) {
    console.error("Database error in DELETE /api/admin/scores/game/:gameId:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// 6. DELETE /api/admin/games/:gameId: Remove a game and delete its build directory
app.delete('/api/admin/games/:gameId', adminAuth, async (req, res) => {
  const { gameId } = req.params;

  try {
    // 1. Delete locally (for backward compatibility and local testing)
    const targetDir = path.join(__dirname, `../public/games/${gameId}`);
    deleteFolderRecursive(targetDir);

    const gamesListPath = path.join(__dirname, '../public/games.json');
    if (fs.existsSync(gamesListPath)) {
      let gameIds = JSON.parse(fs.readFileSync(gamesListPath, 'utf8'));
      if (gameIds.includes(gameId)) {
        gameIds = gameIds.filter(id => id !== gameId);
        fs.writeFileSync(gamesListPath, JSON.stringify(gameIds, null, 2), 'utf8');
      }
    }

    // 2. Delete from Supabase Storage & Database if configured
    const hasSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY;
    if (hasSupabase && !process.env.SUPABASE_URL.includes('placeholder')) {
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
    }

    return res.status(200).json({ success: true, message: `Game '${gameId}' removed successfully.` });
  } catch (error) {
    console.error('Error deleting game:', error);
    return res.status(500).json({ error: 'Internal server error while removing game.' });
  }
});


app.listen(PORT, () => {
  console.log(`Local Express API server running on http://localhost:${PORT}`);
});

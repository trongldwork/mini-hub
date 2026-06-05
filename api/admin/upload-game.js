import multer from 'multer';
import AdmZip from 'adm-zip';
import path from 'path';
import supabase from '../_db.js';

// Disable default bodyParser to allow Multer to handle multipart/form-data stream
export const config = {
  api: {
    bodyParser: false,
  },
};

const upload = multer({ storage: multer.memoryStorage() });

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

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

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
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

  try {
    // 2. Parse request multipart/form-data using Multer
    await runMiddleware(req, res, upload.single('gameZip'));

    if (!req.file) {
      return res.status(400).json({ error: 'No zip file uploaded' });
    }

    const zip = new AdmZip(req.file.buffer);
    const zipEntries = zip.getEntries();

    // 3. Locate game.json
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

    // 4. Parse and validate game.json
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

    // 5. Upload files to Supabase Storage
    const hasSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY;
    if (!hasSupabase || process.env.SUPABASE_URL.includes('placeholder')) {
      return res.status(500).json({ error: 'Supabase is not configured on production server.' });
    }

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

    // 6. Save metadata to database
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

    return res.status(201).json({
      success: true,
      message: `Game '${name}' uploaded successfully to remote storage!`,
      gameId
    });

  } catch (error) {
    console.error('Error extracting/uploading game zip in serverless function:', error);
    return res.status(500).json({ error: 'Internal server error while extracting/uploading build files.' });
  }
}

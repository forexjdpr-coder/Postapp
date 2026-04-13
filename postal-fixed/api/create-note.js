// Postal API - Create Burn Note
// Creates an encrypted note that self-destructs after reading

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Generate unique note ID
function generateNoteId() {
  return crypto.randomBytes(8).toString('hex');
}

// Generate encryption key for the note
function generateNoteKey() {
  return crypto.randomBytes(32).toString('base64url');
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      encryptedContent, 
      iv, 
      authTag, 
      expiresIn = 3600, // Default 1 hour
      maxReads = 1, // Default burn after 1 read
      password = null // Optional password protection
    } = req.body;

    // Validate required fields
    if (!encryptedContent || !iv || !authTag) {
      return res.status(400).json({ 
        error: 'Missing required fields: encryptedContent, iv, authTag' 
      });
    }

    // Validate expiration (max 24 hours)
    const maxExpiration = 24 * 60 * 60;
    const expiration = Math.min(Math.max(expiresIn, 60), maxExpiration);

    // Generate unique note ID and key
    const noteId = generateNoteId();
    const noteKey = generateNoteKey();

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + (expiration * 1000)).toISOString();

    // Hash password if provided
    let passwordHash = null;
    if (password) {
      passwordHash = crypto
        .createHash('sha256')
        .update(password + (process.env.NOTE_SALT || 'postal-note-salt'))
        .digest('hex');
    }

    // Store the encrypted note
    const { error } = await supabase
      .from('burn_notes')
      .insert({
        note_id: noteId,
        encrypted_content: encryptedContent,
        iv: iv,
        auth_tag: authTag,
        note_key: noteKey,
        password_hash: passwordHash,
        max_reads: maxReads,
        reads: 0,
        expires_at: expiresAt,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error creating burn note:', error);
      return res.status(500).json({ error: 'Failed to create note' });
    }

    // Generate share URL
    const baseUrl = process.env.BASE_URL || 'https://postal.app';
    const shareUrl = `${baseUrl}/note/${noteId}#${noteKey}`;

    return res.status(200).json({
      success: true,
      noteId,
      shareUrl,
      expiresAt,
      maxReads,
      message: 'Burn note created successfully'
    });

  } catch (error) {
    console.error('Create note error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
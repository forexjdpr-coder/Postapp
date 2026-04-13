// Postal API - Read Burn Note
// Retrieves and auto-deletes a burn note after reading

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
    const { noteId, noteKey, password = null } = req.body;

    // Validate required fields
    if (!noteId) {
      return res.status(400).json({ error: 'Note ID is required' });
    }

    // Fetch the note
    const { data: note, error } = await supabase
      .from('burn_notes')
      .select('*')
      .eq('note_id', noteId)
      .single();

    if (error || !note) {
      return res.status(404).json({ 
        success: false,
        burned: false,
        error: 'Note not found or already burned' 
      });
    }

    // Check if note has expired
    if (new Date(note.expires_at) < new Date()) {
      // Delete expired note
      await supabase
        .from('burn_notes')
        .delete()
        .eq('note_id', noteId);

      return res.status(410).json({ 
        success: false,
        burned: true,
        error: 'Note has expired and been deleted' 
      });
    }

    // Validate note key (from URL fragment)
    if (noteKey && note.note_key !== noteKey) {
      return res.status(403).json({ 
        success: false,
        error: 'Invalid note key' 
      });
    }

    // Check password if note is password protected
    if (note.password_hash) {
      const crypto = await import('crypto');
      const passwordHash = crypto
        .createHash('sha256')
        .update((password || '') + (process.env.NOTE_SALT || 'postal-note-salt'))
        .digest('hex');

      if (passwordHash !== note.password_hash) {
        return res.status(403).json({ 
          success: false,
          passwordRequired: true,
          error: 'Password required to read this note' 
        });
      }
    }

    // Increment read count
    const newReads = note.reads + 1;

    // Check if max reads reached
    if (newReads >= note.max_reads) {
      // This is the last read - burn the note after returning content
      const responseData = {
        success: true,
        encryptedContent: note.encrypted_content,
        iv: note.iv,
        authTag: note.auth_tag,
        noteKey: note.note_key,
        reads: newReads,
        maxReads: note.max_reads,
        burned: true,
        message: 'This note has been burned after reading'
      };

      // Delete the note
      await supabase
        .from('burn_notes')
        .delete()
        .eq('note_id', noteId);

      return res.status(200).json(responseData);
    }

    // Update read count
    await supabase
      .from('burn_notes')
      .update({ 
        reads: newReads,
        last_read_at: new Date().toISOString()
      })
      .eq('note_id', noteId);

    return res.status(200).json({
      success: true,
      encryptedContent: note.encrypted_content,
      iv: note.iv,
      authTag: note.auth_tag,
      noteKey: note.note_key,
      reads: newReads,
      maxReads: note.max_reads,
      burned: false,
      remainingReads: note.max_reads - newReads,
      message: `Note retrieved. ${note.max_reads - newReads} reads remaining before burn.`
    });

  } catch (error) {
    console.error('Read note error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
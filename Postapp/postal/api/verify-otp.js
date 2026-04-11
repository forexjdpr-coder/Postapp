// OTP Verification - Serverless Function
import crypto from 'crypto';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ valid: false, error: 'Email and OTP required' });
    }
    
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(500).json({ valid: false, error: 'Server configuration error' });
    }
    
    // Hash the provided OTP
    const otpHash = crypto.createHash('sha256').update(otp.toString()).digest('hex');
    
    // Look up the latest unverified OTP for this email
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/otps?email=eq.${encodeURIComponent(email)}&verified=eq.false&select=*&order=created_at.desc&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      return res.status(200).json({ valid: false, error: 'No pending OTP found' });
    }
    
    const storedOtp = data[0];
    
    // Check if expired
    if (new Date(storedOtp.expires_at) < new Date()) {
      return res.status(200).json({ valid: false, error: 'OTP has expired' });
    }
    
    // Verify hash
    if (storedOtp.otp_hash !== otpHash) {
      return res.status(200).json({ valid: false, error: 'Invalid OTP' });
    }
    
    // Mark as verified
    await fetch(`${SUPABASE_URL}/rest/v1/otps?id=eq.${storedOtp.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ verified: true })
    });
    
    res.status(200).json({ 
      valid: true, 
      message: 'OTP verified successfully' 
    });
    
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ valid: false, error: 'Internal server error' });
  }
}
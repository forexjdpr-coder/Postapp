// OTP Sending via Email - Serverless Function
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
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email required' });
    }
    
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@postal.chat';
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Hash OTP for storage
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
    
    // Get client IP
    const ipAddress = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    
    // Rate limiting: check OTPs in last hour
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      
      const checkResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/otps?email=eq.${encodeURIComponent(email)}&created_at=gte.${oneHourAgo}&select=id`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );
      
      const recentOtps = await checkResponse.json();
      
      if (recentOtps && recentOtps.length >= 3) {
        return res.status(429).json({ 
          success: false, 
          error: 'Too many OTP requests. Please try again later.' 
        });
      }
      
      // Save OTP to database
      await fetch(`${SUPABASE_URL}/rest/v1/otps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          email: email,
          otp_hash: otpHash,
          created_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          verified: false,
          ip_address: ipAddress
        })
      });
    }
    
    // Send email via Resend
    if (RESEND_API_KEY) {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: RESEND_FROM_EMAIL,
          to: email,
          subject: 'Your Postal Verification Code',
          html: `
            <div style="background:#000;padding:40px;text-align:center;font-family:monospace;">
              <div style="color:#6C63FF;font-size:24px;letter-spacing:4px;margin-bottom:24px;">POSTAL</div>
              <div style="color:#e8e6ff;font-size:12px;margin-bottom:24px;">Your verification code is:</div>
              <div style="background:#050510;border:2px solid #6C63FF;padding:20px;display:inline-block;">
                <span style="color:#6C63FF;font-size:32px;letter-spacing:8px;font-weight:bold;">${otp}</span>
              </div>
              <div style="color:#666;font-size:10px;margin-top:24px;">This code expires in 10 minutes.</div>
              <div style="color:#444;font-size:9px;margin-top:16px;">Private Secure Chat Space</div>
            </div>
          `
        })
      });
      
      if (!emailResponse.ok) {
        console.error('Email send error:', await emailResponse.text());
        // Don't reveal error details to client
      }
    }
    
    // Never return the OTP itself
    res.status(200).json({ 
      success: true, 
      message: 'OTP sent to ' + email 
    });
    
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
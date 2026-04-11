// Postal API - Create Referral Code
// Generates a unique referral code for a user

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Generate random referral code
function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'REF-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
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
    const { email, adminToken } = req.body;

    // Validate admin token (for admin-generated referrals)
    if (adminToken && adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(403).json({ error: 'Invalid admin token' });
    }

    // Email is required
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user already has an active referral code
    const { data: existingReferral } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_email', email)
      .eq('active', true)
      .single();

    if (existingReferral) {
      return res.status(200).json({
        success: true,
        code: existingReferral.code,
        uses: existingReferral.uses,
        maxUses: existingReferral.max_uses,
        message: 'Existing referral code returned'
      });
    }

    // Generate new referral code
    let code = generateReferralCode();
    let attempts = 0;
    let codeExists = true;

    // Ensure uniqueness
    while (codeExists && attempts < 10) {
      const { data } = await supabase
        .from('referrals')
        .select('code')
        .eq('code', code)
        .single();
      
      if (!data) {
        codeExists = false;
      } else {
        code = generateReferralCode();
        attempts++;
      }
    }

    // Create referral record
    const { data: referral, error } = await supabase
      .from('referrals')
      .insert({
        code,
        referrer_email: email,
        uses: 0,
        max_uses: 10,
        active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating referral:', error);
      return res.status(500).json({ error: 'Failed to create referral code' });
    }

    return res.status(200).json({
      success: true,
      code: referral.code,
      uses: referral.uses,
      maxUses: referral.max_uses,
      message: 'Referral code created successfully'
    });

  } catch (error) {
    console.error('Create referral error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
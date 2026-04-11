// Postal API - Use Referral Code
// Redeems a referral code for bonus messages/time

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const BONUS_MESSAGES = 50; // Bonus messages for using a referral
const BONUS_DAYS = 7; // Bonus days for using a referral

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
    const { code, email } = req.body;

    // Validate inputs
    if (!code || !email) {
      return res.status(400).json({ error: 'Referral code and email are required' });
    }

    // Normalize code
    const normalizedCode = code.toUpperCase().trim();

    // Find the referral code
    const { data: referral, error: referralError } = await supabase
      .from('referrals')
      .select('*')
      .eq('code', normalizedCode)
      .eq('active', true)
      .single();

    if (referralError || !referral) {
      return res.status(404).json({ error: 'Invalid or expired referral code' });
    }

    // Check if user is trying to use their own referral
    if (referral.referrer_email === email) {
      return res.status(400).json({ error: 'Cannot use your own referral code' });
    }

    // Check if referral has reached max uses
    if (referral.uses >= referral.max_uses) {
      return res.status(400).json({ error: 'Referral code has reached maximum uses' });
    }

    // Check if this email has already used a referral
    const { data: existingUse } = await supabase
      .from('referral_uses')
      .select('*')
      .eq('email', email)
      .single();

    if (existingUse) {
      return res.status(400).json({ error: 'You have already used a referral code' });
    }

    // Start transaction - record the use
    const { error: useError } = await supabase
      .from('referral_uses')
      .insert({
        referral_id: referral.id,
        email: email,
        used_at: new Date().toISOString()
      });

    if (useError) {
      console.error('Error recording referral use:', useError);
      return res.status(500).json({ error: 'Failed to process referral' });
    }

    // Increment referral uses
    const { error: updateError } = await supabase
      .from('referrals')
      .update({ 
        uses: referral.uses + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', referral.id);

    if (updateError) {
      console.error('Error updating referral:', updateError);
    }

    // Give bonus to the referrer (extend their license or add messages)
    const { data: referrerLicense } = await supabase
      .from('licenses')
      .select('*')
      .eq('email', referral.referrer_email)
      .eq('active', true)
      .single();

    if (referrerLicense) {
      // Extend referrer's license by bonus days
      const currentExpiry = new Date(referrerLicense.expires_at || Date.now());
      const newExpiry = new Date(currentExpiry.getTime() + (BONUS_DAYS * 24 * 60 * 60 * 1000));
      
      await supabase
        .from('licenses')
        .update({
          expires_at: newExpiry.toISOString(),
          bonus_days: (referrerLicense.bonus_days || 0) + BONUS_DAYS
        })
        .eq('id', referrerLicense.id);
    }

    return res.status(200).json({
      success: true,
      bonus: {
        messages: BONUS_MESSAGES,
        days: BONUS_DAYS
      },
      message: `Referral applied! You received ${BONUS_MESSAGES} bonus messages and ${BONUS_DAYS} bonus days.`
    });

  } catch (error) {
    console.error('Use referral error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
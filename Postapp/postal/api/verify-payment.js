// Payment Verification & License Generation - Serverless Function
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;
    
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
    const LICENSE_SECRET = process.env.LICENSE_SECRET;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    
    if (!RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ success: false, error: 'Server configuration error' });
    }
    
    // Verify HMAC-SHA256 signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');
    
    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Invalid signature' });
    }
    
    // Generate license key
    const prefix = plan === 'lifetime' ? 'POSTL' : 'POSTM';
    const secretKey = LICENSE_SECRET || 'default-license-secret-key';
    
    const hashInput = razorpay_payment_id + plan + Date.now();
    const hash = crypto
      .createHmac('sha256', secretKey)
      .update(hashInput)
      .digest('hex')
      .toUpperCase()
      .substring(0, 16);
    
    const licenseKey = `${prefix}-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}`;
    
    // Save to Supabase if configured
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/licenses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            license_key: licenseKey,
            payment_id: razorpay_payment_id,
            order_id: razorpay_order_id,
            plan: plan,
            is_active: true,
            created_at: new Date().toISOString()
          })
        });
      } catch (dbError) {
        console.error('Supabase error:', dbError);
        // Continue even if DB save fails - key is still valid
      }
    }
    
    res.status(200).json({
      success: true,
      license_key: licenseKey,
      plan: plan,
      payment_id: razorpay_payment_id
    });
    
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
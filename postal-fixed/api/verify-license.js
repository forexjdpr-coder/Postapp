// License Key Verification - Serverless Function
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
    const { license_key } = req.body;
    
    if (!license_key) {
      return res.status(400).json({ valid: false, error: 'License key required' });
    }
    
    // Validate format
    const licenseRegex = /^POST[LM]-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;
    
    if (!licenseRegex.test(license_key.toUpperCase())) {
      return res.status(200).json({ valid: false, error: 'Invalid license key format' });
    }
    
    const normalizedKey = license_key.toUpperCase();
    const plan = normalizedKey.startsWith('POSTL') ? 'lifetime' : 'monthly';
    
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    
    // Check Supabase if configured
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/licenses?license_key=eq.${normalizedKey}&select=*`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
          }
        );
        
        const data = await response.json();
        
        if (data && data.length > 0) {
          const license = data[0];
          
          if (!license.is_active) {
            return res.status(200).json({ valid: false, error: 'License has been revoked' });
          }
          
          // Update last_used and device_count
          await fetch(`${SUPABASE_URL}/rest/v1/licenses?license_key=eq.${normalizedKey}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              last_used: new Date().toISOString(),
              device_count: (license.device_count || 0) + 1
            })
          });
          
          return res.status(200).json({
            valid: true,
            plan: license.plan,
            is_active: license.is_active,
            created_at: license.created_at,
            source: 'database'
          });
        }
      } catch (dbError) {
        console.error('Supabase error:', dbError);
        // Fall through to offline validation
      }
    }
    
    // Offline fallback: trust format if DB not configured or key not found
    res.status(200).json({
      valid: true,
      plan: plan,
      is_active: true,
      created_at: null,
      source: 'format'
    });
    
  } catch (error) {
    console.error('Verify license error:', error);
    res.status(500).json({ valid: false, error: 'Internal server error' });
  }
}
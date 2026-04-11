// Razorpay Order Creation - Serverless Function
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
    const { plan } = req.body;
    
    if (!plan || !['monthly', 'lifetime'].includes(plan)) {
      return res.status(400).json({ success: false, error: 'Invalid plan' });
    }
    
    // Razorpay configuration
    const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
    
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ success: false, error: 'Payment configuration missing' });
    }
    
    // Plan amounts in paise
    const plans = {
      monthly: { amount: 9900, name: 'Monthly' },      // ₹99
      lifetime: { amount: 49900, name: 'Lifetime' }    // ₹499
    };
    
    const selectedPlan = plans[plan];
    
    // Create order via Razorpay API
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    
    const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: selectedPlan.amount,
        currency: 'INR',
        payment_capture: 1,
        notes: {
          plan: plan
        }
      })
    });
    
    const orderData = await orderResponse.json();
    
    if (!orderResponse.ok) {
      console.error('Razorpay error:', orderData);
      return res.status(500).json({ success: false, error: 'Failed to create order' });
    }
    
    res.status(200).json({
      success: true,
      order_id: orderData.id,
      amount: selectedPlan.amount,
      currency: 'INR',
      plan_name: selectedPlan.name,
      key_id: RAZORPAY_KEY_ID
    });
    
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
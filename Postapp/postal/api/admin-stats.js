// Postal API - Admin Statistics
// Returns comprehensive statistics for the admin dashboard

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin token
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    const bodyToken = req.body?.adminToken;
    
    const adminToken = token || bodyToken;

    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(403).json({ error: 'Unauthorized - Invalid admin token' });
    }

    // Get date ranges
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch all statistics in parallel
    const [
      licensesResult,
      activeLicensesResult,
      todayLicensesResult,
      weekLicensesResult,
      monthLicensesResult,
      monthlyRevenueResult,
      lifetimeRevenueResult,
      referralsResult,
      activeReferralsResult,
      burnNotesResult,
      todayNotesResult,
      otpResult,
      recentLicensesResult,
      recentReferralsResult,
      recentNotesResult
    ] = await Promise.all([
      // Total licenses
      supabase.from('licenses').select('id', { count: 'exact', head: true }),
      
      // Active licenses
      supabase.from('licenses').select('id', { count: 'exact', head: true }).eq('active', true),
      
      // Licenses created today
      supabase.from('licenses').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      
      // Licenses created this week
      supabase.from('licenses').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
      
      // Licenses created this month
      supabase.from('licenses').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo.toISOString()),
      
      // Monthly subscription revenue
      supabase.from('licenses').select('amount').eq('plan', 'monthly').eq('active', true),
      
      // Lifetime license revenue
      supabase.from('licenses').select('amount').eq('plan', 'lifetime'),
      
      // Total referrals
      supabase.from('referrals').select('id', { count: 'exact', head: true }),
      
      // Active referrals
      supabase.from('referrals').select('id', { count: 'exact', head: true }).eq('active', true),
      
      // Total burn notes
      supabase.from('burn_notes').select('id', { count: 'exact', head: true }),
      
      // Notes created today
      supabase.from('burn_notes').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      
      // OTP stats
      supabase.from('otp_codes').select('id', { count: 'exact', head: true }),
      
      // Recent licenses (last 10)
      supabase.from('licenses').select('license_key, email, plan, amount, active, created_at').order('created_at', { ascending: false }).limit(10),
      
      // Recent referrals (last 10)
      supabase.from('referrals').select('code, referrer_email, uses, max_uses, active, created_at').order('created_at', { ascending: false }).limit(10),
      
      // Recent burn notes (last 10)
      supabase.from('burn_notes').select('note_id, reads, max_reads, expires_at, created_at').order('created_at', { ascending: false }).limit(10)
    ]);

    // Calculate revenue
    const monthlyRevenue = monthlyRevenueResult.data?.reduce((sum, l) => sum + (l.amount || 0), 0) || 0;
    const lifetimeRevenue = lifetimeRevenueResult.data?.reduce((sum, l) => sum + (l.amount || 0), 0) || 0;
    const totalRevenue = monthlyRevenue + lifetimeRevenue;

    // Calculate growth metrics
    const weeklyGrowth = weekLicensesResult.count > 0 
      ? ((todayLicensesResult.count / weekLicensesResult.count) * 100).toFixed(1) 
      : 0;

    // Format recent activity
    const recentActivity = [
      ...(recentLicensesResult.data?.map(l => ({
        type: 'license',
        data: l,
        timestamp: l.created_at
      })) || []),
      ...(recentReferralsResult.data?.map(r => ({
        type: 'referral',
        data: r,
        timestamp: r.created_at
      })) || []),
      ...(recentNotesResult.data?.map(n => ({
        type: 'note',
        data: n,
        timestamp: n.created_at
      })) || [])
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 20);

    // Build stats response
    const stats = {
      overview: {
        totalLicenses: licensesResult.count || 0,
        activeLicenses: activeLicensesResult.count || 0,
        totalReferrals: referralsResult.count || 0,
        activeReferrals: activeReferralsResult.count || 0,
        totalBurnNotes: burnNotesResult.count || 0,
        totalOtpCodes: otpResult.count || 0
      },
      revenue: {
        monthly: monthlyRevenue,
        lifetime: lifetimeRevenue,
        total: totalRevenue,
        currency: 'INR'
      },
      growth: {
        today: todayLicensesResult.count || 0,
        thisWeek: weekLicensesResult.count || 0,
        thisMonth: monthLicensesResult.count || 0,
        weeklyGrowthRate: `${weeklyGrowth}%`
      },
      activity: {
        notesToday: todayNotesResult.count || 0,
        recentLicenses: recentLicensesResult.data || [],
        recentReferrals: recentReferralsResult.data || [],
        recentNotes: recentNotesResult.data || [],
        recentActivity: recentActivity
      },
      charts: {
        licensesByPlan: {
          monthly: monthlyRevenueResult.data?.length || 0,
          lifetime: lifetimeRevenueResult.data?.length || 0
        },
        notesCreated: {
          today: todayNotesResult.count || 0,
          total: burnNotesResult.count || 0
        }
      },
      timestamp: new Date().toISOString()
    };

    return res.status(200).json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
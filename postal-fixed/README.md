# 📬 Postal — Setup Guide

Private Secure Chat Space with burn notes, OTP login, and Razorpay payments.

---

## ✅ Fixes Applied (from original)

| File | Fix |
|---|---|
| `package.json` | Added missing `@supabase/supabase-js` dependency |
| `api/create-note.js` | Fixed operator precedence bug in password hashing |
| `api/verify-payment.js` | Added `expires_at` for monthly licenses + `email`/`amount` fields |
| `pay.html` | Removed hardcoded `rzp_test_XXXXXXXXXXXXX` — now uses `/api/create-order` properly |
| `pay.html` | `activateLicense()` now actually calls `/api/verify-license` |
| `admin.html` | Removed suspicious third-party script (`myninja.ai`) |
| `admin.html` | Added real `/api/admin-stats` fetching with token auth |

---

## 🚀 Setup Steps

### Step 1 — Supabase

1. Go to [supabase.com](https://supabase.com) → Create free account → New Project
2. Go to **SQL Editor** → **New Query** → paste contents of `supabase-schema.sql` → Run
3. Go to **Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_KEY`

### Step 2 — Razorpay

1. Go to [dashboard.razorpay.com](https://dashboard.razorpay.com) → Create account
2. Go to **Settings → API Keys → Generate Test Key**
3. Copy **Key ID** → `RAZORPAY_KEY_ID`
4. Copy **Key Secret** → `RAZORPAY_KEY_SECRET`
5. When ready for live payments, generate Live keys and update env vars

### Step 3 — Resend (Email)

1. Go to [resend.com](https://resend.com) → Create free account
2. **Domains** → Add and verify your domain (or use their test address for dev)
3. **API Keys** → Create key → copy to `RESEND_API_KEY`
4. Set `RESEND_FROM_EMAIL` to a verified email like `noreply@yourdomain.com`

### Step 4 — Generate Secret Strings

Run these commands to generate secure secrets:

```bash
openssl rand -hex 32   # use for ADMIN_TOKEN
openssl rand -hex 32   # use for LICENSE_SECRET
openssl rand -hex 16   # use for NOTE_SALT
```

### Step 5 — Deploy to Vercel

```bash
npm install -g vercel
cd postal
vercel
```

After deploy, go to **Vercel Dashboard → Your Project → Settings → Environment Variables**
and add all variables from `.env.example`.

Then redeploy:
```bash
vercel --prod
```

### Step 6 — Set BASE_URL

Once deployed, copy your Vercel URL (e.g. `https://postal-abc.vercel.app`) and
set it as the `BASE_URL` environment variable. Redeploy.

---

## 🔑 All Required Environment Variables

| Variable | Where to get |
|---|---|
| `SUPABASE_URL` | Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API |
| `RAZORPAY_KEY_ID` | Razorpay → Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | Razorpay → Settings → API Keys |
| `RESEND_API_KEY` | resend.com → API Keys |
| `RESEND_FROM_EMAIL` | Your verified sender email |
| `ADMIN_TOKEN` | Generate yourself (openssl rand -hex 32) |
| `LICENSE_SECRET` | Generate yourself (openssl rand -hex 32) |
| `NOTE_SALT` | Generate yourself (openssl rand -hex 16) |
| `BASE_URL` | Your Vercel deployment URL |

---

## 🗄️ Database Tables

| Table | Purpose |
|---|---|
| `licenses` | Stores payment-generated license keys |
| `otps` | Stores hashed OTP codes for email login |
| `burn_notes` | Encrypted self-destructing notes |
| `referrals` | Referral codes and their usage counts |
| `referral_uses` | Tracks which emails used which referral |

---

## 🧪 Testing Locally

```bash
npm install
vercel dev
```

Set up a `.env.local` file using `.env.example` as template.

For Razorpay testing, use test card:
- Card: `4111 1111 1111 1111`
- Expiry: any future date
- CVV: any 3 digits

# SpawnKit Auth & Billing Integration Guide

## 1. Install Dependencies

```bash
cd /home/apocyz_runner/spawnkit-server
npm install jsonwebtoken stripe
```

## 2. Environment Variables

Add these to your environment or `.env` file:

```bash
# Auth
SK_AUTH_SECRET="your-secret-key-here-min-32-chars"
RESEND_API_KEY="re_xxxxxxxxxx"

# Stripe
STRIPE_SECRET_KEY="sk_test_xxxxxxxxxx"  # Use sk_live_ for production
STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxx"
STRIPE_PRICE_ID="price_xxxxxxxxxx"  # Your Pro plan price ID
```

## 3. Server.js Integration

### Add imports at the top:

```javascript
const AuthManager = require('./auth');
const BillingManager = require('./billing');
const fs = require('fs').promises;
const url = require('url');
```

### Initialize managers after existing code:

```javascript
// Initialize auth and billing
let authManager, billingManager;
try {
  authManager = new AuthManager();
  billingManager = new BillingManager();
  console.log('✓ Auth and billing managers initialized');
} catch (error) {
  console.error('Failed to initialize auth/billing:', error.message);
  process.exit(1);
}
```

### Add auth middleware function:

```javascript
async function requireAuth(req, res) {
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionId = cookies.sk_session;
  
  const user = await authManager.getSessionUser(sessionId);
  if (!user) {
    if (req.url.startsWith('/api/')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Authentication required' }));
      return null;
    } else {
      // Redirect to login page
      res.writeHead(302, { 'Location': '/login.html' });
      res.end();
      return null;
    }
  }
  
  req.user = user;
  return user;
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
  }
  return cookies;
}
```

### Replace your request handler with this enhanced version:

```javascript
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // === AUTH ROUTES (no auth required) ===
    if (pathname === '/api/auth/magic-link' && req.method === 'POST') {
      const body = await getRequestBody(req);
      const { email } = JSON.parse(body);
      
      if (!email || !isValidEmail(email)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Valid email required' }));
        return;
      }

      try {
        await authManager.sendMagicLink(email);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        console.error('Magic link error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to send magic link' }));
      }
      return;
    }

    if (pathname === '/api/auth/verify' && req.method === 'GET') {
      const token = query.token;
      
      if (!token) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Token required' }));
        return;
      }

      try {
        const payload = authManager.verifyMagicToken(token);
        const { sessionId } = await authManager.createSession(payload.email);
        
        // Set session cookie
        const cookieValue = `sk_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}; Path=/`;
        res.writeHead(302, { 
          'Location': '/',
          'Set-Cookie': cookieValue
        });
        res.end();
      } catch (error) {
        console.error('Token verification error:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid or expired token' }));
      }
      return;
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      const cookies = parseCookies(req.headers.cookie || '');
      const sessionId = cookies.sk_session;
      
      if (sessionId) {
        await authManager.destroySession(sessionId);
      }
      
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Set-Cookie': 'sk_session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/'
      });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const cookies = parseCookies(req.headers.cookie || '');
      const sessionId = cookies.sk_session;
      const user = await authManager.getSessionUser(sessionId);
      
      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not authenticated' }));
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ user }));
      return;
    }

    // === BILLING ROUTES (auth required) ===
    if (pathname.startsWith('/api/billing/')) {
      const user = await requireAuth(req, res);
      if (!user) return;

      if (pathname === '/api/billing/checkout' && req.method === 'POST') {
        try {
          const session = await billingManager.createCheckoutSession(user.email);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ url: session.url }));
        } catch (error) {
          console.error('Checkout error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to create checkout session' }));
        }
        return;
      }

      if (pathname === '/api/billing/portal' && req.method === 'GET') {
        try {
          const session = await billingManager.createPortalSession(user.email);
          res.writeHead(302, { 'Location': session.url });
          res.end();
        } catch (error) {
          console.error('Portal error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to create portal session' }));
        }
        return;
      }

      if (pathname === '/api/billing/status' && req.method === 'GET') {
        try {
          const status = await billingManager.getUserBillingStatus(user.email);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(status));
        } catch (error) {
          console.error('Billing status error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to get billing status' }));
        }
        return;
      }

      if (pathname === '/api/billing/webhook' && req.method === 'POST') {
        const body = await getRequestBodyRaw(req);
        const signature = req.headers['stripe-signature'];
        
        try {
          await billingManager.handleWebhook(body, signature);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ received: true }));
        } catch (error) {
          console.error('Webhook error:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Webhook verification failed' }));
        }
        return;
      }
    }

    // === PROTECTED API ROUTES ===
    if (pathname.startsWith('/api/')) {
      const user = await requireAuth(req, res);
      if (!user) return;
      
      // Continue with your existing API routes...
      // Add req.user to access current user info
    }

    // === STATIC FILES ===
    if (pathname === '/login.html') {
      const loginHtml = await fs.readFile('./auth/login.html', 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(loginHtml);
      return;
    }

    // For the root path, check auth before serving main app
    if (pathname === '/') {
      const cookies = parseCookies(req.headers.cookie || '');
      const sessionId = cookies.sk_session;
      const user = await authManager.getSessionUser(sessionId);
      
      if (!user) {
        res.writeHead(302, { 'Location': '/login.html' });
        res.end();
        return;
      }
      
      // Continue serving your main app...
    }

    // Your existing static file serving logic goes here...
    
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

// Helper functions to add:

async function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function getRequestBodyRaw(req) {
  return new Promise((resolve, reject) => {
    let body = Buffer.alloc(0);
    req.on('data', chunk => body = Buffer.concat([body, chunk]));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

## 4. Frontend Integration

Add this to your main app HTML to show user status and billing:

```javascript
// Check auth status on page load
fetch('/api/auth/me')
  .then(res => res.ok ? res.json() : null)
  .then(data => {
    if (data?.user) {
      showUserMenu(data.user);
    } else {
      window.location.href = '/login.html';
    }
  });

// Get billing status
async function getBillingStatus() {
  const res = await fetch('/api/billing/status');
  return res.json();
}

// Start checkout
async function upgradeToProPlan() {
  const res = await fetch('/api/billing/checkout', { method: 'POST' });
  const data = await res.json();
  if (data.url) {
    window.location.href = data.url;
  }
}

// Open customer portal
async function openBillingPortal() {
  window.open('/api/billing/portal', '_blank');
}

// Logout
async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
}
```

## 5. Stripe Setup

1. Get your Stripe keys from the dashboard
2. Create a Pro plan product/price in Stripe
3. Set up webhook endpoint pointing to `https://spawnkit.dev/api/billing/webhook`
4. Copy webhook secret to environment variable

## 6. Resend Setup

1. Sign up at resend.com
2. Add your domain and verify DNS
3. Get API key and add to environment

## 7. Testing

Test the flow:
1. Visit SpawnKit → redirects to login
2. Enter email → magic link sent
3. Click link → logged in, session created
4. Access /api/billing/checkout → Stripe checkout
5. Complete payment → webhook updates user to Pro plan
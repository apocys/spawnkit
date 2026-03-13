const https = require('https');
const http_ = require('http');

function apiGet(url, headers = {}) {
  const mod = url.startsWith('https') ? https : http_;
  return new Promise((resolve) => {
    const req = mod.get(url, { headers, timeout: 10000 }, (resp) => {
      let data = '';
      resp.on('data', c => data += c);
      resp.on('end', () => {
        try { resolve({ ok: resp.statusCode >= 200 && resp.statusCode < 300, status: resp.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ ok: false, status: resp.statusCode, data: data }); }
      });
    });
    req.on('error', (e) => resolve({ ok: false, status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, error: 'timeout' }); });
  });
}

async function verifyChannel(channel, config) {
  switch (channel) {
    case 'telegram': {
      if (!config.token) return { ok: false, error: 'Bot token required' };
      if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(config.token)) return { ok: false, error: 'Invalid token format. Expected: 123456789:ABCdef...' };
      const result = await apiGet(`https://api.telegram.org/bot${config.token}/getMe`);
      if (result.ok && result.data?.ok) return { ok: true, details: { botName: result.data.result.first_name, username: result.data.result.username, botId: result.data.result.id } };
      return { ok: false, error: result.data?.description || 'Invalid Telegram bot token' };
    }
    case 'discord': {
      if (!config.token) return { ok: false, error: 'Bot token required' };
      if (config.token.length < 50) return { ok: false, error: 'Token too short.' };
      const result = await apiGet('https://discord.com/api/v10/users/@me', { 'Authorization': `Bot ${config.token}` });
      if (result.ok && result.data?.id) return { ok: true, details: { botName: result.data.username, botId: result.data.id } };
      return { ok: false, error: result.data?.message || 'Invalid Discord bot token' };
    }
    case 'slack': {
      if (!config.token) return { ok: false, error: 'Bot token required' };
      if (!/^xoxb-/.test(config.token)) return { ok: false, error: 'Invalid format. Slack bot tokens start with xoxb-' };
      const result = await apiGet('https://slack.com/api/auth.test', { 'Authorization': `Bearer ${config.token}` });
      if (result.ok && result.data?.ok) return { ok: true, details: { team: result.data.team, user: result.data.user, teamId: result.data.team_id } };
      return { ok: false, error: result.data?.error || 'Invalid Slack bot token' };
    }
    case 'whatsapp': {
      if (!config.token) return { ok: false, error: 'Access token required' };
      if (!config.phoneNumberId) return { ok: false, error: 'Phone Number ID required' };
      const result = await apiGet(`https://graph.facebook.com/v18.0/${config.phoneNumberId}?access_token=${config.token}`);
      if (result.ok && result.data?.id) return { ok: true, details: { verifiedName: result.data.verified_name, displayPhoneNumber: result.data.display_phone_number } };
      return { ok: false, error: result.data?.error?.message || 'Invalid WhatsApp credentials' };
    }
    default:
      return { ok: true, note: 'No verification available for this channel type' };
  }
}

module.exports = { verifyChannel };

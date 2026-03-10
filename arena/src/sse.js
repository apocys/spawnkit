/**
 * SSE (Server-Sent Events) manager
 * Allows live streaming of battle events to connected clients (ApoMac's Three.js UI)
 */

// Map: battleId -> Set of response objects
const subscribers = new Map();

function subscribe(battleId, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  if (!subscribers.has(battleId)) {
    subscribers.set(battleId, new Set());
  }
  subscribers.get(battleId).add(res);

  // Send initial connection event
  sendEvent(res, 'connected', { battleId, ts: Date.now() });

  // Cleanup on client disconnect
  res.on('close', () => {
    const subs = subscribers.get(battleId);
    if (subs) {
      subs.delete(res);
      if (subs.size === 0) subscribers.delete(battleId);
    }
  });
}

function subscribeAll(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  if (!subscribers.has('__global')) {
    subscribers.set('__global', new Set());
  }
  subscribers.get('__global').add(res);
  sendEvent(res, 'connected', { scope: 'global', ts: Date.now() });

  res.on('close', () => {
    const subs = subscribers.get('__global');
    if (subs) {
      subs.delete(res);
      if (subs.size === 0) subscribers.delete('__global');
    }
  });
}

function sendEvent(res, eventType, data) {
  try {
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (e) {
    // Client disconnected
  }
}

function broadcast(battleId, eventType, data) {
  const payload = { ...data, battleId, ts: Date.now() };

  // Send to battle-specific subscribers
  const battleSubs = subscribers.get(battleId);
  if (battleSubs) {
    for (const res of battleSubs) {
      sendEvent(res, eventType, payload);
    }
  }

  // Send to global subscribers
  const globalSubs = subscribers.get('__global');
  if (globalSubs) {
    for (const res of globalSubs) {
      sendEvent(res, eventType, payload);
    }
  }
}

function getSubscriberCount(battleId) {
  return (subscribers.get(battleId)?.size || 0) + (subscribers.get('__global')?.size || 0);
}

module.exports = { subscribe, subscribeAll, broadcast, getSubscriberCount };

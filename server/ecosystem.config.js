module.exports = {
  apps: [{
    name: "spawnkit",
    script: "server.js",
    env: {
      NODE_ENV: "production",
      PORT: 8765,
      OC_GATEWAY_URL: "http://localhost:18789",
      OC_GATEWAY_TOKEN: "01783390c9db3bb12c1e36290021049f92644c5659fe60ff"
    }
  }]
};

// Writes wrangler.local.json: the production config without bindings that need
// a Cloudflare connection (Workers AI, custom domain), for offline `wrangler dev`.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const text = fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8").replace(/^\s*\/\/.*$/gm, "");
const config = JSON.parse(text);
delete config.ai;
delete config.routes;
delete config.placement;
fs.writeFileSync(path.join(root, "wrangler.local.json"), JSON.stringify(config, null, 2) + "\n");
console.log("wrangler.local.json written");

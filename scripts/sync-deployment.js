const fs = require("node:fs");
const path = require("node:path");

const source = path.join(__dirname, "..", "ignition", "deployments", "chain-31337", "deployed_addresses.json");
const destination = path.join(__dirname, "..", "app", "src", "deployment.json");

if (!fs.existsSync(source)) {
  console.error("No local deployment found. Run npm run deploy:local after starting npm run node.");
  process.exit(1);
}

const addresses = JSON.parse(fs.readFileSync(source, "utf8"));
const address = addresses["TokenDeploy#GameItem"];
if (!address) {
  console.error("TokenDeploy#GameItem is missing from the Ignition deployment.");
  process.exit(1);
}
fs.writeFileSync(destination, JSON.stringify({ chainId: 31337, address }, null, 2) + "\n");
console.log(`Saved local GameItem address ${address} to app/src/deployment.json`);

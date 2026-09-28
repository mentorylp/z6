const fs = require("node:fs");
const path = require("node:path");

const cid = process.argv[2]?.trim();
if (!cid || !/^[a-zA-Z0-9]+$/.test(cid)) {
  console.error("Usage: npm run metadata -- <image CID from IPFS Desktop>");
  process.exit(1);
}

const metadata = {
  name: "Thor's hammer",
  description: "Mjölnir, the legendary hammer of the Norse god of thunder.",
  image: `ipfs://${cid}`,
  strength: 20,
};
const target = path.join(__dirname, "..", "ipfs", "thor_hammer.txt");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(metadata, null, 2) + "\n");
console.log(`Prepared ${target}. Import it into IPFS Desktop, then use ipfs://<metadata CID> in the app.`);

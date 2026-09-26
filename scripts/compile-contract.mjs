import fs from "node:fs";
import solc from "solc";
const input = {
  language: "Solidity",
  sources: {
    "MonFlip.sol": {
      content: fs.readFileSync("contracts/MonFlip.sol", "utf8"),
    },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "paris",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const output = JSON.parse(
  solc.compile(JSON.stringify(input), {
    import: (p) => {
      try {
        return { contents: fs.readFileSync("node_modules/" + p, "utf8") };
      } catch {
        return { error: "Import not found" };
      }
    },
  }),
);
for (const e of output.errors ?? [])
  if (e.severity === "error") throw new Error(e.formattedMessage);
const c = output.contracts["MonFlip.sol"].MonFlip;
fs.writeFileSync(
  "lib/contract.json",
  JSON.stringify(
    { abi: c.abi, bytecode: "0x" + c.evm.bytecode.object },
    null,
    2,
  ),
);
console.log("MonFlip compiled:", c.evm.bytecode.object.length / 2, "bytes");

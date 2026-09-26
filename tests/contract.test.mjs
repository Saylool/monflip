import test from "node:test";
import assert from "node:assert/strict";
import ganache from "ganache";
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  parseEther,
  encodeAbiParameters,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "node:fs";
const { abi, bytecode } = JSON.parse(
  fs.readFileSync("lib/contract.json", "utf8"),
);
const E = parseEther;
async function fixture(reserve = "100") {
  const provider = ganache.provider({
    chain: { chainId: 31337, hardfork: "shanghai" },
    logging: { quiet: true },
    wallet: { totalAccounts: 3, defaultBalance: 1000 },
  });
  const accounts = Object.values(provider.getInitialAccounts()).map((a) =>
    privateKeyToAccount(a.secretKey),
  );
  const chain = defineChain({
    id: 31337,
    name: "Test",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: ["http://localhost"] } },
  });
  const client = createPublicClient({ chain, transport: custom(provider) });
  const wallets = accounts.map((account) =>
    createWalletClient({ chain, account, transport: custom(provider) }),
  );
  const hash = await wallets[0].deployContract({
    abi,
    bytecode,
    args: [accounts[0].address],
    value: E(reserve),
  });
  const address = (await client.waitForTransactionReceipt({ hash }))
    .contractAddress;
  const read = (functionName, args = []) =>
    client.readContract({ address, abi, functionName, args });
  const write = async (i, functionName, args = [], value = 0n) => {
    const hash = await wallets[i].writeContract({
      address,
      abi,
      functionName,
      args,
      value,
      gas: 3000000n,
    });
    const r = await client.waitForTransactionReceipt({ hash });
    if (r.status !== "success") throw new Error("revert");
    return r;
  };
  const advance = async (s) => {
    await provider.request({ method: "evm_increaseTime", params: [s] });
    await provider.request({ method: "evm_mine", params: [] });
  };
  const quote = async ({
    who = 1,
    up = true,
    duration = 30,
    stake = E("10"),
    price = 100000000n,
    asset = 0,
    signer = 0,
  } = {}) => {
    const block = await client.getBlock();
    const validUntil = block.timestamp + 45n;
    const nonce = await read("nonces", [accounts[who].address]);
    const digest = keccak256(
      encodeAbiParameters(
        [
          { type: "uint256" },
          { type: "address" },
          { type: "address" },
          { type: "uint8" },
          { type: "bool" },
          { type: "uint32" },
          { type: "uint256" },
          { type: "uint256" },
          { type: "uint64" },
          { type: "uint256" },
        ],
        [
          31337n,
          address,
          accounts[who].address,
          asset,
          up,
          duration,
          stake,
          price,
          validUntil,
          nonce,
        ],
      ),
    );
    const sig = await accounts[signer].signMessage({
      message: { raw: digest },
    });
    return [asset, up, duration, stake, price, validUntil, sig];
  };
  const invariant = async () => {
    assert.ok(
      (await client.getBalance({ address })) >=
        (await read("totalBalances")) + (await read("reserved")),
    );
  };
  return {
    provider,
    accounts,
    read,
    write,
    advance,
    quote,
    invariant,
    close: () => provider.disconnect(),
  };
}
test("deposit, win, protected withdrawal; conservation of reserves", async () => {
  const f = await fixture();
  try {
    await f.write(1, "deposit", [], E("20"));
    await f.write(1, "open", await f.quote());
    assert.equal(await f.read("reserved"), E("18"));
    assert.equal(await f.read("availableReserve"), E("92"));
    await assert.rejects(f.write(0, "settle", [0n, 101000000n]));
    await f.advance(31);
    await f.write(0, "settle", [0n, 101000000n]);
    assert.equal(await f.read("balances", [f.accounts[1].address]), E("28"));
    assert.equal(await f.read("availableReserve"), E("92"));
    await f.write(1, "withdraw", [E("28")]);
    await f.invariant();
    await assert.rejects(f.write(0, "settle", [0n, 101000000n]));
  } finally {
    await f.close();
  }
});
test("loss, tie and timeout refund release reservations", async () => {
  const f = await fixture();
  try {
    await f.write(1, "deposit", [], E("30"));
    await f.write(1, "open", await f.quote());
    await f.advance(31);
    await f.write(0, "settle", [0n, 99000000n]);
    assert.equal(await f.read("availableReserve"), E("110"));
    await f.write(1, "open", await f.quote());
    await f.advance(31);
    await f.write(0, "settle", [1n, 100000000n]);
    assert.equal(await f.read("balances", [f.accounts[1].address]), E("20"));
    await f.write(1, "open", await f.quote());
    await assert.rejects(f.write(2, "refundExpired", [2n]));
    await f.advance(151);
    await assert.rejects(f.write(0, "settle", [2n, 110000000n]));
    await f.write(2, "refundExpired", [2n]);
    assert.equal(await f.read("balances", [f.accounts[1].address]), E("20"));
    assert.equal(await f.read("reserved"), 0n);
    await f.invariant();
  } finally {
    await f.close();
  }
});
test("insufficient house reserve cannot consume user deposits", async () => {
  const f = await fixture("1");
  try {
    await f.write(1, "deposit", [], E("100"));
    await assert.rejects(f.write(1, "open", await f.quote()));
    assert.equal(await f.read("balances", [f.accounts[1].address]), E("100"));
    assert.equal(await f.read("availableReserve"), E("1"));
    await f.invariant();
  } finally {
    await f.close();
  }
});
test("oracle authentication, account binding, nonce replay, selection and limits", async () => {
  const f = await fixture();
  try {
    await f.write(1, "deposit", [], E("100"));
    await f.write(2, "deposit", [], E("100"));
    await assert.rejects(f.write(1, "open", await f.quote({ signer: 2 })));
    const q = await f.quote();
    await assert.rejects(f.write(2, "open", q));
    await f.write(1, "open", q);
    await assert.rejects(f.write(1, "open", q));
    await assert.rejects(f.write(1, "open", await f.quote({ stake: E("11") })));
    await assert.rejects(f.write(1, "open", await f.quote({ duration: 10 })));
    await assert.rejects(f.write(2, "settle", [0n, 100000001n]));
    await assert.rejects(f.write(1, "withdraw", [E("100")]));
    const old = await f.quote();
    await f.advance(46);
    await assert.rejects(f.write(1, "open", old));
    await f.invariant();
  } finally {
    await f.close();
  }
});
test("downward predictions and multiple simultaneous winners remain fully backed", async () => {
  const f = await fixture("16");
  try {
    await f.write(1, "deposit", [], E("20"));
    await f.write(1, "open", await f.quote({ up: false }));
    await f.write(1, "open", await f.quote({ up: false }));
    assert.equal(await f.read("availableReserve"), 0n);
    await f.advance(31);
    await f.write(0, "settle", [0n, 99000000n]);
    await f.write(0, "settle", [1n, 99000000n]);
    assert.equal(await f.read("balances", [f.accounts[1].address]), E("36"));
    assert.equal(await f.read("availableReserve"), 0n);
    await f.write(1, "withdraw", [E("36")]);
    await f.invariant();
  } finally {
    await f.close();
  }
});

test("quote nonce locates its trade without a browser receipt, even with interleaved users", async () => {
  const f = await fixture();
  try {
    await f.write(1, "deposit", [], E("30"));
    await f.write(2, "deposit", [], E("20"));
    const user = f.accounts[1].address;
    const nonce = await f.read("nonces", [user]);
    assert.deepEqual(await f.read("tradeIds", [user, nonce, 1n]), []);
    const quote = await f.quote();
    await f.write(2, "open", await f.quote({ who: 2 }));
    await f.write(1, "open", quote);
    assert.deepEqual(await f.read("tradeIds", [user, nonce, 1n]), [1n]);
    assert.equal(await f.read("nonces", [user]), nonce + 1n);
    await assert.rejects(f.write(1, "open", quote));
    await f.write(1, "open", await f.quote());
    assert.deepEqual(await f.read("tradeIds", [user, nonce, 1n]), [1n]);
    assert.deepEqual(await f.read("tradeIds", [user, nonce + 1n, 1n]), [2n]);
    await f.advance(31);
    await f.write(0, "settle", [1n, 100000000n]);
    assert.deepEqual(await f.read("tradeIds", [user, nonce, 1n]), [1n]);
  } finally {
    await f.close();
  }
});

import { createWalletClient, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, publicClient, abi } from "./chain";
export function config() {
  const raw = process.env.MONFLIP_CONTRACT;
  const key = process.env.ORACLE_PRIVATE_KEY;
  return {
    address: raw && isAddress(raw) ? raw : undefined,
    key:
      key && /^0x[0-9a-fA-F]{64}$/.test(key)
        ? (key as `0x${string}`)
        : undefined,
  };
}
export function oracle() {
  const c = config();
  if (!c.address || !c.key) throw new Error("NOT_CONFIGURED");
  const account = privateKeyToAccount(c.key);
  return {
    ...c,
    address: c.address,
    account,
    wallet: createWalletClient({
      account,
      chain,
      transport: http(
        process.env.MONAD_RPC_URL || chain.rpcUrls.default.http[0],
      ),
    }),
  };
}
export { publicClient, abi };

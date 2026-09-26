import { defineChain, createPublicClient, http } from "viem";
import contract from "./contract.json";
export const chain = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Test MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: {
    default: { name: "Monadscan", url: "https://testnet.monadscan.com" },
  },
});
export const publicClient = createPublicClient({
  chain,
  transport: http(chain.rpcUrls.default.http[0]),
});
export const abi = contract.abi;
export const assets = [
  { symbol: "BTC", name: "Bitcoin", id: "bitcoin" },
  { symbol: "ETH", name: "Ethereum", id: "ethereum" },
  { symbol: "MON", name: "Monad", id: "monad" },
];
export type Trade = {
  user: `0x${string}`;
  asset: number;
  up: boolean;
  stake: bigint;
  startPrice: bigint;
  endPrice: bigint;
  openedAt: bigint;
  endsAt: bigint;
  result: number;
  payout: bigint;
};

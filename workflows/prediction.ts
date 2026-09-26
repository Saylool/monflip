import { sleep, RetryableError } from "workflow";
import type { Address } from "viem";
import { publicClient, abi, config } from "@/lib/server";
import { settleTrade } from "@/lib/settlement";

type WatchInput = {
  contract: Address;
  user: Address;
  nonce: string;
  validUntil: number;
};

async function locatePrediction(input: WatchInput) {
  "use step";
  try {
    // Every successful open increments nonce and appends exactly one account trade.
    // This finds the transaction even if the browser never sends its receipt.
    const ids = (await publicClient.readContract({
      address: input.contract,
      abi,
      functionName: "tradeIds",
      args: [input.user, BigInt(input.nonce), 1n],
    })) as readonly bigint[];
    if (ids.length) {
      const trade = (await publicClient.readContract({
        address: input.contract,
        abi,
        functionName: "trades",
        args: [ids[0]],
      })) as readonly [
        string,
        number,
        boolean,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        number,
        bigint,
      ];
      return {
        id: ids[0].toString(),
        endsAt: Number(trade[7]),
        expired: false,
      };
    }
    const block = await publicClient.getBlock();
    return {
      id: null,
      endsAt: 0,
      expired: Number(block.timestamp) > input.validUntil + 30,
    };
  } catch {
    throw new RetryableError("Testnet temporarily unavailable", {
      retryAfter: "5s",
    });
  }
}
locatePrediction.maxRetries = 120;

async function finishPrediction(contract: Address, id: string) {
  "use step";
  try {
    if (config().address?.toLowerCase() !== contract.toLowerCase())
      throw new Error("CONTRACT_CHANGED");
    const result = await settleTrade(BigInt(id));
    if (result.status === "pending")
      throw new Error("CHAIN_TIME_BEFORE_EXPIRY");
    return result;
  } catch {
    // Retries also handle competing transactions/nonces and ambiguous receipts.
    // settleTrade reads chain state first, so a mined payout is never repeated.
    // Past the contract grace period it refunds instead of using a late price.
    throw new RetryableError("Settlement will retry", { retryAfter: "5s" });
  }
}
finishPrediction.maxRetries = 120;

export async function watchPrediction(input: WatchInput) {
  "use workflow";
  while (true) {
    const found = await locatePrediction(input);
    if (found.id !== null) {
      await sleep(new Date((found.endsAt + 1) * 1000));
      return await finishPrediction(input.contract, found.id);
    }
    if (found.expired) return { status: "unused_quote" };
    await sleep("5s");
  }
}

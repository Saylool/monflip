"use client";
import { useEffect, useState } from "react";
import {
  createWalletClient,
  custom,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { chain, publicClient } from "@/lib/chain";
import contract from "@/lib/contract.json";
export default function Setup() {
  const [oracle, setOracle] = useState<Address>(),
    [address, setAddress] = useState<Address>(),
    [reserve, setReserve] = useState("10"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [hash, setHash] = useState<Hex>(),
    [en, setEn] = useState(false);
  const t = (tr: string, enText: string) => (en ? enText : tr);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json() as Promise<{ oracle: Address; contract: Address }>)
      .then((c) => {
        setOracle(c.oracle);
        setAddress(c.contract);
      });
    setEn(localStorage.getItem("monflip.language") === "en");
  }, []);
  async function execute(mode: "deploy" | "fund") {
    setBusy(true);
    setMessage("");
    try {
      if (!window.ethereum || !oracle)
        throw new Error(
          t(
            "Cüzdanını aç ve fiyat servisi kurulumunu tamamla.",
            "Open your wallet and configure the price service.",
          ),
        );
      const w = createWalletClient({
        chain,
        transport: custom(window.ethereum),
      });
      try {
        await w.switchChain({ id: 10143 });
      } catch (e: any) {
        if (e.code === 4902 || e.cause?.code === 4902)
          await w.addChain({ chain });
        else throw e;
      }
      const [account] = await w.requestAddresses();
      let tx: Hex;
      if (mode === "deploy") {
        if (Number(reserve) < 1 || Number(reserve) > 1000)
          throw new Error(
            t(
              "Kasa için 1–1000 test MON gir.",
              "Enter 1–1000 test MON for the reserve.",
            ),
          );
        tx = await w.deployContract({
          account,
          abi: contract.abi,
          bytecode: contract.bytecode as Hex,
          args: [oracle],
          value: parseEther(reserve),
        });
      } else {
        tx = await w.sendTransaction({
          account,
          to: oracle,
          value: parseEther("0.1"),
        });
      }
      setHash(tx);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: tx,
      });
      if (receipt.status !== "success") throw new Error("Transaction reverted");
      if (receipt.contractAddress) setAddress(receipt.contractAddress);
      setMessage(t("İşlem onaylandı.", "Transaction confirmed."));
    } catch (e: any) {
      setMessage(e.shortMessage || e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="shell">
      <header>
        <a className="brand" href="/">
          ◈ <span>monflip</span>
        </a>
        <span className="network">Monad Testnet</span>
      </header>
      <section className="setup">
        <a href="/">← {t("İşlem ekranına dön", "Back to trading")}</a>
        <h1>{t("Test ağını etkinleştir", "Activate the testnet")}</h1>
        <p className="muted">
          {t(
            "Bu sayfa proje kurulumu içindir. İşlemleri kendi cüzdanında onaylarsın; özel anahtarını paylaşman gerekmez.",
            "This page is for project setup. Approve transactions in your wallet; never share your private key.",
          )}
        </p>
        <ol>
          <li>
            <h2>{t("Test MON edin", "Get test MON")}</h2>
            <p>
              {t(
                "Cüzdanında kasa tutarı, servis ücreti ve ağ işlemleri için test MON bulunmalı.",
                "Your wallet needs test MON for the reserve, relay and network fees.",
              )}
            </p>
            <a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer">
              Monad Faucet ↗
            </a>
          </li>
          <li>
            <h2>
              {t(
                "Sonuçlandırma servisini fonla",
                "Fund the settlement service",
              )}
            </h2>
            <p>
              {t(
                "Servis yalnızca sonuçları zincire yazmak için ağ ücreti öder.",
                "The service pays network fees to settle predictions.",
              )}
            </p>
            <code>
              {oracle ||
                t(
                  "Servis anahtarı henüz yapılandırılmadı.",
                  "Service key is not configured yet.",
                )}
            </code>
            <button
              className="primary"
              disabled={busy || !oracle}
              onClick={() => execute("fund")}
            >
              {t("0,1 test MON gönder", "Send 0.1 test MON")}
            </button>
          </li>
          <li>
            <h2>
              {t(
                "Sözleşmeyi ve kasayı oluştur",
                "Deploy the contract and reserve",
              )}
            </h2>
            <label htmlFor="reserve">
              {t("Başlangıç kasası (test MON)", "Initial reserve (test MON)")}
            </label>
            <input
              id="reserve"
              type="number"
              min="1"
              max="1000"
              value={reserve}
              onChange={(e) => setReserve(e.target.value)}
            />
            <button
              className="primary"
              disabled={busy || !oracle || !!address}
              onClick={() => execute("deploy")}
            >
              {t("Cüzdanda onayla ve kur", "Approve and deploy in wallet")}
            </button>
          </li>
          {address && (
            <li>
              <h2>{t("Sözleşme adresi", "Contract address")}</h2>
              <code>{address}</code>
              <button onClick={() => navigator.clipboard.writeText(address)}>
                {t("Adresi kopyala", "Copy address")}
              </button>
              <p>
                {t(
                  "Bu herkese açık adresi Codex sohbetine gönder; ortak site bağlantısı tamamlanacak.",
                  "Send this public address to the Codex chat to complete site configuration.",
                )}
              </p>
            </li>
          )}
        </ol>
        {busy && (
          <p role="status">
            {t(
              "Cüzdan / ağ onayı bekleniyor…",
              "Waiting for wallet / network…",
            )}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {hash && (
          <a
            href={`${chain.blockExplorers.default.url}/tx/${hash}`}
            target="_blank"
            rel="noreferrer"
          >
            {t("İşlemi görüntüle", "View transaction")} ↗
          </a>
        )}
      </section>
    </main>
  );
}

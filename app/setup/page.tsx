"use client";
import { useEffect, useState } from "react";
import {
  createWalletClient,
  custom,
  parseEther,
  isHex,
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
    [deploymentHash, setDeploymentHash] = useState<Hex>(),
    [recoveryHash, setRecoveryHash] = useState(""),
    [connected, setConnected] = useState(false),
    [en, setEn] = useState(false);
  const t = (tr: string, enText: string) => (en ? enText : tr);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json() as Promise<{ oracle: Address; contract: Address }>)
      .then((c) => {
        setOracle(c.oracle);
        setAddress(c.contract);
        setConnected(!!c.contract);
        if (!c.contract && c.oracle) {
          const saved = localStorage.getItem(
            "monflip.deployment." + c.oracle.toLowerCase(),
          );
          if (saved && isHex(saved) && saved.length === 66) {
            setDeploymentHash(saved);
            setHash(saved);
            setRecoveryHash(saved);
            recover(saved, c.oracle).catch(() => {});
          }
        }
      })
      .catch(() =>
        setMessage(
          "Kurulum bilgisi alınamadı. / Setup information unavailable.",
        ),
      );
    setEn(localStorage.getItem("monflip.language") === "en");
  }, []);
  async function recover(tx: Hex, expectedOracle: Address) {
    const receipt = await publicClient.getTransactionReceipt({ hash: tx });
    if (receipt.status !== "success" || !receipt.contractAddress)
      throw new Error(
        t(
          "Bu işlem başarılı bir sözleşme kurulumu değil.",
          "This is not a successful contract deployment.",
        ),
      );
    const transaction = await publicClient.getTransaction({ hash: tx });
    if (
      !transaction.input
        .toLowerCase()
        .startsWith(contract.bytecode.toLowerCase())
    )
      throw new Error(
        t(
          "Bu işlem MonFlip sözleşmesine ait değil.",
          "This is not a MonFlip deployment.",
        ),
      );
    const signer = (await publicClient.readContract({
      address: receipt.contractAddress,
      abi: contract.abi,
      functionName: "oracle",
    })) as Address;
    if (signer.toLowerCase() !== expectedOracle.toLowerCase())
      throw new Error(
        t(
          "Sözleşmenin fiyat servisi farklı.",
          "Contract uses a different price service.",
        ),
      );
    localStorage.setItem(
      "monflip.deployment." + expectedOracle.toLowerCase(),
      tx,
    );
    setDeploymentHash(tx);
    setHash(tx);
    setAddress(receipt.contractAddress);
    setMessage(
      t(
        "Mevcut sözleşme bulundu. Yeniden kurulum yapmana gerek yok.",
        "Existing contract found. No new deployment needed.",
      ),
    );
  }
  async function restore() {
    if (!oracle) return;
    setBusy(true);
    try {
      const tx = recoveryHash.trim().split("/tx/").pop()!.split(/[?#]/)[0];
      if (!isHex(tx) || tx.length !== 66)
        throw new Error(
          t(
            "Geçerli işlem kimliğini veya bağlantısını gir.",
            "Enter a valid transaction hash or link.",
          ),
        );
      await recover(tx, oracle);
    } catch (e: any) {
      setMessage(e.shortMessage || e.message);
    } finally {
      setBusy(false);
    }
  }
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
        if (address || deploymentHash)
          throw new Error(
            t(
              "Mevcut kurulum işlemini kontrol et; yeniden ödeme yapma.",
              "Check the existing deployment; do not pay again.",
            ),
          );
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
      if (mode === "deploy") {
        localStorage.setItem("monflip.deployment." + oracle.toLowerCase(), tx);
        setDeploymentHash(tx);
        setRecoveryHash(tx);
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
        <div className="notice">
          {t(
            "Kurulumda yatırılan MON platformun ödeme kasasıdır; kişisel işlem bakiyen değildir. İşlem bakiyesi ana ekrandaki Yatır düğmesinden eklenir.",
            "MON sent during setup funds the house reserve, not your trading balance. Add trading funds using Deposit on the main screen.",
          )}
        </div>
        {!connected && (
          <section className="recovery">
            <h2>{t("Daha önce kurulum yaptın mı?", "Already deployed?")}</h2>
            <p>
              {t(
                "Tekrar MON gönderme. Cüzdan geçmişindeki kurulum işleminin bağlantısını veya kimliğini gir.",
                "Do not send MON again. Enter the deployment transaction link or hash from wallet activity.",
              )}
            </p>
            <label htmlFor="recovery">
              {t("İşlem kimliği / bağlantısı", "Transaction hash / link")}
            </label>
            <input
              id="recovery"
              type="text"
              value={recoveryHash}
              onChange={(e) => setRecoveryHash(e.target.value)}
              style={{ width: "100%" }}
              placeholder="0x…"
            />
            <button
              disabled={busy || !oracle || !recoveryHash.trim()}
              onClick={restore}
            >
              {t("Mevcut sözleşmeyi bul", "Recover existing contract")}
            </button>
          </section>
        )}
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
              disabled={busy || !oracle || !!address || !!deploymentHash}
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
                  connected
                    ? "Sözleşme siteye bağlı. Ana ekrandan kişisel bakiyene test MON yatırabilirsin."
                    : "Bu herkese açık adresi Codex sohbetine gönder; ortak site bağlantısı tamamlanacak.",
                  connected
                    ? "Contract connected. Deposit test MON into your trading balance on the main screen."
                    : "Send this public address to the Codex chat to complete site configuration.",
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

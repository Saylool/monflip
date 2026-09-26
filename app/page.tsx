"use client";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  createWalletClient,
  custom,
  formatEther,
  parseEther,
  type EIP1193Provider,
  type Address,
} from "viem";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Plus,
  ArrowDownToLine,
  ExternalLink,
  Clock3,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { chain, publicClient, abi, assets, type Trade } from "@/lib/chain";
import { PriceChart, type CandlePoint } from "@/components/price-chart";
import type { QuotePrice } from "@/lib/prices";
declare global {
  interface Window {
    ethereum?: EIP1193Provider & {
      on?: (e: string, f: (arg: any) => void) => void;
      removeListener?: (e: string, f: (arg: any) => void) => void;
    };
  }
}
type Row = Trade & { id: bigint };
type Config = {
  contract: Address | null;
  oracle: Address | null;
  ready: boolean;
  status?: string;
};
function EthereumIcon() {
  return (
    <svg
      viewBox="0 0 24 40"
      width="60%"
      height="80%"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 0 0 20 12 15Z" fill="#d5def6" />
      <path d="m12 0 12 20-12-5Z" fill="#8c9bbc" />
      <path d="m0 20 12 7V15Z" fill="#a7b7d9" />
      <path d="m24 20-12 7V15Z" fill="#637699" />
      <path d="m0 23 12 17V30Z" fill="#d5def6" />
      <path d="M24 23 12 40V30Z" fill="#8c9bbc" />
    </svg>
  );
}

export default function Home() {
  const [lang, setLang] = useState<"tr" | "en">("tr");
  const t = (tr: string, en: string) => (lang === "tr" ? tr : en);
  const [asset, setAsset] = useState(0),
    [duration, setDuration] = useState(60),
    [amount, setAmount] = useState("1");
  const [account, setAccount] = useState<Address>(),
    [config, setConfig] = useState<Config>({
      contract: null,
      oracle: null,
      ready: false,
    });
  const [prices, setPrices] = useState<Record<string, QuotePrice>>({}),
    [points, setPoints] = useState<
      Record<string, { time: number; price: number }[]>
    >({}),
    [priceError, setPriceError] = useState(false);
  const [balance, setBalance] = useState(0n),
    [reserve, setReserve] = useState<bigint>(),
    [rows, setRows] = useState<Row[]>([]),
    [historyPage, setHistoryPage] = useState(0);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [tx, setTx] = useState<string>(),
    [modal, setModal] = useState<"deposit" | "withdraw" | null>(null),
    [cash, setCash] = useState("1"),
    [now, setNow] = useState(Date.now());
  const [histories, setHistories] = useState<
    Record<string, { time: number; price: number }[]>
  >({});
  const [candles, setCandles] = useState<Record<string, CandlePoint[]>>({});
  const [historyError, setHistoryError] = useState(false);
  useEffect(() => {
    let alive = true;
    const symbol = assets[asset].symbol;
    setHistoryError(false);
    const load = async () => {
      try {
        const response = await fetch(`/api/history?asset=${symbol}`);
        if (!response.ok) throw new Error("HISTORY_UNAVAILABLE");
        const data = (await response.json()) as {
          points: { time: number; price: number }[];
          candles?: CandlePoint[];
        };
        if (alive) {
          setHistories((prev) => ({ ...prev, [symbol]: data.points }));
          setCandles((prev) => ({
            ...prev,
            [symbol]: data.candles?.length ? data.candles : prev[symbol] || [],
          }));
          setHistoryError(!data.candles?.length);
        }
      } catch {
        if (alive) setHistoryError(true);
      }
    };
    load();
    const timer = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [asset]);
  const [networkError, setNetworkError] = useState(false);
  const refreshSequence = useRef(0);
  const refreshPending = useRef<{ key: string; sequence: number } | null>(null);
  const settling = useRef(new Set<string>());
  const activeAccount = useRef<Address | undefined>(undefined);
  const current = prices[assets[asset].symbol];
  const format = (n: number, d = 2) =>
    n.toLocaleString(lang === "tr" ? "tr-TR" : "en-US", {
      maximumFractionDigits: d,
      minimumFractionDigits: d,
    });
  const mon = (n: bigint) => format(Number(formatEther(n)), 3);
  const resetAccount = useCallback((a: Address | undefined) => {
    activeAccount.current = a;
    refreshSequence.current++;
    setNetworkError(false);
    setAccount(a);
    setRows([]);
    setBalance(0n);
    setHistoryPage(0);
    setModal(null);
    setMessage("");
    setTx(undefined);
  }, []);
  useEffect(() => {
    const l = localStorage.getItem("monflip.language");
    if (l === "en") setLang(l);
    const refreshConfig = () =>
      fetch("/api/config")
        .then((r) => r.json() as Promise<Config>)
        .then(setConfig)
        .catch(() => {});
    refreshConfig();
    const configTimer = setInterval(refreshConfig, 15000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(tick);
      clearInterval(configTimer);
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("monflip.language", lang);
  }, [lang]);
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch("/api/prices");
        if (!r.ok) throw new Error();
        const d = (await r.json()) as { prices: Record<string, QuotePrice> };
        if (!alive) return;
        setPrices(d.prices);
        setPriceError(false);
        setPoints((prev) => {
          const next = { ...prev };
          for (const [symbol, value] of Object.entries(d.prices) as [
            string,
            QuotePrice,
          ][]) {
            const arr = prev[symbol] || [];
            if (!arr.length || arr[arr.length - 1].time !== value.updatedAt)
              next[symbol] = [
                ...arr,
                { time: value.updatedAt, price: value.price },
              ].slice(-90);
          }
          return next;
        });
      } catch {
        if (alive) setPriceError(true);
      }
    };
    poll();
    const timer = setInterval(poll, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;
    const changed = (accounts: string[]) =>
      resetAccount(accounts[0] as Address | undefined);
    const chainChanged = () => resetAccount(undefined);
    provider.on?.("accountsChanged", changed);
    provider.on?.("chainChanged", chainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", changed);
      provider.removeListener?.("chainChanged", chainChanged);
    };
  }, [resetAccount]);
  const refresh = useCallback(async () => {
    if (!config.contract) return;
    const a = account;
    const key = `${config.contract}:${a || ""}:${historyPage}`;
    if (refreshPending.current?.key === key) return;
    const sequence = ++refreshSequence.current;
    refreshPending.current = { key, sequence };
    try {
      const query = new URLSearchParams({ page: String(historyPage) });
      if (a) query.set("address", a);
      const response = await fetch(`/api/account?${query}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) throw new Error("CHAIN_UNAVAILABLE");
      const data = (await response.json()) as {
        reserve: string;
        balance: string;
        rows: Record<string, unknown>[];
      };
      if (sequence !== refreshSequence.current || activeAccount.current !== a)
        return;
      setReserve(BigInt(data.reserve));
      setBalance(BigInt(data.balance));
      setRows(
        data.rows.map((row: Record<string, unknown>) => ({
          ...row,
          id: BigInt(row.id as string),
          stake: BigInt(row.stake as string),
          startPrice: BigInt(row.startPrice as string),
          endPrice: BigInt(row.endPrice as string),
          openedAt: BigInt(row.openedAt as string),
          endsAt: BigInt(row.endsAt as string),
          payout: BigInt(row.payout as string),
        })) as Row[],
      );
      setNetworkError(false);
    } catch {
      if (sequence === refreshSequence.current && activeAccount.current === a)
        setNetworkError(true);
    } finally {
      if (refreshPending.current?.sequence === sequence)
        refreshPending.current = null;
    }
  }, [account, config.contract, historyPage]);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    for (const row of rows) {
      const id = row.id.toString();
      if (
        row.result === 0 &&
        Number(row.endsAt) * 1000 <= now &&
        !settling.current.has(id) &&
        config.ready
      ) {
        settling.current.add(id);
        fetch("/api/settle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        })
          .then((r) => {
            if (!r.ok) throw new Error();
            return refresh();
          })
          .catch(() => {})
          .finally(() => {
            setTimeout(() => settling.current.delete(id), 15000);
          });
      }
    }
  }, [rows, now, config.ready, refresh]);
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: "configure_prediction",
          description:
            "Select an asset and duration on MonFlip. Does not place a trade or move funds.",
          inputSchema: {
            type: "object",
            properties: {
              asset: { enum: ["BTC", "ETH", "MON"] },
              duration: { enum: [30, 60, 300] },
            },
            required: ["asset", "duration"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: async (input: any) => {
            const index = assets.findIndex((x) => x.symbol === input.asset);
            if (index < 0 || ![30, 60, 300].includes(input.duration))
              throw new Error("Invalid selection");
            setAsset(index);
            setDuration(input.duration);
            return {
              asset: input.asset,
              duration: input.duration,
              tradePlaced: false,
            };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
    return () => controller.abort();
  }, []);
  async function wallet() {
    if (!window.ethereum)
      throw new Error(
        t(
          "Tarayıcında MetaMask veya uyumlu bir cüzdan aç.",
          "Open MetaMask or a compatible wallet in your browser.",
        ),
      );
    const w = createWalletClient({ chain, transport: custom(window.ethereum) });
    try {
      await w.switchChain({ id: chain.id });
    } catch (e: any) {
      if (e.code === 4902 || e.cause?.code === 4902)
        await w.addChain({ chain });
      else throw e;
    }
    const [a] = await w.requestAddresses();
    if (!a) throw new Error("No account");
    return { w, a };
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    setTx(undefined);
    try {
      await fn();
    } catch (e: any) {
      const rejected = e?.code === 4001 || e?.cause?.code === 4001;
      setMessage(
        rejected
          ? t(
              "İşlem cüzdanda iptal edildi.",
              "Transaction cancelled in wallet.",
            )
          : e?.shortMessage ||
              e?.message ||
              t("İşlem tamamlanamadı.", "Transaction failed."),
      );
    } finally {
      setBusy(false);
    }
  }
  const connect = () =>
    run(async () => {
      const { a } = await wallet();
      resetAccount(a);
    });
  async function receipt(hash: `0x${string}`) {
    setTx(hash);
    const r = await publicClient.waitForTransactionReceipt({ hash });
    if (r.status !== "success")
      throw new Error(
        t("İşlem zincirde tamamlanamadı.", "Transaction reverted."),
      );
    await refresh();
    setMessage(t("İşlem onaylandı.", "Transaction confirmed."));
  }
  const money = () =>
    run(async () => {
      if (!config.contract) throw new Error("Not configured");
      const value = parseEther(cash);
      if (value <= 0n || (modal === "withdraw" && value > balance))
        throw new Error(t("Geçerli bir tutar gir.", "Enter a valid amount."));
      const { w, a } = await wallet();
      if (a.toLowerCase() !== account?.toLowerCase())
        throw new Error(
          t("Cüzdan değişti. Yeniden bağlan.", "Wallet changed. Reconnect."),
        );
      const hash = await w.writeContract({
        address: config.contract,
        abi,
        account: a,
        functionName: modal === "deposit" ? "deposit" : "withdraw",
        args: modal === "deposit" ? [] : [value],
        value: modal === "deposit" ? value : 0n,
      });
      await receipt(hash);
      setModal(null);
    });
  const open = (up: boolean) =>
    run(async () => {
      if (!config.ready || !config.contract)
        throw new Error(
          t(
            "Test ağı sözleşmesi henüz bağlanmadı.",
            "Testnet contract is not connected yet.",
          ),
        );
      const { w, a } = await wallet();
      if (a.toLowerCase() !== account?.toLowerCase())
        throw new Error(
          t("Cüzdan değişti. Yeniden bağlan.", "Wallet changed. Reconnect."),
        );
      const r = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: a, asset, up, duration, amount }),
      });
      if (!r.ok)
        throw new Error(
          t(
            "Fiyat alınamadı. Biraz sonra tekrar dene.",
            "Price unavailable. Try again shortly.",
          ),
        );
      const quote = (await r.json()) as {
        price: string;
        validUntil: string;
        signature: `0x${string}`;
      };
      await receipt(
        await w.writeContract({
          address: config.contract,
          abi,
          account: a,
          functionName: "open",
          args: [
            asset,
            up,
            duration,
            parseEther(amount),
            BigInt(quote.price),
            BigInt(quote.validUntil),
            quote.signature,
          ],
        }),
      );
    });
  let stake = 0n;
  try {
    stake = parseEther(amount);
  } catch {}
  const canTrade =
    !!account &&
    config.ready &&
    !networkError &&
    !busy &&
    !priceError &&
    !!current &&
    stake >= parseEther("0.01") &&
    stake <= parseEther("10") &&
    stake <= balance &&
    reserve !== undefined &&
    (stake * 80n) / 100n <= reserve;
  const chart = useMemo(
    () =>
      [
        ...new Map(
          [
            ...(histories[assets[asset].symbol] || []),
            ...(points[assets[asset].symbol] || []),
          ].map((p) => [p.time, p]),
        ).values(),
      ].sort((a, b) => a.time - b.time),
    [histories, points, asset],
  );
  const statuses = [
    t("Açık", "Open"),
    t("Kazandı", "Won"),
    t("Kaybetti", "Lost"),
    t("Eşit · İade", "Tie · Refunded"),
    t("Süre aşımı · İade", "Timeout · Refunded"),
  ];
  return (
    <main className="shell trading-shell">
      <header>
        <a className="brand" href="/">
          <span className="brand-mark">◈</span>
          <span>
            mon<b>flip</b>
          </span>
        </a>
        <span className="network">Monad Testnet</span>
        {account && (
          <div className="balance-bar">
            <span>
              <span className="balance-label">{t("Bakiye", "Balance")}</span>
              <strong>
                {mon(balance)} <small>test MON</small>
              </strong>
            </span>
            <div>
              <button
                className="primary"
                disabled={!config.contract || busy}
                onClick={() => setModal("deposit")}
              >
                <Plus size={15} />
                {t("Yatır", "Deposit")}
              </button>
              <button
                disabled={!config.contract || busy || balance === 0n}
                onClick={() => setModal("withdraw")}
              >
                <ArrowDownToLine size={15} />
                {t("Çek", "Withdraw")}
              </button>
            </div>
          </div>
        )}
        <div className="header-actions">
          <button
            className="language"
            aria-label={t("Switch to English", "Türkçeye geç")}
            onClick={() => setLang(lang === "tr" ? "en" : "tr")}
          >
            {lang === "tr" ? "EN" : "TR"}
          </button>
          {account ? (
            <button
              disabled={busy}
              onClick={() => resetAccount(undefined)}
              className="wallet-address"
            >
              <Wallet size={15} />
              {account.slice(0, 6)}…{account.slice(-4)}
            </button>
          ) : (
            <button disabled={busy} className="primary" onClick={connect}>
              <Wallet size={16} />
              {t("Cüzdan bağla", "Connect wallet")}
            </button>
          )}
        </div>
      </header>
      <div className="intro">
        <div>
          <h1>
            <span className="live-dot" />
            {t("Piyasanın bir sonraki yönü", "The market’s next move")}
          </h1>
          <p>
            {t(
              "Varlığını seç. Yönünü belirle.",
              "Pick your asset. Choose your direction.",
            )}
          </p>
        </div>
        <a
          href="https://faucet.monad.xyz"
          target="_blank"
          rel="noreferrer"
          className="faucet"
        >
          {t("Test MON al", "Get test MON")} <ExternalLink size={13} />
        </a>
      </div>
      {!config.ready && (
        <div className="notice">
          <ShieldCheck size={17} />
          <span>
            {t(
              config.status === "relay_unfunded"
                ? "Sözleşme bağlı. Sonuçlandırma servisinin ağ ücreti için kurulum ekranından 0,1 test MON gönder."
                : config.status === "network_unavailable"
                  ? "Test ağına ulaşılamıyor. Biraz sonra tekrar denenecek."
                  : "Fiyatları inceleyebilirsin. İşlemler, test ağı kurulumu tamamlandığında açılacak.",
              config.status === "relay_unfunded"
                ? "Contract connected. Fund the settlement service with 0.1 test MON from Setup."
                : config.status === "network_unavailable"
                  ? "Testnet unavailable. Retrying shortly."
                  : "Explore prices now. Trading opens when testnet setup is complete.",
            )}
          </span>
          <a href="/setup">{t("Kurulum", "Setup")} →</a>
        </div>
      )}
      <div className="workspace">
        <section className="market">
          <Tabs
            value={String(asset)}
            onValueChange={(v) => setAsset(Number(v))}
          >
            <TabsList className="assets">
              {assets.map((a, i) => (
                <TabsTrigger key={a.symbol} value={String(i)}>
                  <span className={"coin coin-" + i}>
                    {i === 0 ? "₿" : i === 1 ? <EthereumIcon /> : "◈"}
                  </span>
                  {a.name}
                  <small>{a.symbol}</small>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="quote">
            <span>{assets[asset].symbol} / USD</span>
            <h2>
              {current ? "$" + format(current.price, asset === 2 ? 5 : 2) : "—"}
            </h2>
            <small
              className={
                current?.change != null && current.change >= 0 ? "positive" : ""
              }
            >
              {current?.change != null
                ? `${current.change >= 0 ? "+" : ""}${format(current.change)}% · 24 ${t("saat", "hours")}`
                : t("Fiyat bekleniyor", "Waiting for price")}
            </small>
          </div>
          <PriceChart
            symbol={assets[asset].symbol}
            lang={lang}
            points={chart}
            candles={candles[assets[asset].symbol] || []}
            failed={historyError}
          />
          <div className="chart-caption">
            <a
              href="https://www.coingecko.com"
              target="_blank"
              rel="noreferrer"
            >
              CoinGecko · USD · {t("Gerçek piyasa verisi", "Real market data")}
            </a>
            <span>
              {historyError
                ? t(
                    "Fiyat geçmişi yeniden yükleniyor",
                    "Retrying price history",
                  )
                : priceError
                  ? t("Bağlantı bekleniyor", "Reconnecting")
                  : current
                    ? `${t("Son veri", "Last update")} ${new Date(current.updatedAt * 1000).toLocaleTimeString()}`
                    : "—"}
            </span>
          </div>
        </section>
        <aside className="ticket">
          <div className="ticket-heading">
            <h2>{t("İşlem yap", "Make a prediction")}</h2>
            <span className="profit">+80%</span>
          </div>
          <p className="ticket-subtitle">
            {t(
              "Fiyatın seçilen sürede yönünü tahmin et.",
              "Predict the price direction over your chosen time.",
            )}
          </p>
          <label>{t("Süre", "Duration")}</label>
          <RadioGroup
            className="durations"
            value={String(duration)}
            onValueChange={(value) => setDuration(Number(value))}
            aria-label={t("Süre", "Duration")}
          >
            {[30, 60, 300].map((d) => (
              <label
                key={d}
                className={
                  "duration-choice " + (duration === d ? "selected" : "")
                }
              >
                <RadioGroupItem value={String(d)} className="sr-only" />
                {d === 30
                  ? t("30 sn", "30 sec")
                  : d === 60
                    ? t("1 dk", "1 min")
                    : t("5 dk", "5 min")}
              </label>
            ))}
          </RadioGroup>
          <label htmlFor="amount">{t("İşlem tutarı", "Amount")}</label>
          <div className="amount">
            <input
              id="amount"
              inputMode="decimal"
              type="number"
              min="0.01"
              max="10"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <span>MON</span>
          </div>
          <div className="quick-amounts">
            {["0.1", "1", "5", "10"].map((v) => (
              <button key={v} onClick={() => setAmount(v)}>
                {v}
              </button>
            ))}
          </div>
          <div className="payout-summary">
            <div>
              <span>{t("Net kazanç (+80%)", "Net profit (+80%)")}</span>
              <strong className="positive">
                +{format(Math.max(0, Number(amount) || 0) * 0.8, 2)} MON
              </strong>
            </div>
            <div>
              <span>{t("Kazanırsan toplam", "Total if you win")}</span>
              <strong>
                {format(Math.max(0, Number(amount) || 0) * 1.8, 2)} MON
              </strong>
            </div>
          </div>
          <div className="direction-buttons">
            <button
              disabled={!canTrade}
              onClick={() => open(true)}
              className="up"
            >
              <ArrowUpRight size={21} />
              {t("Yukarı", "Up")}
            </button>
            <button
              disabled={!canTrade}
              onClick={() => open(false)}
              className="down"
            >
              <ArrowDownRight size={21} />
              {t("Aşağı", "Down")}
            </button>
          </div>
          <p className="muted">
            {busy
              ? t(
                  "Cüzdan onayı / ağ işlemi bekleniyor…",
                  "Waiting for wallet / network…",
                )
              : !account
                ? t(
                    "İşlem açmak için cüzdanını bağla.",
                    "Connect your wallet to predict.",
                  )
                : !config.ready
                  ? t(
                      config.status === "relay_unfunded"
                        ? "Sonuçlandırma servisi için test MON gerekiyor."
                        : "Test ağı kurulumu bekleniyor.",
                      config.status === "relay_unfunded"
                        ? "Settlement service needs test MON."
                        : "Waiting for testnet setup.",
                    )
                  : balance < stake
                    ? t("İşlem için bakiye yatır.", "Deposit funds to predict.")
                    : t(
                        "En az 0,01 · En fazla 10 test MON",
                        "Min 0.01 · Max 10 test MON",
                      )}
          </p>
          <p className="muted">
            {t(
              "İşlemin onaylandıktan sonra sayfayı kapatabilirsin. Sonuç otomatik olarak bakiyene işlenir.",
              "Once confirmed, you can close this page. Settlement updates your balance automatically.",
            )}
          </p>
          <div className="rule">
            <ShieldCheck size={15} />
            {t("Eşit fiyat = tutarın iadesi", "Equal price = full refund")}
          </div>
        </aside>
      </div>
      {networkError && (
        <div className="notice status" role="status">
          {t(
            "Monad ağına erişilemiyor. Bakiye ve işlem geçmişi yeniden yükleniyor; mevcut işlemlerin sunucuda takip edilmeye devam eder.",
            "Monad is unavailable. Retrying balances and history; existing predictions continue to be tracked on the server.",
          )}
        </div>
      )}
      {(message || tx) && (
        <div className="notice status" role="status">
          <span>
            {message ||
              t("İşlem onayı bekleniyor…", "Waiting for confirmation…")}
          </span>
          {tx && (
            <a
              href={`${chain.blockExplorers.default.url}/tx/${tx}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("Zincirde gör", "View transaction")} ↗
            </a>
          )}
        </div>
      )}
      <section className="history">
        <Tabs defaultValue="open">
          <div className="history-heading">
            <TabsList>
              <TabsTrigger value="open">
                {t("Açık işlemler", "Open predictions")}{" "}
                <span className="count">
                  {rows.filter((r) => r.result === 0).length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="history">
                {t("Geçmiş", "History")}
              </TabsTrigger>
            </TabsList>
            <span className="muted">
              {t("Sabit net kâr", "Fixed net profit")} <b>80%</b>
            </span>
          </div>
          {["open", "history"].map((view) => (
            <TabsContent key={view} value={view}>
              {rows.filter((r) =>
                view === "open" ? r.result === 0 : r.result !== 0,
              ).length === 0 ? (
                <div className="empty-history">
                  <Clock3 size={25} />
                  <p>
                    {!account
                      ? t(
                          "İşlemlerini görmek için cüzdanını bağla.",
                          "Connect your wallet to see predictions.",
                        )
                      : t(
                          "Henüz burada bir işlem yok.",
                          "No predictions here yet.",
                        )}
                  </p>
                </div>
              ) : (
                <div className="trade-list">
                  {rows
                    .filter((r) =>
                      view === "open" ? r.result === 0 : r.result !== 0,
                    )
                    .map((r) => (
                      <div className="trade-row" key={String(r.id)}>
                        <div>
                          <strong>{assets[r.asset].symbol}</strong>
                          <span className={r.up ? "positive" : "negative"}>
                            {r.up ? t("Yukarı", "Up") : t("Aşağı", "Down")}
                          </span>
                        </div>
                        <div>
                          <small>{t("Tutar", "Amount")}</small>
                          {mon(r.stake)} MON
                        </div>
                        <div>
                          <small>{t("Giriş → Kapanış", "Entry → Close")}</small>
                          $
                          {format(
                            Number(r.startPrice) / 1e8,
                            r.asset === 2 ? 5 : 2,
                          )}{" "}
                          →{" "}
                          {r.endPrice
                            ? "$" +
                              format(
                                Number(r.endPrice) / 1e8,
                                r.asset === 2 ? 5 : 2,
                              )
                            : "—"}
                        </div>
                        <div>
                          <small>
                            {r.result === 0
                              ? t("Kalan süre", "Remaining")
                              : t("Sonuç", "Result")}
                          </small>
                          <b
                            className={
                              r.result === 1
                                ? "positive"
                                : r.result === 2
                                  ? "negative"
                                  : ""
                            }
                          >
                            {r.result === 0
                              ? Number(r.endsAt) * 1000 > now
                                ? Math.max(
                                    0,
                                    Math.ceil(
                                      (Number(r.endsAt) * 1000 - now) / 1000,
                                    ),
                                  ) + "s"
                                : t("Sonuçlanıyor…", "Settling…")
                              : statuses[r.result]}
                          </b>
                        </div>
                        <div>
                          <small>{t("Ödeme", "Payout")}</small>
                          {r.result ? mon(r.payout) + " MON" : "—"}
                        </div>
                        {r.result === 0 &&
                          now > Number(r.endsAt + 120n) * 1000 && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                run(async () => {
                                  const { w, a } = await wallet();
                                  await receipt(
                                    await w.writeContract({
                                      account: a,
                                      address: config.contract!,
                                      abi,
                                      functionName: "refundExpired",
                                      args: [r.id],
                                    }),
                                  );
                                })
                              }
                            >
                              {t("İade al", "Refund")}
                            </button>
                          )}
                      </div>
                    ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
        {account && (
          <div className="pagination">
            <button
              disabled={historyPage === 0}
              onClick={() => setHistoryPage((p) => p - 1)}
            >
              {t("Daha yeni", "Newer")}
            </button>
            <span>{historyPage + 1}</span>
            <button
              disabled={rows.length < 20}
              onClick={() => setHistoryPage((p) => p + 1)}
            >
              {t("Daha eski", "Older")}
            </button>
          </div>
        )}
      </section>
      <footer>
        <span>
          {t(
            "Yalnızca test MON. Gerçek para kullanılmaz.",
            "Test MON only. No real money.",
          )}
        </span>
        <div>
          {config.contract && (
            <a
              href={`${chain.blockExplorers.default.url}/address/${config.contract}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("Sözleşme", "Contract")} ↗
            </a>
          )}
          <span>
            {t("Kasa rezervi", "House reserve")}:{" "}
            {reserve === undefined ? "—" : mon(reserve) + " MON"}
          </span>
        </div>
      </footer>
      <Dialog
        open={!!modal}
        onOpenChange={(v) => {
          if (!v && !busy) setModal(null);
        }}
      >
        <DialogContent className="cash-dialog">
          <DialogTitle>
            {modal === "deposit"
              ? t("Test MON yatır", "Deposit test MON")
              : t("Test MON çek", "Withdraw test MON")}
          </DialogTitle>
          <DialogDescription>
            {modal === "deposit"
              ? t(
                  "Cüzdanından MonFlip bakiyene aktarılır. İşlem ücreti için cüzdanında bir miktar MON bırak.",
                  "Move funds from your wallet to MonFlip. Leave some MON in your wallet for gas.",
                )
              : t(
                  "Kullanılabilir bakiyen bağlı cüzdanına gönderilir.",
                  "Your available balance is returned to the connected wallet.",
                )}
          </DialogDescription>
          <label htmlFor="cash">
            {t("Tutar (test MON)", "Amount (test MON)")}
          </label>
          <input
            id="cash"
            type="number"
            min="0.001"
            step="0.01"
            value={cash}
            onChange={(e) => setCash(e.target.value)}
          />
          <button className="primary" disabled={busy} onClick={money}>
            {busy
              ? t("Onay bekleniyor…", "Waiting…")
              : t("Cüzdanda onayla", "Confirm in wallet")}
          </button>
          {message && (
            <p role="status" className="muted">
              {message}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

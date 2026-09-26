"use client";
import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  AreaSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

export type CandlePoint = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};
type Point = { time: number; price: number };
export function PriceChart({
  symbol,
  lang,
  points,
  candles,
  failed,
}: {
  symbol: string;
  lang: "tr" | "en";
  points: Point[];
  candles: CandlePoint[];
  failed: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeries = useRef<ISeriesApi<"Area"> | null>(null);
  const fitted = useRef("");
  const [mode, setMode] = useState<"candles" | "line">("candles");
  const [hours, setHours] = useState(24);
  const [hover, setHover] = useState<{
    time: number;
    open?: number;
    high?: number;
    low?: number;
    close: number;
  } | null>(null);
  const tr = lang === "tr";
  const precision = symbol === "MON" ? 5 : 2;
  const fmt = (v: number) =>
    v.toLocaleString(tr ? "tr-TR" : "en-US", {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  useEffect(() => {
    if (!host.current) return;
    const c = createChart(host.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#12101c" },
        textColor: "#968ba9",
        fontSize: 11,
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: "#242031" },
        horzLines: { color: "#242031" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#9a83bd", labelBackgroundColor: "#65488e" },
        horzLine: { color: "#9a83bd", labelBackgroundColor: "#65488e" },
      },
      rightPriceScale: {
        borderColor: "#342942",
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor: "#342942",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 3,
      },
      localization: {
        locale: tr ? "tr-TR" : "en-US",
        timeFormatter: (time: number) =>
          new Date(time * 1000).toLocaleString(tr ? "tr-TR" : "en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
      },
      handleScroll: { vertTouchDrag: false },
    });
    const priceFormat = {
      type: "price" as const,
      precision,
      minMove: 10 ** -precision,
    };
    const cs = c.addSeries(CandlestickSeries, {
      upColor: "#4dd4ae",
      downColor: "#ee7499",
      borderVisible: false,
      wickUpColor: "#4dd4ae",
      wickDownColor: "#ee7499",
      priceFormat,
    });
    const ls = c.addSeries(AreaSeries, {
      lineColor: "#b291ff",
      topColor: "#9667ed44",
      bottomColor: "#9667ed00",
      lineWidth: 2,
      priceFormat,
      visible: false,
    });
    c.subscribeCrosshairMove((param) => {
      if (
        !param.time ||
        !param.point ||
        param.point.x < 0 ||
        param.point.y < 0
      ) {
        setHover(null);
        return;
      }
      const candle = param.seriesData.get(cs);
      const point = param.seriesData.get(ls);
      if (candle && "close" in candle && cs.options().visible)
        setHover({ ...candle, time: Number(param.time) });
      else if (point && "value" in point)
        setHover({ time: Number(param.time), close: point.value });
      else setHover(null);
    });
    chart.current = c;
    candleSeries.current = cs;
    lineSeries.current = ls;
    fitted.current = "";
    return () => {
      c.remove();
      chart.current = null;
      candleSeries.current = null;
      lineSeries.current = null;
    };
  }, [symbol, lang, precision, tr]);
  useEffect(() => {
    if (!chart.current || !candleSeries.current || !lineSeries.current) return;
    const cutoff = Date.now() / 1000 - hours * 3600;
    const bars = candles
      .filter((p) => p.time >= cutoff)
      .map((p) => ({ ...p, time: p.time as UTCTimestamp }));
    const line = points
      .filter((p) => p.time >= cutoff)
      .map((p) => ({ time: p.time as UTCTimestamp, value: p.price }));
    candleSeries.current.setData(mode === "candles" ? bars : []);
    lineSeries.current.setData(mode === "line" ? line : []);
    candleSeries.current.applyOptions({ visible: mode === "candles" });
    lineSeries.current.applyOptions({ visible: mode === "line" });
    const key = `${symbol}:${mode}:${hours}`;
    if (
      fitted.current !== key &&
      (mode === "candles" ? bars.length : line.length) > 0
    ) {
      chart.current.timeScale().fitContent();
      fitted.current = key;
    }
  }, [points, candles, hours, mode, symbol, lang]);
  useEffect(() => {
    if (failed && candles.length === 0 && points.length > 0) setMode("line");
  }, [failed, candles.length, points.length]);
  const active =
    hover ||
    (mode === "candles"
      ? candles.at(-1)
      : points.length
        ? { time: points.at(-1)!.time, close: points.at(-1)!.price }
        : undefined);
  const hasData = mode === "candles" ? candles.length > 0 : points.length > 0;
  return (
    <div className="exchange-chart">
      <div className="chart-toolbar">
        <div
          className="chart-range"
          aria-label={tr ? "Grafik zaman aralığı" : "Chart time range"}
        >
          {[6, 12, 24].map((h) => (
            <button
              key={h}
              aria-pressed={hours === h}
              onClick={() => {
                setHours(h);
                setHover(null);
              }}
            >
              {h}
              {tr ? " sa" : "h"}
            </button>
          ))}
        </div>
        <div className="chart-mode">
          <button
            aria-pressed={mode === "candles"}
            disabled={failed && candles.length === 0}
            onClick={() => {
              setMode("candles");
              setHover(null);
            }}
          >
            {tr ? "Mum" : "Candles"}
          </button>
          <button
            aria-pressed={mode === "line"}
            onClick={() => {
              setMode("line");
              setHover(null);
            }}
          >
            {tr ? "Çizgi" : "Line"}
          </button>
          <button
            onClick={() => chart.current?.timeScale().fitContent()}
            aria-label={tr ? "Grafiği sığdır" : "Fit chart"}
          >
            ↔
          </button>
        </div>
      </div>
      <div className="chart-readout" aria-live="off">
        <strong>{symbol}/USD</strong>
        <span className="chart-interval">
          {mode === "candles"
            ? tr
              ? "30 dk mum"
              : "30m candles"
            : tr
              ? "Fiyat"
              : "Price"}
        </span>
        {active && (
          <>
            <span>
              {tr ? "S" : "T"}{" "}
              {new Date(active.time * 1000).toLocaleTimeString(
                tr ? "tr-TR" : "en-US",
                { hour: "2-digit", minute: "2-digit" },
              )}
            </span>
            {"open" in active && active.open !== undefined && (
              <>
                <span>
                  O <b>{fmt(active.open)}</b>
                </span>
                <span>
                  H <b>{fmt(active.high!)}</b>
                </span>
                <span>
                  L <b>{fmt(active.low!)}</b>
                </span>
              </>
            )}
            <span>
              C{" "}
              <b
                className={
                  "open" in active &&
                  active.open !== undefined &&
                  active.close < active.open
                    ? "negative"
                    : "positive"
                }
              >
                {fmt(active.close)}
              </b>
            </span>
          </>
        )}
      </div>
      <div className="exchange-canvas-wrap">
        <div
          ref={host}
          className="exchange-canvas"
          aria-label={
            tr
              ? `${symbol} etkileşimli fiyat grafiği`
              : `${symbol} interactive price chart`
          }
          role="img"
        />
        {!hasData && (
          <div className="exchange-loading">
            {failed
              ? tr
                ? "Geçmiş verisi yeniden deneniyor. Çizgi görünümünü kullanabilirsin."
                : "Retrying history. You can use line view."
              : tr
                ? "Piyasa geçmişi yükleniyor…"
                : "Loading market history…"}
          </div>
        )}
      </div>
      <div className="chart-help">
        <span>
          {tr
            ? "Kaydır: yakınlaştır · Sürükle: geçmişi incele"
            : "Scroll to zoom · Drag to explore"}
        </span>
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
          TradingView Lightweight Charts™
        </a>
      </div>
    </div>
  );
}

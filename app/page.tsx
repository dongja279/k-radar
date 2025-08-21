"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
} from "chart.js";
import { Bar, Pie, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement
);

/* ====== 타이포/컬러(섬트렌드 느낌) ====== */
const ACCENT = "#6C5CE7";           // 보라 포인트
const ACCENT_SOFT = "rgba(108,92,231,.15)";
const BG = "#0b1220";
const CARD = "#0f172a";
const CARD_BORDER = "#1f2937";
const TEXT = "#e5e7eb";
const MUTED = "#9ca3af";
const GRID = "rgba(148,163,184,0.12)";

const PIE_COLORS = [
  "#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#a78bfa",
  "#f87171", "#22d3ee", "#f59e0b", "#c084fc", "#4ade80",
];

type ShopItem = {
  title: string;
  link: string;
  image: string;
  lprice?: string;
  price?: string;
  mallName?: string;
  brand?: string;
};

function Chip({
  active,
  onClick,
  children,
  style,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px",
        borderRadius: 999,
        border: `1px solid ${active ? ACCENT : CARD_BORDER}`,
        color: active ? TEXT : MUTED,
        background: active ? ACCENT_SOFT : CARD,
        fontSize: 13,
        fontWeight: 600,
        transition: "all .15s ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** 라인차트 포인트 위 값(상대지수)을 그려주는 라이트 플러그인 */
const valueLabelPlugin = {
  id: "valueLabel",
  afterDatasetsDraw(chart: any) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = "600 10px Inter, Pretendard, system-ui, -apple-system, Segoe UI";
    ctx.fillStyle = TEXT;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    const dataset = chart.getDatasetMeta(0);
    dataset.data.forEach((point: any, i: number) => {
      const val = chart.data.datasets[0].data[i];
      if (val == null) return;
      const x = point.x;
      const y = point.y - 6;
      ctx.fillText(Math.round(val as number).toString(), x, y);
    });
    ctx.restore();
  },
};

export default function Page() {
  const [keyword, setKeyword] = useState("스킨부스터");
  const [sort, setSort] = useState<"sim" | "date" | "asc" | "dsc">("sim");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<ShopItem[]>([]);

  // 검색 트렌드
  const [months, setMonths] = useState<1 | 3 | 6 | 12>(12); // 기간 프리셋
  const [showIndex, setShowIndex] = useState(true);         // 상대지수 토글 (기본 ON)
  const [trend, setTrend] = useState<{ period: string; ratio: number }[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);

  /* ---------- 가격 숫자 파싱 & 상/하위 5% 제외 ---------- */
  const priceNumbers = useMemo(() => {
    const toNum = (s?: string) => Number(String(s ?? "").replace(/[^\d]/g, "")) || 0;

    const nums = items
      .map((it) => {
        const n = toNum(it.lprice) || toNum(it.price);
        if (n > 0) return n;
        const m = it.title?.match(/\d[\d,]{3,}/g)?.[0];
        return toNum(m);
      })
      .filter((n) => n > 0)
      .sort((a, b) => a - b);

    if (nums.length < 5) return [];

    const q = (p: number) => {
      const pos = (nums.length - 1) * p;
      const i = Math.floor(pos);
      const frac = pos - i;
      return nums[i + 1] !== undefined ? nums[i] + frac * (nums[i + 1] - nums[i]) : nums[i];
    };

    const lo = q(0.05);
    const hi = q(0.95);
    return nums.filter((n) => n >= lo && n <= hi);
  }, [items]);

  /* ---------- 히스토그램 ---------- */
  const priceHist = useMemo(() => {
    if (priceNumbers.length === 0) {
      return { labels: [] as string[], counts: [] as number[], percents: [] as number[] };
    }
    const min = priceNumbers[0];
    const max = priceNumbers[priceNumbers.length - 1];
    const bins = 8;
    const step = (max - min) / bins || 1;
    const edges = Array.from({ length: bins + 1 }, (_, i) => Math.round(min + i * step));
    const counts = new Array(bins).fill(0);
    for (const v of priceNumbers) {
      const idx = Math.min(bins - 1, Math.floor((v - min) / step));
      counts[idx] += 1;
    }
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    const percents = counts.map((c) => Math.round((c / total) * 100));
    const labels = counts.map((_, i) => {
      const a = edges[i];
      const b = edges[i + 1] - 1;
      return `${a.toLocaleString()}~${b.toLocaleString()}원`;
    });
    return { labels, counts, percents };
  }, [priceNumbers]);

  /* ---------- 브랜드/몰 분포 (Top 10) ---------- */
  const brandPie = useMemo(() => {
    if (items.length === 0) return { labels: [] as string[], data: [] as number[] };
    const map = new Map<string, number>();
    for (const it of items) {
      const key = (it.brand || "").trim() || (it.mallName || "").trim() || "기타";
      map.set(key, (map.get(key) || 0) + 1);
    }
    const arr = [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { labels: arr.map((d) => d.name), data: arr.map((d) => d.count) };
  }, [items]);

  /* ---------- API 호출 ---------- */
  async function fetchShop() {
    const url = `/api/naver-shop?q=${encodeURIComponent(keyword)}&sort=${sort}&display=100`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`shop ${r.status}`);
    const json = await r.json();
    const list: ShopItem[] = json?.items || json?.result?.items || [];
    setItems(list);
  }

  async function fetchTrend() {
    setTrendLoading(true);
    setTrendError(null);
    try {
      const r = await fetch("/api/datalab-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, months }),
      });
      const json = await r.json();
      if (!r.ok || !json?.ok) {
        setTrend([]);
        setTrendError(json?.error || `DataLab ${r.status}`);
      } else {
        setTrend(json.series || []);
      }
    } catch (e: any) {
      setTrend([]);
      setTrendError(String(e));
    } finally {
      setTrendLoading(false);
    }
  }

  async function runSearch() {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchShop(), fetchTrend()]);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ====== UI ====== */
  return (
    <main style={{ background: BG, minHeight: "100vh", color: TEXT }}>
      {/* 상단 타이틀만 고정 */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backdropFilter: "saturate(140%) blur(6px)",
          background: "rgba(11,18,32,.65)",
          borderBottom: `1px solid ${CARD_BORDER}`,
        }}
      >
        <div style={{ padding: "16px 18px", maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ fontWeight: 900, letterSpacing: 0.2, fontSize: 20 }}>
            🔥 네이버 핫템 셀러 레이더
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "12px 18px 28px" }}>
        {/* (1) 검색창: 타이틀 아래 */}
        <section
          style={{
            display: "flex",
            gap: 8,
            background: CARD,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 14,
            padding: 12,
            marginTop: 12,
            marginBottom: 16,
          }}
        >
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="검색어를 입력하세요"
            style={{
              flex: 1,
              background: "#0c1629",
              border: `1px solid ${CARD_BORDER}`,
              color: TEXT,
              padding: "12px 14px",
              borderRadius: 12,
              fontSize: 14,
            }}
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            style={{
              width: 130,
              background: "#0c1629",
              border: `1px solid ${CARD_BORDER}`,
              color: TEXT,
              padding: "12px 14px",
              borderRadius: 12,
              fontSize: 14,
            }}
          >
            <option value="sim">유사도</option>
            <option value="date">날짜순</option>
            <option value="asc">가격↑</option>
            <option value="dsc">가격↓</option>
          </select>
          <button
            onClick={runSearch}
            disabled={loading}
            style={{
              width: 92,
              borderRadius: 12,
              border: "none",
              color: "#fff",
              background: ACCENT,
              fontWeight: 700,
            }}
          >
            {loading ? "로딩…" : "검색"}
          </button>
        </section>

        {!!error && (
          <div
            style={{
              background: CARD,
              border: `1px solid ${CARD_BORDER}`,
              color: "#fca5a5",
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              fontWeight: 700,
            }}
          >
            오류: {error}
          </div>
        )}

        {/* 카드 레이아웃 : 가격/브랜드 */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 12,
          }}
        >
          {/* 가격 히스토그램 */}
          <div style={{ background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>
              가격 분포(히스토그램) <span style={{ color: MUTED, fontWeight: 600 }}>상/하위 5% 제외</span>
            </div>
            {priceHist.labels.length === 0 ? (
              <div style={{ color: MUTED }}>가격 데이터 없음</div>
            ) : (
              <Bar
                data={{
                  labels: priceHist.labels,
                  datasets: [
                    {
                      label: "구간 비율(%)",
                      data: priceHist.percents,
                      backgroundColor: "#22c55e",
                      borderColor: "#16a34a",
                      borderWidth: 1,
                      borderRadius: 6,
                    },
                  ],
                }}
                options={{
                  plugins: {
                    legend: { labels: { color: TEXT } },
                    tooltip: {
                      callbacks: {
                        label: (ctx) =>
                          `${ctx.raw as number}% (${priceHist.counts[ctx.dataIndex]}개)`,
                      },
                    },
                  },
                  scales: {
                    x: { ticks: { color: MUTED }, grid: { color: GRID } },
                    y: {
                      ticks: { color: MUTED, callback: (v) => `${v}%` },
                      grid: { color: GRID },
                      suggestedMax: Math.max(25, Math.ceil(Math.max(...priceHist.percents) * 1.2)),
                    },
                  },
                }}
              />
            )}
          </div>

          {/* 브랜드/몰 분포 - (2) 범례에 % 포함 */}
          <div style={{ background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>브랜드/몰 분포(Top 10)</div>
            {brandPie.labels.length === 0 ? (
              <div style={{ color: MUTED }}>브랜드/몰 데이터 없음</div>
            ) : (() => {
              const total = brandPie.data.reduce((a, b) => a + b, 0) || 1;
              const labelsWithPct = brandPie.labels.map((name, i) => {
                const pct = Math.round((brandPie.data[i] / total) * 100);
                return `${name} (${pct}%)`;
              });
              return (
                <Pie
                  data={{
                    labels: labelsWithPct,
                    datasets: [
                      {
                        data: brandPie.data,
                        backgroundColor: brandPie.labels.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]),
                        borderColor: BG,
                        borderWidth: 2,
                      },
                    ],
                  }}
                  options={{
                    plugins: {
                      legend: {
                        position: "right",
                        labels: { color: TEXT, boxWidth: 14, font: { size: 12 } },
                      },
                      tooltip: {
                        enabled: true,
                      },
                    },
                  }}
                />
              );
            })()}
          </div>
        </section>

        {/* 컨트롤 바(기간 프리셋 & 상대지수 토글) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            margin: "6px 0 8px",
          }}
        >
          <span style={{ color: MUTED, fontSize: 13, marginRight: 4 }}>기간</span>
          {[1, 3, 6, 12].map((m) => (
            <Chip key={m} active={months === m} onClick={() => setMonths(m as any)}>
              {m}개월
            </Chip>
          ))}
          <div style={{ width: 10 }} />
          <span style={{ color: MUTED, fontSize: 13, marginRight: 4 }}>상대지수</span>
          <Chip active={showIndex} onClick={() => setShowIndex((v) => !v)}>
            {showIndex ? "ON" : "OFF"}
          </Chip>

          <button
            onClick={fetchTrend}
            style={{
              marginLeft: "auto",
              padding: "8px 14px",
              borderRadius: 10,
              border: `1px solid ${CARD_BORDER}`,
              background: CARD,
              color: TEXT,
              fontWeight: 700,
            }}
            title="기간/토글 적용"
          >
            적용
          </button>
        </div>

        {/* (3) 검색 트렌드 – 월별 상대지수 숫자 표시 + (4) 디자인 톤 정리 */}
        <section style={{ background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            검색 트렌드(최근 {months}개월 · 월간, 상대지수)
          </div>
          {trendLoading && <div style={{ color: MUTED }}>불러오는 중…</div>}
          {!!trendError && <div style={{ color: "#f43f5e" }}>오류: {trendError}</div>}
          {!trendLoading && !trendError && trend.length === 0 && (
            <div style={{ color: MUTED }}>표시할 데이터가 없습니다.</div>
          )}
          {trend.length > 0 && showIndex && (
            <Line
              data={{
                labels: trend.map((d) => d.period.replace(/-/g, ".").slice(0, 7)), // YYYY.MM
                datasets: [
                  {
                    label: "상대지수",
                    data: trend.map((d) => Number(d.ratio.toFixed(2))),
                    borderColor: ACCENT,
                    backgroundColor: ACCENT_SOFT,
                    pointBackgroundColor: "#a78bfa",
                    pointBorderColor: "#4c1d95",
                    borderWidth: 2,
                    pointRadius: 3,
                    tension: 0.25,
                  },
                ],
              }}
              options={{
                plugins: { legend: { labels: { color: TEXT } } },
                scales: {
                  x: { ticks: { color: MUTED }, grid: { color: GRID } },
                  y: { ticks: { color: MUTED }, grid: { color: GRID } },
                },
              }}
              plugins={[valueLabelPlugin]}
            />
          )}
        </section>

        {/* 상품 리스트 */}
        <section
          style={{
            marginTop: 12,
            background: CARD,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 14,
            padding: 16,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            상품 리스트 총 {items.length.toLocaleString()}개
          </div>
          {items.length === 0 ? (
            <div style={{ color: MUTED }}>상품이 없습니다.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
              {items.map((it, i) => {
                const toNum = (s?: string) => Number(String(s ?? "").replace(/[^\d]/g, "")) || 0;
                const price = toNum(it.lprice) || toNum(it.price);
                return (
                  <a
                    key={i}
                    href={it.link}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: BG,
                      border: `1px solid ${CARD_BORDER}`,
                      borderRadius: 12,
                      overflow: "hidden",
                      textDecoration: "none",
                      color: TEXT,
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "4 / 3",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#0b1220",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={it.image} alt={it.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div style={{ padding: 12 }}>
                      <div
                        title={it.title}
                        style={{
                          fontSize: 13,
                          lineHeight: 1.35,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          minHeight: 36,
                          marginBottom: 6,
                        }}
                        dangerouslySetInnerHTML={{ __html: it.title }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: MUTED }}>
                        <span style={{ color: TEXT }}>{price ? `${price.toLocaleString()}원` : "-"}</span>
                        <span>{it.mallName || it.brand || ""}</span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
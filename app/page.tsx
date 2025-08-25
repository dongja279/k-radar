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

/* ====== 디자인 토큰 ====== */
const ACCENT = "#6C5CE7";
const ACCENT_SOFT = "rgba(108,92,231,.15)";
const BG = "#0b1220";
const CARD = "#0f172a";
const CARD_BORDER = "#1f2937";
const TEXT = "#e5e7eb";
const MUTED = "#9ca3af";
const GRID = "rgba(148,163,184,0.12)";

const PIE_COLORS = [
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#a78bfa",
  "#f87171",
  "#22d3ee",
  "#f59e0b",
  "#c084fc",
  "#4ade80",
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

const toNum = (s?: string) => Number(String(s ?? "").replace(/[^\d]/g, "")) || 0;
const krw = (n: number) => n.toLocaleString() + "원";

/* 반응형 훅 */
function useIsMobile(breakpoint = 900) {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const q = window.matchMedia(`(max-width:${breakpoint}px)`);
    const onChange = () => setIsMobile(q.matches);
    onChange();
    q.addEventListener ? q.addEventListener("change", onChange) : q.addListener(onChange);
    return () =>
      q.removeEventListener ? q.removeEventListener("change", onChange) : q.removeListener(onChange);
  }, [breakpoint]);
  return isMobile;
}

/* 칩 */
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
        minHeight: 36,
        transition: "all .15s ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* 라인차트 값 라벨 */
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
      ctx.fillText(Math.round(val as number).toString(), point.x, point.y - 6);
    });
    ctx.restore();
  },
};

export default function Page() {
  const isMobile = useIsMobile(900);

  const [keyword, setKeyword] = useState("스킨부스터");
  const [sort, setSort] = useState<"sim" | "date" | "asc" | "dsc">("sim");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<ShopItem[]>([]);

  // 데이터랩 트렌드
  const [months, setMonths] = useState<1 | 3 | 6 | 12>(12);
  const [showIndex, setShowIndex] = useState(true);
  const [trend, setTrend] = useState<{ period: string; ratio: number }[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);

  // 연관검색어
  const [suggests, setSuggests] = useState<string[]>([]);
  const [sugLoading, setSugLoading] = useState(false);

  /* 가격 숫자 추출 & 5% 양끝 제거 */
  const priceNumbers = useMemo(() => {
    const nums = items
      .map((it) => toNum(it.lprice) || toNum(it.price) || toNum(it.title?.match(/\d[\d,]{3,}/g)?.[0]))
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

  /* 히스토그램 */
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

  /* 브랜드/몰 분포 */
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

  /* API 호출 */
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

  // 연관검색어 (디바운스 250ms)
  useEffect(() => {
    if (!keyword) {
      setSuggests([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setSugLoading(true);
        const r = await fetch(`/api/naver-suggest?q=${encodeURIComponent(keyword)}`, {
          cache: "no-store",
        });
        const json = await r.json();
        setSuggests(json?.suggestions || []);
      } catch {
        setSuggests([]);
      } finally {
        setSugLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [keyword]);

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

  /* ====== AI 인사이트(섹션형 불릿) ====== */
  type InsightSection = { icon: string; title: string; bullets: string[] };

  const insightSections: InsightSection[] = useMemo(() => {
    const sections: InsightSection[] = [];

    // 가격
    if (priceNumbers.length > 0) {
      const n = priceNumbers.length;
      const pick = (p: number) => priceNumbers[Math.max(0, Math.min(n - 1, Math.round(p * (n - 1))))];
      const q1 = pick(0.25);
      const q2 = pick(0.5);
      const q3 = pick(0.75);
      const min = priceNumbers[0];
      const max = priceNumbers[n - 1];
      const avg = Math.round(priceNumbers.reduce((a, b) => a + b, 0) / n);

      sections.push({
        icon: "💰",
        title: "가격대 스캔",
        bullets: [
          `주력 분포: ${krw(q1)} ~ ${krw(q3)} (Q1~Q3)`,
          `중앙값: ${krw(q2)} / 평균: ${krw(avg)}`,
          `권장 판매가: **${krw(q1)} ~ ${krw(q3)}**`,
          `주의: ${krw(min)} 이하 덤핑 · ${krw(max)} 이상 프리미엄은 효율 저하 가능`,
        ],
      });
    } else {
      sections.push({
        icon: "💰",
        title: "가격대 스캔",
        bullets: ["가격 데이터가 부족합니다. 키워드/기간을 조정해 보세요."],
      });
    }

    // 브랜드
    if (brandPie.labels.length > 0) {
      const total = brandPie.data.reduce((a, b) => a + b, 0) || 1;
      const pairs = brandPie.labels.map((name, i) => ({ name, cnt: brandPie.data[i] }));
      const top3 = pairs.slice(0, 3);
      const topShare = Math.round((top3.reduce((s, p) => s + p.cnt, 0) / total) * 100);
      sections.push({
        icon: "🏷️",
        title: "브랜드 구도",
        bullets: [
          ...top3.map((p) => `${p.name}: ${Math.round((p.cnt / total) * 100)}%`),
          topShare >= 65
            ? "진입 난이도: 상 (과점 구조 → 가격/후킹 차별화 필요)"
            : "진입 난이도: 중 (분산 경쟁 → 세트/구성 전략 유효)",
        ],
      });
    }

    // 트렌드
    if (trend.length > 0) {
      const last = trend[trend.length - 1];
      const prev = trend[trend.length - 2] || last;
      const peak = trend.reduce((p, c) => (c.ratio > p.ratio ? c : p), trend[0]);
      const low = trend.reduce((p, c) => (c.ratio < p.ratio ? c : p), trend[0]);
      const mom = Math.round((last.ratio - prev.ratio) * 10) / 10;
      const tail = trend.slice(-3).map((d) => d.ratio);
      const slope = tail.length >= 2 ? Math.round((tail[tail.length - 1] - tail[0]) * 10) / 10 : 0;
      const slopeTxt = slope > 1 ? "상승" : slope < -1 ? "하락" : "보합";

      sections.push({
        icon: "📈",
        title: "수요 트렌드",
        bullets: [
          `최근값: ${Math.round(last.ratio)}p (전월 대비 ${mom >= 0 ? "+" : ""}${mom}p)`,
          `최근 3개월 흐름: **${slopeTxt}**`,
          `피크: ${peak.period.replace("-", ".")} (${Math.round(peak.ratio)}p)`,
          `저점: ${low.period.replace("-", ".")} (${Math.round(low.ratio)}p)`,
          "시즌성 고려해 재고·광고 강도를 조절하세요.",
        ],
      });
    } else {
      sections.push({
        icon: "📈",
        title: "수요 트렌드",
        bullets: ["데이터랩 트렌드가 부족합니다. 기간/키워드를 조정해 다시 확인하세요."],
      });
    }

    // 실행 체크리스트
    sections.push({
      icon: "✅",
      title: "바로 실행 체크리스트",
      bullets: [
        "가격은 Q1~Q3 사이로 세팅",
        "TOP 브랜드 대비 키워드/카피 준비",
        "트렌드 기울기에 따라 광고비 증감",
        "인기 속성(세트/저자극 등) 키워드로 상세페이지 보강",
      ],
    });

    return sections;
  }, [priceNumbers, brandPie, trend]);

  /* ====== UI ====== */
  return (
    <main style={{ background: BG, minHeight: "100vh", color: TEXT }}>
      {/* 상단 타이틀 */}
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
        {/* 검색창 */}
        <section
          style={{
            display: "flex",
            gap: 8,
            background: CARD,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 14,
            padding: 12,
            marginTop: 12,
            marginBottom: 8,
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
              minHeight: 44,
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
              minHeight: 44,
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
              minHeight: 44,
            }}
          >
            {loading ? "로딩…" : "검색"}
          </button>
        </section>

        {/* 연관검색어 */}
        <section
          style={{
            background: CARD,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 14,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ color: MUTED, fontSize: 13, marginBottom: 8 }}>
            연관검색어 {sugLoading ? "(불러오는 중…)" : ""}
          </div>
          {suggests.length === 0 ? (
            <div style={{ color: MUTED, fontSize: 13 }}>제안어가 없습니다.</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {suggests.map((s) => (
                <Chip
                  key={s}
                  onClick={() => {
                    setKeyword(s);
                    setTimeout(runSearch, 0);
                  }}
                >
                  {s}
                </Chip>
              ))}
            </div>
          )}
        </section>

        {/* AI 인사이트 - 섹션형 불릿 */}
        <section className="card" style={{ marginBottom: 12 }}>
          <div className="section-title">🤖 AI 인사이트 (셀러 전용 코멘트)</div>
          <div style={{ display: "grid", gap: 10 }}>
            {insightSections.map((sec, idx) => (
              <div
                key={idx}
                style={{
                  border: `1px dashed ${CARD_BORDER}`,
                  borderRadius: 10,
                  padding: 12,
                  background: "rgba(108,92,231,.04)",
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 6 }}>
                  {sec.icon} {sec.title}
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                  {sec.bullets.map((b, i) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: b.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>") }} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* 가격/브랜드 */}
        <section className="grid-cards">
          <div className="card">
            <div className="section-title">
              가격 분포(히스토그램) <span style={{ color: MUTED, fontWeight: 600 }}>상/하위 5% 제외</span>
            </div>
            {priceHist.labels.length === 0 ? (
              <div style={{ color: MUTED }}>가격 데이터 없음</div>
            ) : (
              <div style={{ height: isMobile ? 230 : 300 }}>
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
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { labels: { color: TEXT, font: { size: isMobile ? 11 : 12 } } },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => `${ctx.raw as number}% (${priceHist.counts[ctx.dataIndex]}개)`,
                        },
                      },
                    },
                    scales: {
                      x: { ticks: { color: MUTED, font: { size: isMobile ? 10 : 12 } }, grid: { color: GRID } },
                      y: {
                        ticks: { color: MUTED, font: { size: isMobile ? 10 : 12 }, callback: (v) => `${v}%` },
                        grid: { color: GRID },
                        suggestedMax: Math.max(25, Math.ceil(Math.max(...priceHist.percents) * 1.2)),
                      },
                    },
                  }}
                />
              </div>
            )}
          </div>

          <div className="card">
            <div className="section-title">브랜드/몰 분포(Top 10)</div>
            {brandPie.labels.length === 0 ? (
              <div style={{ color: MUTED }}>브랜드/몰 데이터 없음</div>
            ) : (() => {
              const total = brandPie.data.reduce((a, b) => a + b, 0) || 1;
              const labelsWithPct = brandPie.labels.map((name, i) => {
                const pct = Math.round((brandPie.data[i] / total) * 100);
                return `${name} (${pct}%)`;
              });
              return (
                <div style={{ height: isMobile ? 260 : 300 }}>
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
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: isMobile ? "bottom" : "right",
                          labels: { color: TEXT, boxWidth: 12, font: { size: isMobile ? 11 : 12 } },
                        },
                        tooltip: { enabled: true },
                      },
                    }}
                  />
                </div>
              );
            })()}
          </div>
        </section>

        {/* 컨트롤 바 */}
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
              minHeight: 40,
            }}
            title="기간/토글 적용"
          >
            적용
          </button>
        </div>

        {/* 검색 트렌드 */}
        <section className="card">
          <div className="section-title">검색 트렌드(최근 {months}개월 · 월간, 상대지수)</div>
          {trendLoading && <div style={{ color: MUTED }}>불러오는 중…</div>}
          {!!trendError && <div style={{ color: "#f43f5e" }}>오류: {trendError}</div>}
          {!trendLoading && !trendError && trend.length === 0 && (
            <div style={{ color: MUTED }}>표시할 데이터가 없습니다.</div>
          )}
          {trend.length > 0 && showIndex && (
            <div style={{ height: isMobile ? 240 : 300 }}>
              <Line
                data={{
                  labels: trend.map((d) => d.period.replace(/-/g, ".").slice(0, 7)),
                  datasets: [
                    {
                      label: "상대지수",
                      data: trend.map((d) => Number(d.ratio.toFixed(2))),
                      borderColor: ACCENT,
                      backgroundColor: ACCENT_SOFT,
                      pointBackgroundColor: "#a78bfa",
                      pointBorderColor: "#4c1d95",
                      borderWidth: isMobile ? 1.5 : 2,
                      pointRadius: isMobile ? 2 : 3,
                      tension: 0.25,
                    },
                  ],
                }}
                options={{
                  maintainAspectRatio: false,
                  plugins: { legend: { labels: { color: TEXT, font: { size: isMobile ? 11 : 12 } } } },
                  scales: {
                    x: { ticks: { color: MUTED, font: { size: isMobile ? 10 : 12 } }, grid: { color: GRID } },
                    y: { ticks: { color: MUTED, font: { size: isMobile ? 10 : 12 } }, grid: { color: GRID } },
                  },
                }}
                plugins={[valueLabelPlugin]}
              />
            </div>
          )}
        </section>

        {/* 상품 리스트 */}
        <section className="card" style={{ marginTop: 12 }}>
          <div className="section-title">상품 리스트 총 {items.length.toLocaleString()}개</div>
          {items.length === 0 ? (
            <div style={{ color: MUTED }}>상품이 없습니다.</div>
          ) : (
            <div className="products-grid">
              {items.map((it, i) => {
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
                        <span style={{ color: TEXT }}>{price ? krw(price) : "-"}</span>
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

      {/* 반응형 스타일 */}
      <style jsx>{`
        .grid-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }
        .card {
          background: ${CARD};
          border: 1px solid ${CARD_BORDER};
          border-radius: 14px;
          padding: 16px;
        }
        .section-title {
          font-weight: 800;
          margin-bottom: 8px;
        }
        .products-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 900px) {
          .grid-cards {
            grid-template-columns: 1fr;
            gap: 10px;
          }
          .products-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
          .card {
            padding: 12px;
            border-radius: 12px;
          }
          .section-title {
            font-size: 14px;
          }
        }
        @media (max-width: 480px) {
          .products-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }
        }
      `}</style>
    </main>
  );
}

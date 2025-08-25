// app/api/naver-shop/route.js
export const runtime = "nodejs";
import { NextResponse } from "next/server";

// 아주 단순한 한글 토크나이저 (2~6글자, 숫자/특수문자 제거)
function extractTokens(txt = "") {
  const clean = String(txt).replace(/<[^>]*>/g, " ").replace(/[^\uAC00-\uD7A3a-zA-Z0-9\s]/g, " ");
  const tokens = clean.match(/[\uAC00-\uD7A3a-zA-Z0-9]{2,6}/g) || [];
  return tokens.filter(t => !/^[0-9]+$/.test(t)); // 숫자만 제외
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "런닝화";
  const sort = searchParams.get("sort") || "sim";
  const display = Math.min(Number(searchParams.get("display") || 100), 100);
  const start = 1;

  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(q)}&sort=${sort}&display=${display}&start=${start}`;

  const r = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID,
      "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET,
    },
    cache: "no-store",
  });

  const rawText = await r.text();
  if (!r.ok) {
    return NextResponse.json({ ok: false, status: r.status, error: rawText }, { status: r.status });
  }
  const data = JSON.parse(rawText);

  const items = data.items || [];
  // 브랜드/몰 카운트
  const brandCount = new Map();
  const mallCount = new Map();

  // 연관 키워드 후보 추출
  const kwCount = new Map();
  for (const it of items) {
    const brand = (it.brand || "").trim();
    const mall = (it.mallName || "").trim();
    if (brand) brandCount.set(brand, (brandCount.get(brand) || 0) + 1);
    if (mall) mallCount.set(mall, (mallCount.get(mall) || 0) + 1);

    const toks = extractTokens(it.title);
    for (const t of toks) kwCount.set(t, (kwCount.get(t) || 0) + 1);
  }

  // 상위 브랜드/몰/연관어 정리
  const topBrands = [...brandCount.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 20)
                     .map(([name,count])=>({name,count}));
  const topMalls  = [...mallCount.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 20)
                     .map(([name,count])=>({name,count}));

  // 너무 흔한 단어 제거(간단 스톱워드)
  const stop = new Set(["공식","정품","무료","배송","세일","신상","남성","여성","운동","런닝","구두","신발","브랜드","사이즈","색상"]);
  const related = [...kwCount.entries()]
    .filter(([w,c]) => !stop.has(w))
    .sort((a,b)=>b[1]-a[1])
    .slice(0, 20)
    .map(([word,count])=>({word,count}));

  return NextResponse.json({
    ok: true,
    total: data.total ?? items.length,
    items,
    summary: { topBrands, topMalls, related },
  });
}

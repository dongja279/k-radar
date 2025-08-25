// app/api/datalab-search/route.js
import { NextResponse } from "next/server";

// yyyy-MM-dd
function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// 지난달 말까지, N개월 구간
function monthRange(n = 12) {
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(firstOfThisMonth.getTime() - 24 * 60 * 60 * 1000); // 지난달 말
  const start = new Date(end.getFullYear(), end.getMonth() - (n - 1), 1); // n개월 전 1일
  return { startDate: fmt(start), endDate: fmt(end) };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const keyword = body?.keyword?.trim();
    const months = Number(body?.months) || 12;
    const keywords = Array.isArray(body?.keywords)
      ? body.keywords.filter((s) => typeof s === "string" && s.trim()).slice(0, 20)
      : [];

    if (!keyword && keywords.length === 0) {
      return NextResponse.json({ ok: false, error: "keyword(s) required" }, { status: 400 });
    }

    const { startDate, endDate } = monthRange(months);

    // keywordGroups 구성 (메인 + 연관들)
    const groups = [
      ...(keyword ? [{ groupName: keyword, keywords: [keyword] }] : []),
      ...keywords.map((k) => ({ groupName: k, keywords: [k] })),
    ];

    const r = await fetch("https://openapi.naver.com/v1/datalab/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET,
      },
      body: JSON.stringify({
        startDate,
        endDate,
        timeUnit: "month",
        keywordGroups: groups,
      }),
      cache: "no-store",
    });

    if (!r.ok) {
      const raw = await r.text();
      return NextResponse.json({ ok: false, status: r.status, error: raw }, { status: r.status });
    }

    const json = await r.json();
    const results = json?.results || [];

    // 메인 시리즈
    const mainSeries =
      results.find((x) => x.title === keyword)?.data?.map((d) => ({
        period: d.period,
        ratio: Number(d.ratio) || 0,
      })) || [];

    // 연관 키워드별 시리즈
    const byKeyword = {};
    for (const k of keywords) {
      const found = results.find((x) => x.title === k);
      byKeyword[k] =
        found?.data?.map((d) => ({ period: d.period, ratio: Number(d.ratio) || 0 })) || [];
    }

    return NextResponse.json({ ok: true, series: mainSeries, byKeyword, months });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

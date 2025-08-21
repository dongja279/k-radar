// app/api/datalab-search/route.js
import { NextResponse } from "next/server";

// yyyy-MM-dd
function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// 최근 12개월(지난달 말까지)
function monthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(first.getTime() - 24 * 60 * 60 * 1000); // 지난달 말
  const start = new Date(end.getFullYear(), end.getMonth() - 11, 1); // 12개월 전 1일
  return { startDate: fmt(start), endDate: fmt(end) };
}

export async function POST(req) {
  try {
    const { keyword } = await req.json();
    if (!keyword) {
      return NextResponse.json({ ok: false, error: "keyword required" }, { status: 400 });
    }

    const { startDate, endDate } = monthRange();

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
        keywordGroups: [{ groupName: keyword, keywords: [keyword] }],
      }),
    });

    if (!r.ok) {
      const raw = await r.text();
      return NextResponse.json({ ok: false, status: r.status, error: raw }, { status: r.status });
    }

    const json = await r.json();
    const series = (json?.results?.[0]?.data || []).map((d) => ({
      period: d.period,             // 'YYYY-MM'
      ratio: Number(d.ratio) || 0,
    }));

    return NextResponse.json({ ok: true, series });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
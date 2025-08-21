// app/api/naver-shop/route.js
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "런닝화";
    const sort = searchParams.get("sort") || "sim"; // sim | date | asc | dsc
    const display = Math.min(parseInt(searchParams.get("display") || "100", 10), 100);

    const url = new URL("https://openapi.naver.com/v1/search/shop.json");
    url.searchParams.set("query", q);
    url.searchParams.set("display", String(display));
    url.searchParams.set("start", "1");
    url.searchParams.set("sort", sort);

    const res = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ ok: false, error: text }, { status: res.status });
    }

    const json = await res.json();
    const items = Array.isArray(json?.items) ? json.items : [];

    // 숫자 가격 추출
    const prices = [];
    const brandCountMap = new Map();

    const normalized = items.map((it, idx) => {
      const price = Number(it.lprice || it.price || 0);
      if (price > 0) prices.push(price);

      const brandKey = (it.brand && it.brand.trim()) || (it.mallName && it.mallName.trim()) || "기타";
      brandCountMap.set(brandKey, (brandCountMap.get(brandKey) || 0) + 1);

      return {
        id: idx + 1,
        title: it.title?.replace(/<\/?b>/g, "") || "상품",
        link: it.link,
        image: it.image,
        mallName: it.mallName || "",
        brand: it.brand || "",
        price,
      };
    });

    // 가격 히스토그램 (상하위 5% 제외, 8구간)
    let bins = [];
    if (prices.length >= 10) {
      const sorted = [...prices].sort((a, b) => a - b);
      const lowIdx = Math.floor(sorted.length * 0.05);
      const highIdx = Math.ceil(sorted.length * 0.95) - 1;
      const trimmed = sorted.slice(lowIdx, highIdx + 1);
      const min = trimmed[0];
      const max = trimmed[trimmed.length - 1];
      const bucket = 8;
      const step = (max - min) / bucket || 1;

      const counts = Array(bucket).fill(0);
      trimmed.forEach((p) => {
        let idx = Math.floor((p - min) / step);
        if (idx >= bucket) idx = bucket - 1;
        if (idx < 0) idx = 0;
        counts[idx] += 1;
      });

      bins = counts.map((c, i) => {
        const start = Math.round(min + step * i);
        const end = Math.round(min + step * (i + 1));
        return { label: `${start.toLocaleString()}~${end.toLocaleString()}원`, value: c };
      });
    }

    // 브랜드 분포 Top 10
    const brandArr = Array.from(brandCountMap.entries()).map(([name, count]) => ({ name, count }));
    brandArr.sort((a, b) => b.count - a.count);
    const brandTop10 = brandArr.slice(0, 10);

    return NextResponse.json({
      ok: true,
      items: normalized,
      priceBins: bins,
      brandTop10,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
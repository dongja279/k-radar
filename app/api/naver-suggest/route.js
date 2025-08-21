// app/api/naver-suggest/route.js
import { NextResponse } from "next/server";

/**
 * q(검색어)를 받아 네이버 Suggest(자동완성)에서 제안어를 가져옵니다.
 * 공식 문서화는 안 되었지만, r_format=json 을 주면 JSON으로 응답합니다.
 * CORS 회피를 위해 서버에서 프록시 처리.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    if (!q) return NextResponse.json({ ok: true, suggestions: [] });

    const target =
      "https://ac.search.naver.com/nx/ac?" +
      new URLSearchParams({
        q,
        // 아래 파라미터는 네이버 프론트에서 쓰는 일반적인 값들입니다.
        st: "100",
        frm: "nv",
        ans: "2",
        r_format: "json",
        r_enc: "utf-8",
        r_lt: "1000",
      }).toString();

    const r = await fetch(target, {
      // 일부 환경에서 UA 없으면 차단되는 경우가 있어 헤더 추가
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });

    if (!r.ok) {
      const raw = await r.text();
      return NextResponse.json(
        { ok: false, status: r.status, error: raw },
        { status: r.status }
      );
    }

    const json = await r.json();

    // 응답 구조가 배열 중첩이라 안전하게 문자열만 긁어오는 파서
    const bucket = new Set();
    const walk = (v) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (typeof v === "string") bucket.add(v);
    };
    walk(json?.items ?? []);

    // 필터링: 너무 짧은 단어, 공백, q와 무관한 문자열 제거
    const suggestions = [...bucket]
      .filter((s) => s && s.length >= 2 && s.toLowerCase() !== q.toLowerCase())
      .filter((s) => s.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 12); // 최대 12개

    return NextResponse.json({ ok: true, suggestions });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

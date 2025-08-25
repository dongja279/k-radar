// app/api/naver-suggest/route.js
import { NextResponse } from "next/server";

/**
 * 네이버 자동완성 API를 호출해 연관검색어를 가져옴
 * 참고 응답: { items: [ [ [ "키워드", ... ], [ "키워드2", ... ], ... ] ] }
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    if (!q) {
      return NextResponse.json({ ok: true, suggestions: [] });
    }

    // UTF-8 강제, 일반 검색 탭의 자동완성 소스 사용
    const url =
      "https://ac.search.naver.com/nx/ac?" +
      new URLSearchParams({
        q,
        st: "100",
        frm: "nx",
        // 아래 파라미터들이 있어야 한글이 깨지지 않고, 응답 구조가 안정적입니다.
        q_enc: "utf-8",
        ie: "utf-8",
        oe: "utf-8",
        r_format: "json", // 혹시 jsonp로 오는 환경 방지
        r_enc: "utf-8",
        pkid: "65",        // 통합검색 자동완성
       ssc: "tab.nx.all",
      });

    const r = await fetch(url, {
      // 일부 환경에서 CORS/봇 차단 회피용
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Referer: "https://www.naver.com/",
        Accept: "application/json,text/javascript,*/*;q=0.1",
      },
      cache: "no-store",
    });

    const text = await r.text();

    // JSON 문자열/JSONP 모두 수용
    const json = (() => {
      try {
        return JSON.parse(text);
      } catch {
        // jsonp 형태일 경우 괄호 안만 파싱
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        return JSON.parse(text.slice(start, end + 1));
      }
    })();

    const raw = Array.isArray(json?.items) ? json.items[0] : [];
    // 각 아이템은 ["키워드", ...] 배열. 0번째가 문자열 키워드
    const list = (raw || [])
      .map((arr) => (Array.isArray(arr) ? String(arr[0]) : ""))
      .filter((s) => s && s.length > 1)      // 한 글자 제거
      .map((s) => s.trim());

    // 유니크 처리
    const suggestions = [...new Set(list)].slice(0, 15);

    return NextResponse.json({ ok: true, suggestions });
  } catch (e) {
    return NextResponse.json(
      { ok: false, suggestions: [], error: String(e) },
      { status: 200 }
    );
  }
}

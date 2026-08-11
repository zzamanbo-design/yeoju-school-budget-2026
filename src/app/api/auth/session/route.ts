import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json({ authenticated: true, session });
  } catch (err) {
    return NextResponse.json({ error: "세션 확인 중 오류가 발생했습니다." }, { status: 500 });
  }
}

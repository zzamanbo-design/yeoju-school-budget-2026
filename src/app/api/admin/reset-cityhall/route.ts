import { NextRequest, NextResponse } from "next/server";
import { adminDb as db } from "@/lib/firebase-admin";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/hash";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const cityhallId = "cityhall";
    const defaultPassword = "yeoju2026!";
    const hashed = hashPassword(defaultPassword);

    const accountRef = db.collection("school_accounts").doc(cityhallId);
    
    // Check if cityhall exists
    const accountDoc = await accountRef.get();
    if (!accountDoc.exists) {
      return NextResponse.json(
        { error: "여주시청(cityhall) 계정이 존재하지 않습니다." },
        { status: 404 }
      );
    }

    await accountRef.update({
      password_hash: hashed,
      password_changed: false,
    });

    return NextResponse.json({ success: true, message: "여주시청 계정 비밀번호가 성공적으로 초기화되었습니다." });
  } catch (err) {
    console.error("Reset cityhall password error:", err);
    return NextResponse.json(
      { error: "비밀번호 초기화 중 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

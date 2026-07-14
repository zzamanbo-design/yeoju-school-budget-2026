import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { hashPassword } from "@/lib/hash";
import { getSession, createSessionToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const { newPassword, confirmPassword } = await request.json();

    if (!newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "새 비밀번호와 비밀번호 확인을 모두 입력해 주세요." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "비밀번호가 일치하지 않습니다." },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "비밀번호는 최소 6자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    // 1. school_accounts 컬렉션에서 계정 조회 및 비밀번호 업데이트
    const accountRef = doc(db, "school_accounts", String(session.accountId));
    const accountSnap = await getDoc(accountRef);

    if (!accountSnap.exists()) {
      return NextResponse.json(
        { error: "계정을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 새 비밀번호 해싱 및 저장
    const hashed = hashPassword(newPassword);
    await updateDoc(accountRef, {
      password_hash: hashed,
      password_changed: true,
    });

    // 새 JWT 세션 토큰 재발급 (passwordChanged: true)
    const newToken = await createSessionToken({
      ...session,
      passwordChanged: true,
    });

    const response = NextResponse.json({
      success: true,
      message: "비밀번호가 성공적으로 변경되었습니다.",
      role: session.role,
    });

    // 새 세션 쿠키 설정
    response.cookies.set(COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24시간
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Update password error:", err);
    return NextResponse.json(
      { error: "요청 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { verifyPassword } from "@/lib/hash";
import { createSessionToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { loginId, password } = await request.json();

    if (!loginId || !password) {
      return NextResponse.json(
        { error: "학교명 또는 비밀번호가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    // 1. school_accounts 컬렉션에서 계정 조회
    const accountRef = doc(db, "school_accounts", loginId.trim());
    const accountSnap = await getDoc(accountRef);

    if (!accountSnap.exists()) {
      return NextResponse.json(
        { error: "학교명 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    const accountData = accountSnap.data();

    // 2. 비밀번호 해시값 검증
    if (!verifyPassword(password, accountData.password_hash)) {
      return NextResponse.json(
        { error: "학교명 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    // 3. 학교 권한(school)인 경우, 학교 레벨 조회
    let schoolLevel = null;
    let schoolName = "";

    if (accountData.role === "school" && accountData.school_name) {
      schoolName = accountData.school_name;
      const schoolRef = doc(db, "schools", schoolName);
      const schoolSnap = await getDoc(schoolRef);
      if (schoolSnap.exists()) {
        schoolLevel = schoolSnap.data().school_level;
      }
    }

    // 4. JWT 세션 토큰 생성
    const token = await createSessionToken({
      accountId: accountSnap.id,
      schoolId: schoolName || null,
      schoolName: schoolName || "교육지원청",
      schoolLevel,
      role: accountData.role,
      passwordChanged: accountData.password_changed ?? false,
    });

    // 5. 로그인 시각 업데이트
    await updateDoc(accountRef, {
      last_login_at: new Date(),
    });

    const response = NextResponse.json({
      success: true,
      needsPasswordChange: !accountData.password_changed,
      user: {
        schoolName: schoolName || "교육지원청",
        schoolLevel,
        role: accountData.role,
      },
    });

    // httpOnly 쿠키로 세션 저장
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24시간
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "요청 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

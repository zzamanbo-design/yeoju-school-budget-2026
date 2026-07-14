import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, updateDoc, getDoc, collection, getDocs, query, where, writeBatch } from "firebase/firestore";
import { hashPassword } from "@/lib/hash";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const { schoolId, bulk } = await request.json();

    if (bulk) {
      // 1) 모든 학교(role === "school") 계정 일괄 조회
      const q = query(collection(db, "school_accounts"), where("role", "==", "school"));
      const snap = await getDocs(q);
      
      const batch = writeBatch(db);
      snap.forEach((accountDoc) => {
        batch.update(accountDoc.ref, {
          password_hash: hashPassword("yeoju2026!"),
          password_changed: false,
        });
      });

      // 2) 배치 커밋 실행
      await batch.commit();

      return NextResponse.json({
        success: true,
        message: "모든 학교의 비밀번호가 'yeoju2026!'으로 일괄 초기화되었습니다.",
      });
    }

    if (!schoolId) {
      return NextResponse.json(
        { error: "학교 식별자(ID)가 필요합니다." },
        { status: 400 }
      );
    }

    // Firestore school_accounts 비밀번호 초기화
    const accountRef = doc(db, "school_accounts", schoolId);
    const accountSnap = await getDoc(accountRef);

    if (!accountSnap.exists()) {
      return NextResponse.json(
        { error: "해당 학교 계정을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    await updateDoc(accountRef, {
      password_hash: hashPassword("yeoju2026!"),
      password_changed: false,
    });

    return NextResponse.json({
      success: true,
      message: "비밀번호가 'yeoju2026!'으로 초기화되었습니다.",
    });
  } catch (err) {
    console.error("Reset password route error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

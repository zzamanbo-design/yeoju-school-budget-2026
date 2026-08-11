import { NextRequest, NextResponse } from "next/server";
import { adminDb as db } from "@/lib/firebase-admin";
import { getSession } from "@/lib/auth";

// 테스트 예산 단일 등록
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const data = await request.json();

    if (data.schoolName !== "여주교육지원청") {
      return NextResponse.json(
        { error: "테스트 예산 배정은 '여주교육지원청'에만 가능합니다." },
        { status: 400 }
      );
    }

    const docRef = db.collection("allocations").doc();
    await docRef.set({
      school_name: data.schoolName,
      project_type: data.projectType,
      project_code_name: data.projectCodeName,
      funding_source: data.fundingSource,
      allocated_amount: Number(data.allocatedAmount),
      created_at: new Date(),
    });

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (err) {
    console.error("Test budget allocation error:", err);
    return NextResponse.json(
      { error: "테스트 예산 배정 중 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 테스트 예산 개별 학교 전체 초기화
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const schoolName = searchParams.get("schoolName");

    if (schoolName !== "여주교육지원청") {
      return NextResponse.json(
        { error: "테스트 예산 초기화는 '여주교육지원청'에만 가능합니다." },
        { status: 400 }
      );
    }

    const allocationsSnap = await db
      .collection("allocations")
      .where("school_name", "==", schoolName)
      .get();

    for (let i = 0; i < allocationsSnap.docs.length; i += 400) {
      const chunk = allocationsSnap.docs.slice(i, i + 400);
      const batch = db.batch();
      chunk.forEach((d: any) => batch.delete(d.ref));
      await batch.commit();
    }

    return NextResponse.json({ success: true, deletedCount: allocationsSnap.size });
  } catch (err) {
    console.error("Test budget delete error:", err);
    return NextResponse.json(
      { error: "테스트 예산 초기화 중 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

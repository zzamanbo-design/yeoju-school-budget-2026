import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, query } from "firebase/firestore";
import { getSession } from "@/lib/auth";

// 1. 모든 예산 배정 목록 조회 (학교명 포함)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    // 1) 모든 allocations 가져오기
    const allocQuery = query(collection(db, "allocations"));
    const allocSnap = await getDocs(allocQuery);

    // 2) 모든 expenditures 가져와서 누적 지출 맵 빌드
    const expQuery = query(collection(db, "expenditures"));
    const expSnap = await getDocs(expQuery);
    
    const expMap = new Map<string, number>();
    expSnap.forEach((expDoc) => {
      const data = expDoc.data();
      const allocId = data.allocation_id;
      const amt = Number(data.amount) || 0;
      if (allocId) {
        expMap.set(allocId, (expMap.get(allocId) || 0) + amt);
      }
    });

    // 3) 데이터 포맷팅
    const allocationsList: any[] = [];
    allocSnap.forEach((allocDoc) => {
      const a = allocDoc.data();
      const spentAmount = expMap.get(allocDoc.id) || 0;
      allocationsList.push({
        id: allocDoc.id,
        schoolId: a.school_name,
        schoolName: a.school_name || "알 수 없음",
        projectCode: a.project_code,
        projectName: a.project_name,
        fundingSource: a.funding_source,
        projectType: a.project_type,
        allocatedAmount: Number(a.allocated_amount) || 0,
        spentAmount: spentAmount,
        createdAt: a.created_at?.toDate ? a.created_at.toDate().toISOString() : new Date().toISOString(),
      });
    });

    return NextResponse.json({ success: true, allocations: allocationsList });
  } catch (err) {
    console.error("GET allocations error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 2. 예산 배정액 개별 수정
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const { id, allocatedAmount } = await request.json();

    if (!id || allocatedAmount === undefined || allocatedAmount < 0) {
      return NextResponse.json(
        { error: "올바른 예산 ID와 금액을 입력해 주세요." },
        { status: 400 }
      );
    }

    // Firestore allocations 업데이트
    const allocRef = doc(db, "allocations", id);
    await updateDoc(allocRef, {
      allocated_amount: Number(allocatedAmount),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT allocations error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

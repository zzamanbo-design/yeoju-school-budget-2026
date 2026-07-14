import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, addDoc, deleteDoc, query, where } from "firebase/firestore";
import { getSession } from "@/lib/auth";
import { validateExpenditure } from "@/lib/validation";

// 1. 학교별 지출 내역 전체 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== "school") {
      return NextResponse.json(
        { error: "학교 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const schoolId = session.schoolId; // schoolId is the school name string

    // 1) 학교의 allocations 전체 가져오기
    const allocQuery = query(collection(db, "allocations"), where("school_name", "==", String(schoolId)));
    const allocSnap = await getDocs(allocQuery);

    if (allocSnap.empty) {
      return NextResponse.json({ success: true, expenditures: [] });
    }

    // allocations 맵 구축 (id -> details)
    const allocMap = new Map<string, any>();
    allocSnap.forEach((allocDoc) => {
      allocMap.set(allocDoc.id, allocDoc.data());
    });

    // 2) 학교의 expenditures 전체 가져오기
    const expQuery = query(collection(db, "expenditures"), where("school_name", "==", String(schoolId)));
    const expSnap = await getDocs(expQuery);

    const formatted: any[] = [];
    expSnap.forEach((expDoc) => {
      const e = expDoc.data();
      const alloc = allocMap.get(e.allocation_id);
      formatted.push({
        id: expDoc.id,
        allocationId: e.allocation_id,
        projectCode: alloc?.project_code || "알 수 없음",
        projectName: alloc?.project_name || "알 수 없음",
        fundingSource: alloc?.funding_source || "알 수 없음",
        expenseCategory: e.expense_category,
        amount: Number(e.amount) || 0,
        expenseDate: e.expense_date,
        description: e.description || "",
        createdAt: e.created_at?.toDate ? e.created_at.toDate().toISOString() : new Date().toISOString(),
      });
    });

    // 지출 일자 및 생성 시각 기준 내림차순 정렬
    formatted.sort((a, b) => {
      const dateCompare = b.expenseDate.localeCompare(a.expenseDate);
      if (dateCompare !== 0) return dateCompare;
      return b.createdAt.localeCompare(a.createdAt);
    });

    return NextResponse.json({ success: true, expenditures: formatted });
  } catch (err) {
    console.error("GET expenditures error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 2. 지출 내역 등록 (비목 상한선 자동 검증 포함)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== "school") {
      return NextResponse.json(
        { error: "학교 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const { allocationId, expenseCategory, amount, expenseDate, description } = await request.json();

    if (!allocationId || !expenseCategory || !amount || !expenseDate) {
      return NextResponse.json(
        { error: "필수 입력 항목이 누락되었습니다." },
        { status: 400 }
      );
    }

    const parsedAmount = parseInt(String(amount), 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "금액은 0보다 커야 합니다." },
        { status: 400 }
      );
    }

    // 1. 해당 배정 예산 정보 조회
    const allocRef = doc(db, "allocations", allocationId);
    const allocSnap = await getDoc(allocRef);

    if (!allocSnap.exists()) {
      return NextResponse.json(
        { error: "해당 예산 배정 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const allocation = allocSnap.data();

    // 보안 검사: 현재 학교의 배정 예산인지 확인
    if (allocation.school_name !== session.schoolId) {
      return NextResponse.json(
        { error: "권한이 없습니다." },
        { status: 403 }
      );
    }

    // 2. 해당 배정 예산의 기존 지출 내역들 가져오기 (한도 유효성 검사용)
    const expQuery = query(collection(db, "expenditures"), where("allocation_id", "==", allocationId));
    const expSnap = await getDocs(expQuery);
    
    const existingExpenditures: any[] = [];
    expSnap.forEach((expDoc) => {
      const data = expDoc.data();
      existingExpenditures.push({
        id: expDoc.id,
        amount: Number(data.amount) || 0,
        expense_category: data.expense_category,
      });
    });

    // 3. 비즈니스 룰 상한선 유효성 검증
    const validation = validateExpenditure({
      allocatedAmount: Number(allocation.allocated_amount) || 0,
      projectCode: allocation.project_code,
      projectType: allocation.project_type,
      expenseCategory,
      newAmount: parsedAmount,
      existingExpenditures,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // 4. 검증 통과 시 지출 기록 인서트
    const newDoc = {
      allocation_id: allocationId,
      school_name: session.schoolId, // 쿼리 편의를 위한 학교명 중복 보관
      expense_category: expenseCategory,
      amount: parsedAmount,
      expense_date: expenseDate,
      description: description || "",
      created_at: new Date(),
    };

    const docRef = await addDoc(collection(db, "expenditures"), newDoc);

    return NextResponse.json({
      success: true,
      expenditure: {
        id: docRef.id,
        ...newDoc,
        created_at: newDoc.created_at.toISOString(),
      },
    });
  } catch (err) {
    console.error("POST expenditures error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 3. 지출 내역 삭제
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== "school") {
      return NextResponse.json(
        { error: "학교 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "지출 내역 식별자(ID)가 필요합니다." },
        { status: 400 }
      );
    }

    // 1) 지출 내역 조회 및 권한 검증
    const expRef = doc(db, "expenditures", id);
    const expSnap = await getDoc(expRef);

    if (!expSnap.exists()) {
      return NextResponse.json(
        { error: "지출 내역을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const expenditure = expSnap.data();

    if (expenditure.school_name !== session.schoolId) {
      return NextResponse.json(
        { error: "권한이 없습니다." },
        { status: 403 }
      );
    }

    // 2) 삭제 실행
    await deleteDoc(expRef);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE expenditure error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, query, where } from "firebase/firestore";
import { getSession } from "@/lib/auth";
import { validateExpenditure } from "@/lib/validation";

// 1. 지출 내역 전체 조회 (학교별 또는 특정 배정예산별)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || (session.role !== "school" && session.role !== "admin")) {
      return NextResponse.json(
        { error: "권한이 필요합니다." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const allocationId = searchParams.get("allocationId");

    // 관리자가 특정 배정 예산(allocationId)의 지출 세부 내역을 조회하는 경우
    if (session.role === "admin" && allocationId) {
      const expQuery = query(collection(db, "expenditures"), where("allocation_id", "==", allocationId));
      const expSnap = await getDocs(expQuery);

      const formatted: any[] = [];
      expSnap.forEach((expDoc) => {
        const e = expDoc.data();
        formatted.push({
          id: expDoc.id,
          allocationId: e.allocation_id,
          expenseCategory: e.expense_category,
          amount: Number(e.amount) || 0,
          expenseDate: e.expense_date,
          description: e.description || "",
          createdAt: e.created_at?.toDate ? e.created_at.toDate().toISOString() : new Date().toISOString(),
        });
      });

      // 지출일 기준 내림차순 정렬
      formatted.sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
      return NextResponse.json({ success: true, expenditures: formatted });
    }

    // 일반 학교 사용자 조회
    const schoolId = session.role === "school" ? session.schoolId : searchParams.get("schoolId");
    if (!schoolId) {
      return NextResponse.json({ error: "학교 식별자가 필요합니다." }, { status: 400 });
    }

    // 1) 학교의 allocations 전체 가져오기
    const allocQuery = query(collection(db, "allocations"), where("school_name", "==", String(schoolId)));
    const allocSnap = await getDocs(allocQuery);

    if (allocSnap.empty) {
      return NextResponse.json({ success: true, expenditures: [] });
    }

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

// 2. 지출 내역 등록
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || (session.role !== "school" && session.role !== "admin")) {
      return NextResponse.json(
        { error: "권한이 필요합니다." },
        { status: 403 }
      );
    }

    const { allocationId, expenseCategory, amount, expenseDate, description } = await request.json();

    if (!allocationId || amount === undefined) {
      return NextResponse.json(
        { error: "필수 입력 항목(세부사업, 금액)이 누락되었습니다." },
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

    // 보안 검사: 학교 계정인 경우 자신의 학교 배정 예산인지 확인
    if (session.role === "school" && allocation.school_name !== session.schoolId) {
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

    // 선택 입력 처리 (미선택 시 기본값 주입)
    const category = expenseCategory || "기타";
    const date = expenseDate || new Date().toISOString().split("T")[0];
    const desc = description || "";

    // 3. 비즈니스 룰 상한선 유효성 검증
    const validation = validateExpenditure({
      allocatedAmount: Number(allocation.allocated_amount) || 0,
      projectCode: allocation.project_code,
      projectType: allocation.project_type,
      expenseCategory: category,
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
    const targetSchoolName = session.role === "school" ? session.schoolId : allocation.school_name;
    const newDoc = {
      allocation_id: allocationId,
      school_name: targetSchoolName,
      expense_category: category,
      amount: parsedAmount,
      expense_date: date,
      description: desc,
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

// 3. 지출 내역 수정 (PUT)
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || (session.role !== "school" && session.role !== "admin")) {
      return NextResponse.json(
        { error: "권한이 필요합니다." },
        { status: 403 }
      );
    }

    const { id, expenseCategory, amount, expenseDate, description } = await request.json();

    if (!id || amount === undefined) {
      return NextResponse.json(
        { error: "필수 입력 항목(ID, 금액)이 누락되었습니다." },
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

    // 1) 지출 내역 조회
    const expRef = doc(db, "expenditures", id);
    const expSnap = await getDoc(expRef);

    if (!expSnap.exists()) {
      return NextResponse.json(
        { error: "지출 내역을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const expenditure = expSnap.data();

    // 보안 검사: 학교 계정인 경우 자신의 학교 지출인지 확인
    if (session.role === "school" && expenditure.school_name !== session.schoolId) {
      return NextResponse.json(
        { error: "권한이 없습니다." },
        { status: 403 }
      );
    }

    const allocationId = expenditure.allocation_id;

    // 2) 배정 예산 정보 조회
    const allocRef = doc(db, "allocations", allocationId);
    const allocSnap = await getDoc(allocRef);

    if (!allocSnap.exists()) {
      return NextResponse.json(
        { error: "배정 예산 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const allocation = allocSnap.data();

    // 3) 다른 지출 내역들 가져오기 (현재 수정 건 제외)
    const expQuery = query(collection(db, "expenditures"), where("allocation_id", "==", allocationId));
    const allExpsSnap = await getDocs(expQuery);
    
    const existingExpenditures: any[] = [];
    allExpsSnap.forEach((expDoc) => {
      if (expDoc.id !== id) {
        const data = expDoc.data();
        existingExpenditures.push({
          id: expDoc.id,
          amount: Number(data.amount) || 0,
          expense_category: data.expense_category,
        });
      }
    });

    const category = expenseCategory || "기타";
    const date = expenseDate || new Date().toISOString().split("T")[0];
    const desc = description || "";

    // 4) 비목 상한선 유효성 검증
    const validation = validateExpenditure({
      allocatedAmount: Number(allocation.allocated_amount) || 0,
      projectCode: allocation.project_code,
      projectType: allocation.project_type,
      expenseCategory: category,
      newAmount: parsedAmount,
      existingExpenditures,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // 5) 업데이트 실행
    await updateDoc(expRef, {
      expense_category: category,
      amount: parsedAmount,
      expense_date: date,
      description: desc,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT expenditures error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 4. 지출 내역 삭제
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || (session.role !== "school" && session.role !== "admin")) {
      return NextResponse.json(
        { error: "권한이 필요합니다." },
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

    // 관리자가 아니면 본인 학교 지출만 삭제 가능
    if (session.role !== "admin" && expenditure.school_name !== session.schoolId) {
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

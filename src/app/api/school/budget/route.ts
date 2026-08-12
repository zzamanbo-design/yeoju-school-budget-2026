import { NextRequest, NextResponse } from "next/server";
import { adminDb as db } from "@/lib/firebase-admin";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== "school") {
      return NextResponse.json(
        { error: "학교 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const schoolId = session.schoolId; // schoolId represents the school name string

    if (!schoolId) {
      return NextResponse.json(
        { error: "학교 식별자를 찾을 수 없습니다." },
        { status: 400 }
      );
    }

    // 1) allocations 조회
    const allocSnap = await db.collection("allocations").where("school_name", "==", String(schoolId)).get();

    // 2) expenditures 조회
    const expSnap = await db.collection("expenditures").where("school_name", "==", String(schoolId)).get();

    const expMap = new Map<string, any[]>();
    expSnap.forEach((expDoc: any) => {
      const exp = expDoc.data();
      const allocId = exp.allocation_id;
      if (allocId) {
        const list = expMap.get(allocId) || [];
        list.push({
          id: expDoc.id,
          allocation_id: exp.allocation_id,
          expense_category: exp.expense_category,
          amount: Number(exp.amount) || 0,
          expense_date: exp.expense_date,
          description: exp.description || "",
          created_at: exp.created_at?.toDate ? exp.created_at.toDate().toISOString() : new Date().toISOString(),
        });
        expMap.set(allocId, list);
      }
    });

    const allocationsList: any[] = [];
    allocSnap.forEach((allocDoc: any) => {
      const alloc = allocDoc.data();
      const expenditures = expMap.get(allocDoc.id) || [];
      allocationsList.push({
        id: allocDoc.id,
        school_id: alloc.school_name,
        project_code: alloc.project_code,
        project_name: alloc.project_name,
        funding_source: alloc.funding_source,
        project_type: alloc.project_type,
        allocated_amount: Number(alloc.allocated_amount) || 0,
        created_at: alloc.created_at?.toDate ? alloc.created_at.toDate().toISOString() : new Date().toISOString(),
        expenditures,
      });
    });

    // 정렬 (사업코드 기준 오름차순)
    allocationsList.sort((a, b) => a.project_code.localeCompare(b.project_code));

    return NextResponse.json({
      success: true,
      schoolName: schoolId,
      allocations: allocationsList
    });
  } catch (err) {
    console.error("GET school budget error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

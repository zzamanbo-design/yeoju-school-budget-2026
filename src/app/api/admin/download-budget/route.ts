import { NextRequest, NextResponse } from "next/server";
import { adminDb as db } from "@/lib/firebase-admin";
import { getSession } from "@/lib/auth";
import * as xlsx from "xlsx";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || (session.role !== "admin" && session.role !== "viewer")) {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    // 1. Fetch allocations
    const allocationsSnap = await db.collection("allocations").get();
    
    // 2. Fetch all expenditures
    const expendituresSnap = await db.collection("expenditures").get();
    const expendituresMap = new Map<string, number>();

    // Map expenditures by allocation_id
    expendituresSnap.forEach((doc: any) => {
      const data = doc.data();
      const allocId = data.allocation_id;
      const amount = data.amount || 0;
      if (allocId) {
        expendituresMap.set(allocId, (expendituresMap.get(allocId) || 0) + amount);
      }
    });

    const rows: any[] = [];

    allocationsSnap.forEach((doc: any) => {
      const data = doc.data();
      const allocId = doc.id;
      const allocatedAmount = data.allocated_amount || 0;
      const totalSpent = expendituresMap.get(allocId) || 0;
      const burnRate = allocatedAmount > 0 ? (totalSpent / allocatedAmount) * 100 : 0;

      rows.push({
        "학교명": data.school_name || "",
        "학교급": data.school_level || "",
        "설립구분": data.establishment_type || "",
        "사업유형": data.project_type || "",
        "재원구분": data.funding_source || "",
        "세부사업코드_명칭": data.project_code ? `${data.project_code}. ${data.project_name}` : data.project_name || "",
        "교부금액": allocatedAmount,
        "총 지출": totalSpent,
        "집행률": parseFloat(burnRate.toFixed(2)) + "%"
      });
    });

    // 정렬: 학교명 기준
    rows.sort((a, b) => a["학교명"].localeCompare(b["학교명"]));

    // Create Excel worksheet
    const worksheet = xlsx.utils.json_to_sheet(rows);
    
    // Define column widths for better readability
    worksheet["!cols"] = [
      { wch: 20 }, // 학교명
      { wch: 10 }, // 학교급
      { wch: 10 }, // 설립구분
      { wch: 10 }, // 사업유형
      { wch: 15 }, // 재원구분
      { wch: 30 }, // 세부사업코드_명칭
      { wch: 15 }, // 교부금액
      { wch: 15 }, // 총 지출
      { wch: 10 }, // 집행률
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "예산_집행_현황");

    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="budget_allocations.xlsx"',
      },
    });

  } catch (err) {
    console.error("Download budget error:", err);
    return NextResponse.json(
      { error: "파일 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

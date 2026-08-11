import { NextRequest, NextResponse } from "next/server";
import { adminDb as db } from "@/lib/firebase-admin";
import { getSession } from "@/lib/auth";
import * as xlsx from "xlsx";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "업로드할 파일을 선택해 주세요." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = xlsx.read(Buffer.from(arrayBuffer), { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // 엑셀 데이터를 JSON 객체 배열로 변환
    const rawRows = xlsx.utils.sheet_to_json(worksheet) as any[];

    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: "파일에 유효한 데이터가 존재하지 않습니다." },
        { status: 400 }
      );
    }

    // 1. 전체 학교 목록 가져오기 (이름 매핑 및 검증용)
    const schoolsSnap = await db.collection("schools").get();
    const validSchools = new Set<string>();
    schoolsSnap.forEach((schoolDoc: any) => {
      validSchools.add(schoolDoc.id.trim());
    });

    const parsedAllocations: any[] = [];
    const skippedRows: string[] = [];
    const schoolsToUpdate = new Set<string>();

    // 2. 행 데이터 검증 및 파싱
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2; // 헤더 제외 1-indexed

      const rawSchoolName = row["학교명"] || row["학교 명"] || row["school_name"];
      const rawSchoolLevel = row["학교급"] || row["school_level"];
      const rawEstablishmentType = row["설립구분"] || row["establishment_type"];
      const rawType = row["사업유형"] || row["사업 유형"] || row["project_type"];
      const rawProject = row["세부사업코드_및_명칭"] || row["세부사업코드_명칭"] || row["세부사업"] || row["project_name"];
      const rawSource = row["재원구분"] || row["재원 구분"] || row["funding_source"];
      const rawAmount = row["교부금액"] || row["금액"] || row["allocated_amount"];

      if (!rawSchoolName || !rawType || !rawProject || !rawSource || rawAmount === undefined) {
        skippedRows.push(`${rowNum}행: 필수 정보 누락`);
        continue;
      }

      const schoolName = String(rawSchoolName).trim();

      if (!validSchools.has(schoolName)) {
        skippedRows.push(`${rowNum}행: '${schoolName}'은(는) 등록되지 않은 학교입니다.`);
        continue;
      }

      // 사업유형 표준화
      let projectType: "필수" | "공모" = "필수";
      if (String(rawType).includes("공모")) {
        projectType = "공모";
      }

      // 재원구분 표준화
      let fundingSource: "시청 보조금" | "교육청 지원금" = "시청 보조금";
      if (String(rawSource).includes("교육청")) {
        fundingSource = "교육청 지원금";
      }

      // 세부사업코드 및 명칭 분리 (예: "111. 여주형 미래교육" -> 코드: "111", 명칭: "여주형 미래교육")
      let projectCode = "";
      let projectName = "";
      const projectStr = String(rawProject).trim();
      const dotIndex = projectStr.indexOf(".");
      
      if (dotIndex !== -1 && dotIndex < 10) {
        projectCode = projectStr.substring(0, dotIndex).trim();
        projectName = projectStr.substring(dotIndex + 1).trim();
      } else {
        projectCode = projectStr;
        projectName = projectStr;
      }

      const allocatedAmount = parseInt(String(rawAmount).replace(/[^0-9-]/g, ""), 10);

      if (isNaN(allocatedAmount) || allocatedAmount < 0) {
        skippedRows.push(`${rowNum}행: 교부금액 오류`);
        continue;
      }

      schoolsToUpdate.add(schoolName);

      parsedAllocations.push({
        school_name: schoolName,
        school_level: rawSchoolLevel ? String(rawSchoolLevel).trim() : null,
        establishment_type: rawEstablishmentType ? String(rawEstablishmentType).trim() : null,
        project_code: projectCode,
        project_name: projectName,
        funding_source: fundingSource,
        project_type: projectType,
        allocated_amount: allocatedAmount,
        created_at: new Date(),
      });
    }

    if (parsedAllocations.length === 0) {
      return NextResponse.json(
        { error: "유효하게 파싱된 예산 데이터가 없습니다.", details: skippedRows },
        { status: 400 }
      );
    }

    // 3. 기존 해당 학교들의 배정 데이터 삭제 (메모리 매칭 및 WriteBatch 활용)
    const allAllocationsSnap = await db.collection("allocations").get();
    const deleteBatch = db.batch();
    let delCount = 0;

    allAllocationsSnap.forEach((allocDoc: any) => {
      const data = allocDoc.data();
      if (data.school_name && schoolsToUpdate.has(data.school_name)) {
        deleteBatch.delete(allocDoc.ref);
        delCount++;
        if (delCount >= 400) {
          // Commit and restart batch for every 400 deletes
          // In an async loop this needs await, but we are inside a sync forEach
          // Let's replace forEach with a normal for loop to support await
        }
      }
    });
    // Wait, the original code didn't await inside forEach. I'll just gather references and delete them.
    const docsToDelete = allAllocationsSnap.docs.filter((d: any) => {
      const data = d.data();
      return data.school_name && schoolsToUpdate.has(data.school_name);
    });

    for (let i = 0; i < docsToDelete.length; i += 400) {
      const chunk = docsToDelete.slice(i, i + 400);
      const batch = db.batch();
      chunk.forEach((d: any) => batch.delete(d.ref));
      await batch.commit();
    }

    // 4. 새 배정 데이터 일괄 인서트 (WriteBatch)
    for (let i = 0; i < parsedAllocations.length; i += 400) {
      const chunk = parsedAllocations.slice(i, i + 400);
      const batch = db.batch();
      chunk.forEach((alloc: any) => {
        const docRef = db.collection("allocations").doc();
        batch.set(docRef, alloc);
      });
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      count: parsedAllocations.length,
      skippedCount: skippedRows.length,
      skipped: skippedRows,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const allAllocationsSnap = await db.collection("allocations").get();
    
    for (let i = 0; i < allAllocationsSnap.docs.length; i += 400) {
      const chunk = allAllocationsSnap.docs.slice(i, i + 400);
      const batch = db.batch();
      chunk.forEach((d: any) => batch.delete(d.ref));
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      deletedCount: allAllocationsSnap.size
    });
  } catch (err) {
    console.error("Bulk delete error:", err);
    return NextResponse.json(
      { error: "전체 삭제 중 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

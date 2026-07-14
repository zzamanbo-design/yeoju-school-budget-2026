import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, query } from "firebase/firestore";
import { getSession } from "@/lib/auth";

// 1. 모든 티켓 조회 (학교명 포함)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const ticketsQuery = query(collection(db, "support_tickets"));
    const ticketsSnap = await getDocs(ticketsQuery);
    
    const ticketsList: any[] = [];
    ticketsSnap.forEach((ticketDoc) => {
      const t = ticketDoc.data();
      ticketsList.push({
        id: ticketDoc.id,
        schoolId: t.school_name,
        schoolName: t.school_name || "알 수 없음",
        title: t.title,
        content: t.content,
        status: t.status,
        answer: t.answer,
        createdAt: t.created_at?.toDate ? t.created_at.toDate().toISOString() : new Date().toISOString(),
        answeredAt: t.answered_at?.toDate ? t.answered_at.toDate().toISOString() : null,
      });
    });

    // 작성일 기준 내림차순 정렬
    ticketsList.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({ success: true, tickets: ticketsList });
  } catch (err) {
    console.error("GET tickets error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 2. 티켓에 답변 작성 및 완료 처리
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const { id, answer } = await request.json();

    if (!id || !answer) {
      return NextResponse.json(
        { error: "티켓 ID와 답변 내용을 입력해 주세요." },
        { status: 400 }
      );
    }

    const ticketRef = doc(db, "support_tickets", id);
    await updateDoc(ticketRef, {
      answer,
      status: "RESOLVED",
      answered_at: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT tickets error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

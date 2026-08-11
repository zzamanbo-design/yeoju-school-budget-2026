import { NextRequest, NextResponse } from "next/server";
import { adminDb as db } from "@/lib/firebase-admin";
import { getSession } from "@/lib/auth";

// 1. 모든 티켓 조회 (학교명 포함)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || (session.role !== "admin" && session.role !== "viewer")) {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const ticketsSnap = await db.collection("support_tickets").get();
    
    const ticketsList: any[] = [];
    ticketsSnap.forEach((ticketDoc: any) => {
      const t = ticketDoc.data();
      ticketsList.push({
        id: ticketDoc.id,
        schoolId: t.school_name,
        schoolName: t.school_name || "알 수 없음",
        requesterName: t.requester_name || "",
        contactInfo: t.contact_info || "",
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

    const ticketRef = db.collection("support_tickets").doc(id);
    await ticketRef.update({
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

// 3. 티켓 답변 삭제 처리 (OPEN 상태로 되돌리기)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== "admin") {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "티켓 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const ticketRef = db.collection("support_tickets").doc(id);
    await ticketRef.update({
      answer: null,
      status: "OPEN",
      answered_at: null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE tickets error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

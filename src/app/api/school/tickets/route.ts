import { NextRequest, NextResponse } from "next/server";
import { adminDb as db } from "@/lib/firebase-admin";
import { getSession } from "@/lib/auth";

// 1. 현재 학교의 모든 티켓 조회
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
    
    const ticketsSnap = await db.collection("support_tickets").where("school_name", "==", String(schoolId)).get();
    
    const ticketsList: any[] = [];
    ticketsSnap.forEach((docSnap: any) => {
      const t = docSnap.data();
      ticketsList.push({
        id: docSnap.id,
        school_id: t.school_name,
        requester_name: t.requester_name,
        contact_info: t.contact_info,
        title: t.title,
        content: t.content,
        status: t.status,
        answer: t.answer || null,
        created_at: t.created_at?.toDate ? t.created_at.toDate().toISOString() : new Date().toISOString(),
        answered_at: t.answered_at?.toDate ? t.answered_at.toDate().toISOString() : null,
      });
    });

    // 정렬 (작성일 기준 내림차순)
    ticketsList.sort((a, b) => b.created_at.localeCompare(a.created_at));

    return NextResponse.json({ success: true, tickets: ticketsList });
  } catch (err) {
    console.error("GET school tickets error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 2. 새 티켓 작성 (지원 요청 접수)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== "school") {
      return NextResponse.json(
        { error: "학교 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const { title, content, requester_name, contact_info } = await request.json();

    if (!title || !content || !requester_name || !contact_info) {
      return NextResponse.json(
        { error: "작성자 이름, 연락처, 제목, 문의 내용을 모두 입력해 주세요." },
        { status: 400 }
      );
    }

    const schoolId = session.schoolId!;

    const newTicket = {
      school_name: String(schoolId),
      requester_name,
      contact_info,
      title,
      content,
      status: "OPEN",
      answer: null,
      created_at: new Date(),
      answered_at: null,
    };

    const docRef = await db.collection("support_tickets").add(newTicket);

    return NextResponse.json({
      success: true,
      ticket: {
        id: docRef.id,
        ...newTicket,
        created_at: newTicket.created_at.toISOString(),
      },
    });
  } catch (err) {
    console.error("POST school tickets error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, query, where } from "firebase/firestore";
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
    
    const q = query(collection(db, "support_tickets"), where("school_name", "==", String(schoolId)));
    const ticketsSnap = await getDocs(q);
    
    const ticketsList: any[] = [];
    ticketsSnap.forEach((docSnap) => {
      const t = docSnap.data();
      ticketsList.push({
        id: docSnap.id,
        school_id: t.school_name,
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

    const { title, content } = await request.json();

    if (!title || !content) {
      return NextResponse.json(
        { error: "제목과 문의 내용을 모두 입력해 주세요." },
        { status: 400 }
      );
    }

    const schoolId = session.schoolId!;

    const newTicket = {
      school_name: String(schoolId),
      title,
      content,
      status: "OPEN",
      answer: null,
      created_at: new Date(),
      answered_at: null,
    };

    const docRef = await addDoc(collection(db, "support_tickets"), newTicket);

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

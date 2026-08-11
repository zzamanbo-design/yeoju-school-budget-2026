import { NextResponse } from "next/server";
import { adminDb as db } from "@/lib/firebase-admin";
import { verifyPassword } from "@/lib/hash";
import { createSessionToken } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const loginId = url.searchParams.get("loginId") || "admin";
    
    let accountExists = false;
    let pwdCheck = false;
    let authError = null;
    let tokenCreated = false;

    try {
      const accountRef = db.collection("school_accounts").doc(loginId);
      const accountSnap = await accountRef.get();
      accountExists = accountSnap.exists;

      if (accountExists) {
        const accountData = accountSnap.data()!;
        pwdCheck = verifyPassword("test", accountData.password_hash);

        await createSessionToken({
          accountId: accountSnap.id,
          schoolId: "test",
          schoolName: "test",
          role: "admin",
          passwordChanged: true,
        });
        tokenCreated = true;
      }
    } catch (e: any) {
      authError = e.message;
    }

    return NextResponse.json({
      loginId,
      accountExists,
      pwdCheck,
      tokenCreated,
      authError,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

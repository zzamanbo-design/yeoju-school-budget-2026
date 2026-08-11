import { NextResponse } from "next/server";
import { adminDb as db } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const keyStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "";
    let testParse = "Not attempted";
    let parseError = null;

    try {
      let cleaned = keyStr.trim();
      if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
        cleaned = cleaned.slice(1, -1);
      }
      JSON.parse(cleaned);
      testParse = "Success";
    } catch (e: any) {
      testParse = "Failed";
      parseError = e.message;
    }

    let dbError = null;
    try {
      // test db connection
      await db.collection("schools").limit(1).get();
    } catch (e: any) {
      dbError = e.message;
    }

    return NextResponse.json({
      keyLength: keyStr.length,
      startsWith: keyStr.substring(0, 10),
      endsWith: keyStr.substring(keyStr.length - 10),
      testParse,
      parseError,
      dbError,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

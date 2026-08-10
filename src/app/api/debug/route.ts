import { NextResponse } from "next/server";

export async function GET() {
  try {
    let keyRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "";
    let hasKey = !!keyRaw;
    let keyLength = keyRaw.length;
    let keyStarts = keyRaw.substring(0, 10);
    let keyEnds = keyRaw.substring(Math.max(0, keyLength - 10));
    
    let parseError = null;
    let parsedProject = null;
    let parsedKeyHasNewlines = false;

    if (hasKey) {
      try {
        let keyStr = keyRaw.trim();
        if (keyStr.startsWith("'") && keyStr.endsWith("'")) {
          keyStr = keyStr.slice(1, -1);
        }
        const parsed = JSON.parse(keyStr);
        parsedProject = parsed.project_id;
        parsedKeyHasNewlines = parsed.private_key && parsed.private_key.includes("\n");
      } catch (e: any) {
        parseError = e.message;
      }
    }

    return NextResponse.json({
      envVarExists: hasKey,
      length: keyLength,
      starts: keyStarts,
      ends: keyEnds,
      parseError,
      parsedProject,
      parsedKeyHasNewlines,
      nodeVersion: process.version,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

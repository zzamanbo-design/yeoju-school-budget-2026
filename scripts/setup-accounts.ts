import { adminDb as db } from "../src/lib/firebase-admin";
import crypto from "crypto";

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function run() {
  console.log("➡️ 여주교육지원청 테스트 계정 생성 중...");

  await db.collection("schools").doc("여주교육지원청").set({
    school_name: "여주교육지원청",
    school_level: "기타",
  });

  await db.collection("school_accounts").doc("여주교육지원청").set({
    login_id: "여주교육지원청",
    password_hash: hashPassword("yeoju2026!"),
    role: "school",
    school_name: "여주교육지원청",
    password_changed: false,
    created_at: new Date(),
    last_login_at: null,
  });

  console.log("➡️ 여주시청 테스트 계정(cityhall) 생성 중...");
  await db.collection("school_accounts").doc("cityhall").set({
    login_id: "cityhall",
    password_hash: hashPassword("yeoju2026!"),
    role: "viewer",
    school_name: "여주시청",
    password_changed: false,
    created_at: new Date(),
    last_login_at: null,
  });

  console.log("✅ 계정 생성 완료.");
  process.exit(0);
}

run().catch(console.error);

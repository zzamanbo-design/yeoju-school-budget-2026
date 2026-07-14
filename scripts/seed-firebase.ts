import * as fs from "fs";
import * as path from "path";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  writeBatch, 
  doc, 
  collection, 
  getDocs, 
  query 
} from "firebase/firestore";
import * as crypto from "crypto";

// 1. .env.local 파일 환경변수 로딩
try {
  const envPath = path.join(__dirname, "../.env.local");
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf8");
    envConfig.split("\n").forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || "";
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val.trim();
      }
    });
    console.log("✅ .env.local 환경 변수가 로드되었습니다.");
  }
} catch (e) {
  console.error("⚠️ 환경 변수 로드 중 오류 발생:", e);
}

// 2. Firebase 설정
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

if (!firebaseConfig.projectId) {
  console.error("❌ Firebase Project ID가 누락되었습니다. .env.local 파일을 확인해 주세요.");
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 3. 비밀번호 해싱 헬퍼 (SHA-256)
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// 4. 여주 관내 45개 학교 목록 데이터
const schools = [
  // 초등학교
  { school_name: "가남초등학교", school_level: "초" },
  { school_name: "강천초등학교", school_level: "초" },
  { school_name: "금당초등학교", school_level: "초" },
  { school_name: "능북초등학교", school_level: "초" },
  { school_name: "능서초등학교", school_level: "초" },
  { school_name: "대신초등학교", school_level: "초" },
  { school_name: "매류초등학교", school_level: "초" },
  { school_name: "문장초등학교", school_level: "초" },
  { school_name: "북내초등학교", school_level: "초" },
  { school_name: "상품초등학교", school_level: "초" },
  { school_name: "세종초등학교", school_level: "초" },
  { school_name: "송삼초등학교", school_level: "초" },
  { school_name: "송촌초등학교", school_level: "초" },
  { school_name: "여주초등학교", school_level: "초" },
  { school_name: "여흥초등학교", school_level: "초" },
  { school_name: "연라초등학교", school_level: "초" },
  { school_name: "오산초등학교", school_level: "초" },
  { school_name: "오학초등학교", school_level: "초" },
  { school_name: "이포초등학교", school_level: "초" },
  { school_name: "점동초등학교", school_level: "초" },
  { school_name: "점봉초등학교", school_level: "초" },
  { school_name: "천남초등학교", school_level: "초" },
  { school_name: "흥천초등학교", school_level: "초" },
  // 중학교
  { school_name: "강천중학교", school_level: "중" },
  { school_name: "대신중학교", school_level: "중" },
  { school_name: "상품중학교", school_level: "중" },
  { school_name: "세정중학교", school_level: "중" },
  { school_name: "세종중학교", school_level: "중" },
  { school_name: "여강중학교", school_level: "중" },
  { school_name: "여흥중학교", school_level: "중" },
  { school_name: "여주제일중학교", school_level: "중" },
  { school_name: "여주중학교", school_level: "중" },
  { school_name: "이포중학교", school_level: "중" },
  { school_name: "점동중학교", school_level: "중" },
  { school_name: "창명여자중학교", school_level: "중" },
  { school_name: "흥천중학교", school_level: "중" },
  // 고등학교
  { school_name: "경기관광고등학교", school_level: "고" },
  { school_name: "대신고등학교", school_level: "고" },
  { school_name: "세종고등학교", school_level: "고" },
  { school_name: "여강고등학교", school_level: "고" },
  { school_name: "여주고등학교", school_level: "고" },
  { school_name: "여주자영농업고등학교", school_level: "고" },
  { school_name: "여주제일고등학교", school_level: "고" },
  { school_name: "이포고등학교", school_level: "고" },
  { school_name: "점동고등학교", school_level: "고" },
];

async function seed() {
  console.log("🌱 Firestore 예산 관리 데이터베이스 초기 주입(Seed) 시작...");

  try {
    // --------------------------------------------------
    // A. schools & school_accounts 컬렉션 생성 (Batch 활용)
    // --------------------------------------------------
    let batch = writeBatch(db);
    let operationCount = 0;

    console.log("➡️ schools & school_accounts 데이터 주입 중...");

    // 1) 45개 학교 및 로그인 계정 설정
    for (const s of schools) {
      const schoolRef = doc(db, "schools", s.school_name);
      batch.set(schoolRef, {
        school_name: s.school_name,
        school_level: s.school_level,
      });
      operationCount++;

      const accountRef = doc(db, "school_accounts", s.school_name);
      batch.set(accountRef, {
        login_id: s.school_name,
        password_hash: hashPassword("yeoju2026!"), // 초기 비밀번호: yeoju2026!
        role: "school",
        school_name: s.school_name,
        password_changed: false,
        created_at: new Date(),
        last_login_at: null,
      });
      operationCount++;

      // Firestore Batch 크기 제한(500개) 방지를 위해 200개마다 커밋
      if (operationCount >= 200) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
    }

    // 2) 관리자 계정 설정 (ID: admin / PW: admin2026!)
    const adminRef = doc(db, "school_accounts", "admin");
    batch.set(adminRef, {
      login_id: "admin",
      password_hash: hashPassword("admin2026!"), // 관리자 비밀번호: admin2026!
      role: "admin",
      school_name: null,
      password_changed: true, // 관리자는 즉시 진입 가능
      created_at: new Date(),
      last_login_at: null,
    });
    operationCount++;

    if (operationCount > 0) {
      await batch.commit();
    }
    console.log("✅ schools 및 school_accounts 세팅이 완료되었습니다.");

    // --------------------------------------------------
    // B. allocations 컬렉션 초기 테스트 시드 주입 (가남초/여주초)
    // --------------------------------------------------
    console.log("➡️ allocations 초기 테스트 시드 예산 주입 중...");
    batch = writeBatch(db);

    const testAllocations = [
      // 가남초등학교
      {
        school_name: "가남초등학교",
        project_code: "111",
        project_name: "여주형 미래교육",
        funding_source: "시청 보조금",
        project_type: "필수",
        allocated_amount: 12200000,
        created_at: new Date()
      },
      {
        school_name: "가남초등학교",
        project_code: "121",
        project_name: "지역협력 방과후학교",
        funding_source: "시청 보조금",
        project_type: "필수",
        allocated_amount: 40528000,
        created_at: new Date()
      },
      {
        school_name: "가남초등학교",
        project_code: "112",
        project_name: "같이학교 교육과정",
        funding_source: "교육청 지원금",
        project_type: "공모",
        allocated_amount: 5000000,
        created_at: new Date()
      },
      // 여주초등학교
      {
        school_name: "여주초등학교",
        project_code: "111",
        project_name: "여주형 미래교육",
        funding_source: "시청 보조금",
        project_type: "필수",
        allocated_amount: 14200000,
        created_at: new Date()
      },
      {
        school_name: "여주초등학교",
        project_code: "121",
        project_name: "지역협력 방과후학교",
        funding_source: "시청 보조금",
        project_type: "필수",
        allocated_amount: 24306000,
        created_at: new Date()
      }
    ];

    testAllocations.forEach((alloc) => {
      // 문서 ID 자동 생성 (doc() 괄호 안에 collection 지정)
      const allocRef = doc(collection(db, "allocations"));
      batch.set(allocRef, alloc);
    });

    await batch.commit();
    console.log("✅ allocations 초기 테스트 예산 세팅이 완료되었습니다.");
    console.log("🎉 Firestore 시드 작업이 성공적으로 종료되었습니다!");
    process.exit(0);
  } catch (error) {
    console.error("❌ 시드 데이터 삽입 중 치명적인 오류 발생:", error);
    process.exit(1);
  }
}

seed();

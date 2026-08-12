import { adminDb as db } from "../src/lib/firebase-admin";

async function run() {
  const oldName = "여주교육지원청";
  const newName = "여주교육지원청(테스트)";

  console.log(`➡️ ${oldName}을(를) ${newName}으로 변경 중...`);

  const batch = db.batch();

  // 1. schools
  const oldSchoolRef = db.collection("schools").doc(oldName);
  const oldSchoolDoc = await oldSchoolRef.get();
  if (oldSchoolDoc.exists) {
    const data = oldSchoolDoc.data()!;
    data.school_name = newName;
    batch.set(db.collection("schools").doc(newName), data);
    batch.delete(oldSchoolRef);
  }

  // 2. school_accounts
  const oldAccountRef = db.collection("school_accounts").doc(oldName);
  const oldAccountDoc = await oldAccountRef.get();
  if (oldAccountDoc.exists) {
    const data = oldAccountDoc.data()!;
    data.login_id = newName;
    data.school_name = newName;
    batch.set(db.collection("school_accounts").doc(newName), data);
    batch.delete(oldAccountRef);
  }

  // 3. allocations
  const allocs = await db.collection("allocations").where("school_name", "==", oldName).get();
  allocs.forEach((docSnap) => {
    batch.update(docSnap.ref, { school_name: newName });
  });

  await batch.commit();

  console.log("✅ 이름 변경 완료.");
  process.exit(0);
}

run().catch(console.error);

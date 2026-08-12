import { NextResponse } from "next/server";
import { adminDb as db } from "@/lib/firebase-admin";

export async function GET() {
  try {
    console.log("Starting rename API...");
    const oldName = "여주교육지원청";
    const newName = "여주교육지원청(테스트)";

    const batch = db.batch();

    console.log("Fetching old school doc...");
    const oldSchoolRef = db.collection("schools").doc(oldName);
    const oldSchoolDoc = await oldSchoolRef.get();
    if (oldSchoolDoc.exists) {
      console.log("Found schools doc. Renaming...");
      const data = oldSchoolDoc.data()!;
      data.school_name = newName;
      batch.set(db.collection("schools").doc(newName), data);
      batch.delete(oldSchoolRef);
    } else {
      console.log("schools doc not found.");
    }

    console.log("Fetching old account doc...");
    const oldAccountRef = db.collection("school_accounts").doc(oldName);
    const oldAccountDoc = await oldAccountRef.get();
    if (oldAccountDoc.exists) {
      console.log("Found school_accounts doc. Renaming...");
      const data = oldAccountDoc.data()!;
      data.login_id = newName;
      data.school_name = newName;
      batch.set(db.collection("school_accounts").doc(newName), data);
      batch.delete(oldAccountRef);
    } else {
      console.log("school_accounts doc not found.");
    }

    console.log("Fetching allocations...");
    const allocs = await db.collection("allocations").where("school_name", "==", oldName).get();
    console.log("Found", allocs.size, "allocations.");
    allocs.forEach((docSnap) => {
      batch.update(docSnap.ref, { school_name: newName });
    });

    console.log("Committing batch...");
    await batch.commit();
    console.log("Batch committed successfully.");
    return NextResponse.json({ success: true, message: "Rename complete" });
  } catch (err: any) {
    console.error("Rename API Error:", err);
    return NextResponse.json({ success: false, error: err.message, stack: err.stack }, { status: 500 });
  }
}

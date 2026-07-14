import crypto from "crypto";

/**
 * 비밀번호를 SHA-256 알고리즘으로 단방향 해싱합니다.
 */
export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

/**
 * 입력된 평문 비밀번호가 저장된 해시값과 일치하는지 비교합니다.
 */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

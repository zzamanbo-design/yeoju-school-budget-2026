import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "school-budget-fallback-secret-2026-key"
);

export const COOKIE_NAME = "school-budget-session";

export interface SessionUser {
  accountId: string | number;
  schoolId: string | number | null;
  schoolName: string;
  schoolLevel?: string | null;
  role: "school" | "admin";
  passwordChanged: boolean;
}

/**
 * JWT 세션 토큰 생성
 */
export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .setIssuedAt()
    .sign(JWT_SECRET);
}

/**
 * JWT 세션 토큰 검증
 */
export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

/**
 * 현재 로그인 세션 가져오기 (서버 환경 전용)
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

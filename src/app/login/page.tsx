"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SCHOOLS_LIST = [
  "admin",
  // 초등학교 (23개)
  "가남초등학교", "강천초등학교", "금당초등학교", "능북초등학교", "능서초등학교",
  "대신초등학교", "매류초등학교", "문장초등학교", "북내초등학교", "상품초등학교",
  "세종초등학교", "송삼초등학교", "송촌초등학교", "여주초등학교", "여흥초등학교",
  "연라초등학교", "오산초등학교", "오학초등학교", "이포초등학교", "점동초등학교",
  "점봉초등학교", "천남초등학교", "흥천초등학교",
  // 중학교 (13개)
  "강천중학교", "대신중학교", "상품중학교", "세정중학교", "세종중학교",
  "여강중학교", "여흥중학교", "여주제일중학교", "여주중학교", "이포중학교",
  "점동중학교", "창명여자중학교", "흥천중학교",
  // 고등학교 (9개)
  "경기관광고등학교", "대신고등학교", "세종고등학교", "여강고등학교", "여주고등학교",
  "여주자영농업고등학교", "여주제일고등학교", "이포고등학교", "점동고등학교",
  "여주교육지원청"
];

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!loginId || !password) {
      setError("학교명과 비밀번호를 모두 입력해 주세요.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId: loginId.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "학교명 또는 비밀번호가 올바르지 않습니다.");
        setLoading(false);
        return;
      }

      // 로그인 성공 시
      if (data.needsPasswordChange) {
        // 최초 로그인 시 비밀번호 설정 페이지로 강제 이동
        router.push("/reset-password");
      } else {
        // 일반 로그인 시 권한에 맞춰 대시보드로 이동
        const dashboard = data.user.role === "admin" ? "/admin" : "/school";
        router.push(dashboard);
      }
      
      router.refresh();
    } catch {
      setError("서버 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card glass-card">
        <div className="login-header">
          <div className="login-logo-container">
            <img src="/logo-horizontal.jpg" alt="경기도여주교육지원청" className="login-logo-img" />
          </div>
          <h1 className="login-title">여주 경기공유학교</h1>
          <p className="login-subtitle">학교맞춤형 예산지원센터</p>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="loginId">학교명 선택 (또는 관리자 ID)</label>
            <select
              className="form-control"
              id="loginId"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              disabled={loading}
              required
            >
              <option value="" disabled>-- 학교명을 선택해 주세요 --</option>
              {SCHOOLS_LIST.map((school) => (
                <option key={school} value={school}>
                  {school}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label" htmlFor="password">비밀번호</label>
            <input
              className="form-control"
              type="password"
              id="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button
            className="btn btn-primary"
            type="submit"
            style={{ width: '100%', padding: '0.85rem' }}
            disabled={loading}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}

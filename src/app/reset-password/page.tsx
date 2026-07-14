"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!newPassword || !confirmPassword) {
      setError("새 비밀번호와 비밀번호 확인을 모두 입력해 주세요.");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("비밀번호가 서로 일치하지 않습니다.");
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError("비밀번호는 보안을 위해 최소 6자 이상이어야 합니다.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "비밀번호 변경 중 오류가 발생했습니다.");
        setLoading(false);
        return;
      }

      setSuccess("비밀번호가 성공적으로 변경되었습니다! 잠시 후 대시보드로 이동합니다.");
      
      setTimeout(() => {
        const dashboard = data.role === "admin" ? "/admin" : "/school";
        router.push(dashboard);
        router.refresh();
      }, 1500);
    } catch {
      setError("서버 통신 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card glass-card">
        <div className="login-header">
          <div className="login-logo-container">
            <img src="/logo-horizontal.jpg" alt="경기도여주교육지원청" className="login-logo-img" />
          </div>
          <h1 className="login-title">새 비밀번호 설정</h1>
          <p className="login-subtitle">최초 로그인 또는 초기화 이후 비밀번호 변경이 필수적입니다.</p>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="newPassword">새 비밀번호 (최소 6자)</label>
            <input
              className="form-control"
              type="password"
              id="newPassword"
              placeholder="새로운 비밀번호 입력"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label" htmlFor="confirmPassword">새 비밀번호 확인</label>
            <input
              className="form-control"
              type="password"
              id="confirmPassword"
              placeholder="동일한 비밀번호 재입력"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              className="btn btn-primary"
              type="submit"
              style={{ width: '100%', padding: '0.85rem' }}
              disabled={loading}
            >
              {loading ? "비밀번호 변경 중..." : "비밀번호 변경 및 진입"}
            </button>
            
            <button
              className="btn btn-secondary"
              type="button"
              onClick={handleLogout}
              style={{ width: '100%', padding: '0.85rem' }}
              disabled={loading}
            >
              로그아웃하고 로그인 창으로
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

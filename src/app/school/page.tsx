"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Allocation {
  id: number;
  school_id: number;
  project_code: string;
  project_name: string;
  funding_source: string;
  project_type: "필수" | "공모";
  allocated_amount: number;
  expenditures?: any[];
}

interface Expenditure {
  id: number;
  allocationId: number;
  projectCode: string;
  projectName: string;
  fundingSource: string;
  expenseCategory: string;
  amount: number;
  expenseDate: string;
  description: string | null;
}

interface Ticket {
  id: number;
  title: string;
  content: string;
  status: "OPEN" | "RESOLVED";
  answer: string | null;
  created_at: string;
  answered_at: string | null;
}

export default function SchoolDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"budget" | "history" | "tickets">("budget");
  const [schoolName, setSchoolName] = useState("");
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // 로딩 및 메시지
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "danger" | "info"; text: string } | null>(null);

  // 지출 폼 입력값
  const [selectedAllocId, setSelectedAllocId] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("운영비");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().substring(0, 10));
  const [description, setDescription] = useState("");

  // 자산취득성 교구 구입 경고 모달 상태
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [pendingExpenseSubmit, setPendingExpenseSubmit] = useState<(() => void) | null>(null);

  // 1:1 티켓 입력값
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketContent, setTicketContent] = useState("");

  // 데이터 로드
  const loadData = async () => {
    setLoading(true);
    try {
      // 내 예산 및 지출 데이터 가져오기
      const resBudget = await fetch("/api/school/budget");
      const dataBudget = await resBudget.json();
      if (resBudget.ok && dataBudget.allocations) {
        setAllocations(dataBudget.allocations);
        if (dataBudget.allocations.length > 0 && !selectedAllocId) {
          setSelectedAllocId(dataBudget.allocations[0].id.toString());
        }
      }

      // 내 지출 내역 상세 리스트
      const resExp = await fetch("/api/school/expenditures");
      const dataExp = await resExp.json();
      if (resExp.ok) {
        setExpenditures(dataExp.expenditures || []);
      }

      // 내 문의 티켓 내역
      const resTickets = await fetch("/api/school/tickets");
      const dataTickets = await resTickets.json();
      if (resTickets.ok) {
        setTickets(dataTickets.tickets || []);
      }

      // 세션 정보를 얻어서 학교명 설정
      const tokenRes = await fetch("/api/auth/login"); // 간접적으로 세션 갱신을 하거나 파싱
      // 세션을 확인하기 위해 API나 쿠키 값을 사용
    } catch (err) {
      console.error("데이터 로드 실패:", err);
      setMessage({ type: "danger", text: "데이터를 불러오는 데 실패했습니다." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // 쿠키 세션 디코딩 대신 로컬스토리지 또는 API에서 학교명 추출
    const userJson = document.cookie
      .split("; ")
      .find((row) => row.startsWith("school-budget-session"));
    if (userJson) {
      // 심플 헬퍼 호출하여 학교명 가져오기
      fetch("/api/school/budget")
        .then(res => res.json())
        .then(data => {
          if (data.allocations && data.allocations.length > 0) {
            // 첫 번째 배정 항목에서 학교 정보 추정
            // 학교명은 Next.js가 렌더링하도록 나중에 세션 API를 추가하거나 상태값 설정 가능
          }
        });
    }
    
    // 간단한 세션 디코더 (임시 방편: 쿠키가 존재하면 API에서 가져오기)
    const getSchoolSessionName = async () => {
      try {
        const res = await fetch("/api/school/budget");
        const data = await res.json();
        // 헤더 세션에서 가져올 수도 있으나, 지출 목록의 학교명을 사용해 채웁니다.
      } catch {}
    };
    getSchoolSessionName();
  }, []);

  // 로그아웃 처리
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("로그아웃 실패:", err);
    }
  };

  // 지출 내역 기입 제출 검증 및 실행
  const handleExpenseSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setMessage(null);

    if (!selectedAllocId || !expenseCategory || !amount || !expenseDate) {
      setMessage({ type: "danger", text: "모든 필수 입력 값을 기입해 주세요." });
      return;
    }

    const parsedAmount = parseInt(amount.replace(/[^0-9]/g, ""), 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setMessage({ type: "danger", text: "올바른 지출 금액을 입력해 주세요." });
      return;
    }

    // [사전 조건 검증] 자산취득성 교구 구입 경고 팝업 검사
    // 비목이 "자산취득비"이고 금액이 10만 원(100,000원) 이상인 경우 팝업 노출
    if (expenseCategory === "자산취득비" && parsedAmount >= 100000 && !showAssetModal) {
      setPendingExpenseSubmit(() => () => executeExpenseInsert(parsedAmount));
      setShowAssetModal(true);
      return;
    }

    executeExpenseInsert(parsedAmount);
  };

  // 실제 지출 등록 API 요청 호출
  const executeExpenseInsert = async (parsedAmount: number) => {
    setLoading(true);
    setShowAssetModal(false);
    setPendingExpenseSubmit(null);

    try {
      const res = await fetch("/api/school/expenditures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocationId: parseInt(selectedAllocId, 10),
          expenseCategory,
          amount: parsedAmount,
          expenseDate,
          description: description.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "danger", text: data.error || "지출 내역 등록에 실패했습니다." });
        return;
      }

      setMessage({ type: "success", text: "지출 내역이 정상적으로 등록 및 반영되었습니다." });
      // 입력 폼 초기화
      setAmount("");
      setDescription("");
      
      // 데이터 갱신
      loadData();
    } catch {
      setMessage({ type: "danger", text: "지출 등록 처리 중 서버 통신 에러가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  };

  // 지출 내역 삭제
  const handleExpenseDelete = async (id: number, desc: string) => {
    if (!confirm(`선택한 지출 내역을 삭제하시겠습니까? 예산 한도가 즉시 복구됩니다.`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/school/expenditures?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: "danger", text: data.error || "지출 내역 삭제에 실패했습니다." });
        return;
      }

      setMessage({ type: "success", text: "지출 내역이 성공적으로 삭제 및 예산 복구되었습니다." });
      loadData();
    } catch {
      setMessage({ type: "danger", text: "삭제 처리 중 서버 통신 오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  };

  // 1:1 지원 센터 문의 생성 제출
  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!ticketTitle.trim() || !ticketContent.trim()) {
      setMessage({ type: "danger", text: "제목과 문의 내용을 모두 작성해 주세요." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/school/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: ticketTitle.trim(), content: ticketContent.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: "danger", text: data.error || "문의 등록에 실패했습니다." });
        return;
      }

      setMessage({ type: "success", text: "1:1 문의사항이 성공적으로 등록되었습니다. 관리자가 확인 후 답변 예정입니다." });
      setTicketTitle("");
      setTicketContent("");
      loadData();
    } catch {
      setMessage({ type: "danger", text: "문의 등록 처리 중 서버 통신 오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  };

  // 배정 예산 카드 연산용 헬퍼
  const getBudgetDetails = (alloc: Allocation) => {
    const totalAllocated = alloc.allocated_amount;
    const totalSpent = alloc.expenditures?.reduce((sum, e) => sum + e.amount, 0) || 0;
    const remaining = totalAllocated - totalSpent;
    const spentPercent = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
    
    return {
      totalAllocated,
      totalSpent,
      remaining,
      spentPercent: parseFloat(spentPercent.toFixed(1)),
    };
  };

  // 필수 사업 / 공모 사업 분류
  const requiredAllocations = allocations.filter((a) => a.project_type === "필수");
  const contestAllocations = allocations.filter((a) => a.project_type === "공모");

  // 현재 로그인 중인 학교명 표시용
  const currentSchoolName = allocations[0]?.school_id
    ? expenditures[0]?.projectName 
      ? `${expenditures[0]?.projectName.split(" ")[0]} (소속 학교)` 
      : "학교 사용자 계정"
    : "학교 사용자 계정";

  return (
    <div className="app-container">
      {/* 헤더 */}
      <header className="main-header">
        <div className="header-inner">
          <div className="logo-group">
            <img src="/logo-circle.png" alt="경기도여주교육지원청" className="header-logo-img" />
            <div className="logo-text">경기공유학교 학교맞춤형 예산관리</div>
            <div className="user-badge">학교 사용자</div>
          </div>
          <div className="nav-group">
            <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '0.5rem 1rem' }}>
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 메인 영역 */}
      <main className="dashboard-main">
        <div className="dashboard-title-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="dashboard-title">학교 예산 대시보드</h1>
            <p className="dashboard-subtitle">배정된 세부 예산을 조회하고 실시간 지출 현황 및 잔액을 입력하는 관리 페이지입니다.</p>
          </div>
          <button className="btn btn-secondary" onClick={loadData} disabled={loading} style={{ fontSize: '0.85rem' }}>
            새로고침
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="tabs">
          <button
            className={`tab-btn ${activeTab === "budget" ? "active" : ""}`}
            onClick={() => { setActiveTab("budget"); setMessage(null); }}
          >
            예산 배정 및 지출 입력
          </button>
          <button
            className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
            onClick={() => { setActiveTab("history"); setMessage(null); }}
          >
            최근 지출 내역 목록
          </button>
          <button
            className={`tab-btn ${activeTab === "tickets" ? "active" : ""}`}
            onClick={() => { setActiveTab("tickets"); setMessage(null); }}
          >
            1:1 Q&A 지원요청 ({tickets.length})
          </button>
        </div>

        {/* 피드백 상태 메시지 알림 */}
        {message && (
          <div className={`alert alert-${message.type}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ×
            </button>
          </div>
        )}

        {/* 1. 예산 배정 및 지출 입력 탭 */}
        {activeTab === "budget" && (
          <div>
            {/* 지출내역 간편 입력 폼 */}
            {allocations.length > 0 && (
              <div className="glass-card" style={{ marginBottom: '2.5rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-contrast)' }}>
                  지출 내역 간편 기입 (인라인)
                </h2>
                
                <form onSubmit={handleExpenseSubmit} className="inline-form">
                  <div className="form-group">
                    <label className="form-label" htmlFor="allocSelect">대상 세부 사업</label>
                    <select
                      className="form-control"
                      id="allocSelect"
                      value={selectedAllocId}
                      onChange={(e) => setSelectedAllocId(e.target.value)}
                    >
                      {allocations.map((a) => (
                        <option key={a.id} value={a.id}>
                          [{a.project_code}] {a.project_name} ({a.funding_source})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="categorySelect">지출 비목</label>
                    <select
                      className="form-control"
                      id="categorySelect"
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                    >
                      <option value="운영비">운영비</option>
                      <option value="강사비">강사비 (50% 상한)</option>
                      <option value="학생 주·부식비">학생 주·부식비 (10% 상한)</option>
                      <option value="업무추진비">업무추진비 (공모사업 5%/30% 상한)</option>
                      <option value="여비">여비</option>
                      <option value="자산취득비">자산취득비 (10만원 이상 사전승인)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="expenseAmount">지출금액 (원)</label>
                    <input
                      className="form-control"
                      type="text"
                      id="expenseAmount"
                      placeholder="숫자만 입력"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="expenseDate">지출(예정) 일자</label>
                    <input
                      className="form-control"
                      type="date"
                      id="expenseDate"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ flex: 1.5 }}>
                    <label className="form-label" htmlFor="description">지출 세부 내용</label>
                    <input
                      className="form-control"
                      type="text"
                      id="description"
                      placeholder="적요 또는 사용 목적 기입"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <button className="btn btn-primary" type="submit" style={{ height: '2.8rem' }} disabled={loading}>
                    등록
                  </button>
                </form>
              </div>
            )}

            {/* 필수 사업 교부 내역 영역 */}
            <div style={{ marginBottom: '2.5rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--primary-light)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ height: '8px', width: '8px', background: 'var(--primary)', borderRadius: '50%' }} />
                교육청 지정 필수 사업 예산 교부 내역
              </h2>
              
              {requiredAllocations.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2.5rem' }}>
                  배정된 필수 사업 예산이 없습니다.
                </div>
              ) : (
                <div className="balance-grid">
                  {requiredAllocations.map((alloc) => {
                    const { totalAllocated, totalSpent, remaining, spentPercent } = getBudgetDetails(alloc);
                    return (
                      <div key={alloc.id} className="glass-card balance-card required">
                        <div className="card-header-row">
                          <span className="project-tag required">필수 사업</span>
                          <span className="project-code">{alloc.project_code}</span>
                        </div>
                        
                        <h3 className="project-title" title={alloc.project_name}>{alloc.project_name}</h3>
                        
                        <div className="balance-values">
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>실시간 예산 잔액</div>
                          <div className="balance-amount">{remaining.toLocaleString()}원</div>
                          <div className="allocated-amount">
                            총 예산: {totalAllocated.toLocaleString()}원 (지출: {totalSpent.toLocaleString()}원)
                          </div>
                        </div>

                        <div className="progress-container">
                          <div className="progress-bar-bg">
                            <div 
                              className="progress-bar-fill required" 
                              style={{ width: `${Math.min(spentPercent, 100)}%` }} 
                            />
                          </div>
                          <div className="progress-label-row">
                            <span>집행률 {spentPercent}%</span>
                            <span>잔율 {100 - spentPercent < 0 ? 0 : (100 - spentPercent).toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 공모 사업 교부 내역 영역 */}
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ height: '8px', width: '8px', background: 'var(--secondary)', borderRadius: '50%' }} />
                공모 사업 예산 교부 내역
              </h2>
              
              {contestAllocations.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2.5rem' }}>
                  배정된 공모 사업 예산이 없습니다.
                </div>
              ) : (
                <div className="balance-grid">
                  {contestAllocations.map((alloc) => {
                    const { totalAllocated, totalSpent, remaining, spentPercent } = getBudgetDetails(alloc);
                    return (
                      <div key={alloc.id} className="glass-card balance-card contest">
                        <div className="card-header-row">
                          <span className="project-tag contest">공모 사업</span>
                          <span className="project-code">{alloc.project_code}</span>
                        </div>
                        
                        <h3 className="project-title" title={alloc.project_name}>{alloc.project_name}</h3>
                        
                        <div className="balance-values">
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>실시간 예산 잔액</div>
                          <div className="balance-amount">{remaining.toLocaleString()}원</div>
                          <div className="allocated-amount">
                            총 예산: {totalAllocated.toLocaleString()}원 (지출: {totalSpent.toLocaleString()}원)
                          </div>
                        </div>

                        <div className="progress-container">
                          <div className="progress-bar-bg">
                            <div 
                              className="progress-bar-fill contest" 
                              style={{ width: `${Math.min(spentPercent, 100)}%` }} 
                            />
                          </div>
                          <div className="progress-label-row">
                            <span>집행률 {spentPercent}%</span>
                            <span>잔율 {100 - spentPercent < 0 ? 0 : (100 - spentPercent).toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. 최근 지출 내역 목록 탭 */}
        {activeTab === "history" && (
          <div className="glass-card">
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem' }}>기입된 지출 목록</h2>
            
            <div className="table-container">
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>지출 일자</th>
                    <th>사업 코드</th>
                    <th>세부 사업명</th>
                    <th>지출 비목</th>
                    <th style={{ textAlign: 'right' }}>지출액</th>
                    <th>세부 용도/내역</th>
                    <th style={{ textAlign: 'center' }}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {expenditures.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>
                        등록된 지출 내역이 없습니다. 예산 메뉴에서 지출 내역을 간편 등록해 보세요.
                      </td>
                    </tr>
                  ) : (
                    expenditures.map((e) => (
                      <tr key={e.id}>
                        <td>{e.expenseDate}</td>
                        <td className="project-code">{e.projectCode}</td>
                        <td style={{ fontWeight: 600 }}>{e.projectName}</td>
                        <td>
                          <span className="user-badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            {e.expenseCategory}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-contrast)' }}>
                          {e.amount.toLocaleString()}원
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{e.description || "-"}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn btn-danger"
                            onClick={() => handleExpenseDelete(e.id, e.description || "")}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. 1:1 Q&A 지원요청 탭 */}
        {activeTab === "tickets" && (
          <div className="dashboard-layout">
            {/* 문의 작성 폼 */}
            <div className="glass-card">
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem' }}>새로운 애로사항/예산 승인 신청</h2>
              
              <form onSubmit={handleTicketSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="ticketTitle">제목</label>
                  <input
                    className="form-control"
                    type="text"
                    id="ticketTitle"
                    placeholder="예: 예산 비목 변경 승인 요청의 건"
                    value={ticketTitle}
                    onChange={(e) => setTicketTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label" htmlFor="ticketContent">문의 내용 및 애로사항</label>
                  <textarea
                    className="form-control"
                    id="ticketContent"
                    rows={5}
                    placeholder="지침 해석 질의 또는 변경 승인 사유를 상세하게 작성하세요."
                    value={ticketContent}
                    onChange={(e) => setTicketContent(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" type="submit" disabled={loading}>
                    문의사항 등록
                  </button>
                </div>
              </form>
            </div>

            {/* 내 문의 이력 리스트 */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>문의 및 답변 이력</h2>
              
              {tickets.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                  접수한 문의 이력이 없습니다.
                </div>
              ) : (
                tickets.map((t) => (
                  <div key={t.id} style={{ borderBottom: '1px solid var(--border-card)', paddingBottom: '1rem', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(t.created_at).toLocaleDateString()}
                      </span>
                      <span className={`project-tag ${t.status === "OPEN" ? "required" : "contest"}`} style={{ fontSize: '0.65rem' }}>
                        {t.status === "OPEN" ? "대기중" : "답변 완료"}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.25rem' }}>{t.title}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', whiteSpace: 'pre-wrap' }}>
                      {t.content}
                    </p>

                    {t.status === "RESOLVED" && t.answer && (
                      <div style={{ background: 'rgba(6, 182, 212, 0.05)', borderLeft: '3px solid var(--secondary)', padding: '0.75rem', borderRadius: '4px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--secondary)', marginBottom: '0.25rem' }}>
                          교육지원청 답변 ({new Date(t.answered_at || '').toLocaleDateString()})
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{t.answer}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* 4. 자산취득성 교구 구입 사전 승인 모달 */}
      {showAssetModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span>⚠️ 사전 승인 안내</span>
            </div>
            <div className="modal-body">
              <p>지출 항목이 <strong>[자산취득비]</strong>이며 지출 금액이 <strong>10만 원 이상</strong>입니다.</p>
              <p style={{ color: 'var(--text-primary)', fontWeight: 700, marginTop: '0.75rem' }}>
                ※ 여주미래교육협력지구 사업 지침에 따라 10만 원 이상의 자산취득성 교구 구입은 사전에 교육지원청 관리자의 승인이 필수적입니다.
              </p>
              <p style={{ marginTop: '0.75rem' }}>
                이미 사전에 승인을 받으셨거나 공문 처리가 완료된 경우에만 지출 기입을 등록해 주시기 바랍니다. 사전 승인이 아직 진행 중이거나 반려된 경우, 지출 기입을 삼가 주시기 바랍니다.
              </p>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => { setShowAssetModal(false); setPendingExpenseSubmit(null); }}
              >
                등록 취소
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => { if (pendingExpenseSubmit) pendingExpenseSubmit(); }}
              >
                사전 승인 완료(등록 진행)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

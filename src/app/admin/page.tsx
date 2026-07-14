"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Allocation {
  id: number;
  schoolId: number;
  schoolName: string;
  projectCode: string;
  projectName: string;
  fundingSource: string;
  projectType: string;
  allocatedAmount: number;
  spentAmount: number;
}

interface Ticket {
  id: number;
  schoolId: number;
  schoolName: string;
  title: string;
  content: string;
  status: "OPEN" | "RESOLVED";
  answer: string | null;
  createdAt: string;
  answeredAt: string | null;
}

interface SchoolSummary {
  schoolId: number;
  schoolName: string;
  totalAllocated: number;
  totalSpent: number;
  burnRate: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"upload" | "grid" | "monitor" | "tickets">("grid");
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  
  // 상태 로딩 및 메시지
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "danger" | "info"; text: string } | null>(null);

  // 검색 및 필터링 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("default");
  const [expandedSchools, setExpandedSchools] = useState<{ [key: string]: boolean }>({});
  const [monitorFilter, setMonitorFilter] = useState<"all" | "low">("all");
  
  // 인라인 수정 상태
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  // 티켓 답변 입력 상태
  const [ticketAnswers, setTicketAnswers] = useState<{ [key: number]: string }>({});

  // 엑셀 업로드 상태
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // 데이터 로드 함수
  const loadData = async () => {
    setLoading(true);
    try {
      // 예산 정보 로드
      const resAlloc = await fetch("/api/admin/allocations");
      const dataAlloc = await resAlloc.json();
      if (resAlloc.ok) {
        setAllocations(dataAlloc.allocations || []);
      }

      // 티켓 정보 로드
      const resTickets = await fetch("/api/admin/tickets");
      const dataTickets = await resTickets.json();
      if (resTickets.ok) {
        setTickets(dataTickets.tickets || []);
      }
    } catch (err) {
      console.error("데이터 로드 실패:", err);
      setMessage({ type: "danger", text: "데이터를 불러오는 데 실패했습니다." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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

  // 엑셀 파일 업로드 처리
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setMessage({ type: "danger", text: "업로드할 파일을 선택해 주세요." });
      return;
    }

    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", uploadFile);

    try {
      const res = await fetch("/api/admin/upload-budget", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "danger", text: data.error || "일괄 업로드에 실패했습니다." });
        return;
      }

      setMessage({
        type: "success",
        text: `성공적으로 ${data.count}건의 예산 배정액을 일괄 등록했습니다. (누락/건너뜀: ${data.skippedCount}건)`,
      });
      setUploadFile(null);
      // 파일 인풋 초기화
      const fileInput = document.getElementById("excelFile") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      
      loadData();
    } catch {
      setMessage({ type: "danger", text: "업로드 처리 중 서버 통신 에러가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  };

  // 개별 예산 수정 시작
  const startEdit = (alloc: Allocation) => {
    setEditingId(alloc.id);
    setEditValue(alloc.allocatedAmount.toString());
  };

  // 개별 예산 수정 취소
  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  // 개별 예산 수정 저장
  const saveEdit = async (id: number) => {
    const parsed = parseInt(editValue.replace(/[^0-9]/g, ""), 10);
    if (isNaN(parsed) || parsed < 0) {
      setMessage({ type: "danger", text: "올바른 예산 금액을 입력해 주세요." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/allocations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, allocatedAmount: parsed }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: "danger", text: data.error || "예산 수정에 실패했습니다." });
        return;
      }

      setAllocations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, allocatedAmount: parsed } : a))
      );
      setEditingId(null);
      setMessage({ type: "success", text: "배정 예산이 성공적으로 수정되었습니다." });
    } catch {
      setMessage({ type: "danger", text: "수정 사항 저장 중 오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  };

  // 학교 계정 임시 비밀번호 초기화
  const resetPassword = async (schoolId: number, schoolName: string) => {
    if (!confirm(`'${schoolName}'의 비밀번호를 임시 비밀번호(yeoju2026!)로 초기화하시겠습니까?`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "danger", text: data.error || "비밀번호 초기화에 실패했습니다." });
        return;
      }

      setMessage({
        type: "success",
        text: `'${schoolName}'의 비밀번호가 성공적으로 초기화되었습니다. (임시 비밀번호: yeoju2026!)`,
      });
    } catch {
      setMessage({ type: "danger", text: "비밀번호 초기화 중 오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  };

  // 티켓 답변 등록 제출
  const submitAnswer = async (ticketId: number) => {
    const answerText = ticketAnswers[ticketId];
    if (!answerText || !answerText.trim()) {
      alert("답변 내용을 기입해 주세요.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/tickets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticketId, answer: answerText.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: "danger", text: data.error || "답변 등록에 실패했습니다." });
        return;
      }

      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? { ...t, answer: answerText.trim(), status: "RESOLVED", answeredAt: new Date().toISOString() }
            : t
        )
      );
      // 입력 폼 청소
      setTicketAnswers((prev) => {
        const copy = { ...prev };
        delete copy[ticketId];
        return copy;
      });
      setMessage({ type: "success", text: "지원요청 답변이 성공적으로 등록되었습니다." });
    } catch {
      setMessage({ type: "danger", text: "답변 등록 중 서버 오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  };

  // 아코디언 토글 헬퍼
  const toggleSchoolExpand = (schoolName: string) => {
    setExpandedSchools((prev) => ({
      ...prev,
      [schoolName]: !prev[schoolName],
    }));
  };

  // 필터링 및 정렬/그룹화된 예산 데이터 산출
  const groupedData = (() => {
    const filtered = allocations.filter((a) => {
      const query = searchQuery.toLowerCase();
      return (
        a.schoolName.toLowerCase().includes(query) ||
        a.projectName.toLowerCase().includes(query) ||
        a.projectCode.toLowerCase().includes(query)
      );
    });

    if (sortBy === "project") {
      // 세부사업 코드/명칭별 그룹화
      const projectMap = new Map<string, {
        groupName: string;
        groupCode: string;
        allocatedTotal: number;
        spentTotal: number;
        items: Allocation[];
      }>();

      filtered.forEach((a) => {
        const key = `${a.projectCode}_${a.projectName}`;
        const current = projectMap.get(key) || {
          groupName: a.projectName,
          groupCode: a.projectCode,
          allocatedTotal: 0,
          spentTotal: 0,
          items: []
        };
        current.allocatedTotal += a.allocatedAmount;
        current.spentTotal += a.spentAmount;
        current.items.push(a);
        projectMap.set(key, current);
      });

      const list = Array.from(projectMap.values());
      list.sort((a, b) => a.groupCode.localeCompare(b.groupCode));
      return { type: "project", list };
    }

    if (sortBy === "funding") {
      // 재원(지원형태)별 그룹화
      const fundingMap = new Map<string, {
        groupName: string;
        allocatedTotal: number;
        spentTotal: number;
        items: Allocation[];
      }>();

      filtered.forEach((a) => {
        const current = fundingMap.get(a.fundingSource) || {
          groupName: a.fundingSource,
          allocatedTotal: 0,
          spentTotal: 0,
          items: []
        };
        current.allocatedTotal += a.allocatedAmount;
        current.spentTotal += a.spentAmount;
        current.items.push(a);
        fundingMap.set(a.fundingSource, current);
      });

      const list = Array.from(fundingMap.values());
      list.sort((a, b) => a.groupName.localeCompare(b.groupName, "ko-KR"));
      return { type: "funding", list };
    }

    // 기본(default) 또는 학교명 정렬: 학교별 그룹화
    const schoolMap = new Map<string, {
      groupName: string;
      schoolId: number | string;
      level: "초등" | "중등" | "고등" | "기타";
      allocatedTotal: number;
      spentTotal: number;
      items: Allocation[];
    }>();

    filtered.forEach((a) => {
      let level: "초등" | "중등" | "고등" | "기타" = "기타";
      if (a.schoolName.includes("초등학교")) level = "초등";
      else if (a.schoolName.includes("중학교")) level = "중등";
      else if (a.schoolName.includes("고등학교")) level = "고등";

      const current = schoolMap.get(a.schoolName) || {
        groupName: a.schoolName,
        schoolId: a.schoolId,
        level,
        allocatedTotal: 0,
        spentTotal: 0,
        items: []
      };

      current.allocatedTotal += a.allocatedAmount;
      current.spentTotal += a.spentAmount;
      current.items.push(a);
      schoolMap.set(a.schoolName, current);
    });

    const list = Array.from(schoolMap.values());
    
    if (sortBy === "school_name") {
      // 학교명 단순 가나다 정렬
      list.sort((a, b) => a.groupName.localeCompare(b.groupName, "ko-KR"));
    } else {
      // 학교급 순(초-중-고-기타) 정렬
      const levelOrder = { "초등": 1, "중등": 2, "고등": 3, "기타": 4 };
      list.sort((a, b) => {
        const orderA = levelOrder[a.level || "기타"];
        const orderB = levelOrder[b.level || "기타"];
        if (orderA !== orderB) return orderA - orderB;
        return a.groupName.localeCompare(b.groupName, "ko-KR");
      });
    }

    return { type: "school", list };
  })();

  // 학교별 집행 현황 요약 데이터 산출 (모니터링용)
  const schoolSummaries: SchoolSummary[] = (() => {
    const summariesMap = new Map<number, { name: string; allocated: number; spent: number }>();
    
    allocations.forEach((a) => {
      const current = summariesMap.get(a.schoolId) || { name: a.schoolName, allocated: 0, spent: 0 };
      summariesMap.set(a.schoolId, {
        name: a.schoolName,
        allocated: current.allocated + a.allocatedAmount,
        spent: current.spent + a.spentAmount,
      });
    });

    const summaries: SchoolSummary[] = [];
    summariesMap.forEach((val, key) => {
      const burnRate = val.allocated > 0 ? (val.spent / val.allocated) * 100 : 0;
      summaries.push({
        schoolId: key,
        schoolName: val.name,
        totalAllocated: val.allocated,
        totalSpent: val.spent,
        burnRate: parseFloat(burnRate.toFixed(1)),
      });
    });

    // 소진율 필터링 적용 (low: 20% 미만 집행 저조 학교)
    if (monitorFilter === "low") {
      return summaries.filter((s) => s.burnRate < 20).sort((a, b) => a.burnRate - b.burnRate);
    }
    return summaries.sort((a, b) => b.burnRate - a.burnRate);
  })();

  return (
    <div className="app-container">
      <header className="main-header">
        <div className="header-inner">
          <div className="logo-group">
            <img src="/logo-circle.png" alt="경기도여주교육지원청" className="header-logo-img" />
            <div className="logo-text">경기공유학교 예산지원센터</div>
            <div className="user-badge">여주교육지원청 관리자</div>
          </div>
          <div className="nav-group">
            <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '0.5rem 1rem' }}>
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-title-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="dashboard-title">관리자 통합 제어판</h1>
            <p className="dashboard-subtitle">여주 관내 학교별 교부 예산을 모니터링하고 지원하는 업무 공간입니다.</p>
          </div>
          <button className="btn btn-secondary" onClick={loadData} disabled={loading} style={{ fontSize: '0.85rem' }}>
            새로고침
          </button>
        </div>

        {/* 탭 버튼 */}
        <div className="tabs">
          <button
            className={`tab-btn ${activeTab === "grid" ? "active" : ""}`}
            onClick={() => { setActiveTab("grid"); setMessage(null); }}
          >
            배정 예산 점검 및 조정
          </button>
          <button
            className={`tab-btn ${activeTab === "monitor" ? "active" : ""}`}
            onClick={() => { setActiveTab("monitor"); setMessage(null); }}
          >
            실시간 집행 모니터링
          </button>
          <button
            className={`tab-btn ${activeTab === "upload" ? "active" : ""}`}
            onClick={() => { setActiveTab("upload"); setMessage(null); }}
          >
            일괄 업로드 (Bulk)
          </button>
          <button
            className={`tab-btn ${activeTab === "tickets" ? "active" : ""}`}
            onClick={() => { setActiveTab("tickets"); setMessage(null); }}
          >
            통합 지원 센터 ({tickets.filter((t) => t.status === "OPEN").length})
          </button>
        </div>

        {/* 상태 피드백 알림 */}
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

        {/* 1. 예산 배정 조정 그리드 탭 */}
        {activeTab === "grid" && (
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>배정 예산 리스트</h2>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>정렬/그룹화:</span>
                  <select
                    className="form-control"
                    style={{ width: '190px', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      setExpandedSchools({}); // 정렬 기준 변경 시 펼침 상태 초기화
                    }}
                  >
                    <option value="default">학교급 순 (초-중-고)</option>
                    <option value="school_name">학교명 가나다순</option>
                    <option value="project">세부사업별 묶음</option>
                    <option value="funding">재원별 묶음</option>
                  </select>
                </div>
                <input
                  className="form-control"
                  type="text"
                  placeholder="학교명, 사업명, 사업코드 검색..."
                  style={{ maxWidth: '250px', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* 전체 펼치기 / 접기 퀵 툴바 */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const allExp: any = {};
                  groupedData.list.forEach((g: any) => { allExp[g.groupName] = true; });
                  setExpandedSchools(allExp);
                }}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                모두 펼치기
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setExpandedSchools({})}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                모두 접기
              </button>
            </div>

            {/* 아코디언 목록 뷰 */}
            {groupedData.list.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3.5rem 1rem', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '8px', border: '1px dashed rgba(255, 255, 255, 0.08)' }}>
                검색 결과가 존재하지 않거나 등록된 예산 데이터가 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {groupedData.list.map((group: any) => {
                  const isExpanded = expandedSchools[group.groupName] || false;
                  return (
                    <div key={group.groupName} style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      {/* 아코디언 헤더 */}
                      <div
                        onClick={() => toggleSchoolExpand(group.groupName)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '1rem 1.5rem',
                          background: isExpanded ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          {groupedData.type === "school" && (
                            <span className={`school-level-badge level-${group.level}`}>
                              {group.level}
                            </span>
                          )}
                          {groupedData.type === "project" && (
                            <span className="school-level-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                              코드 {group.groupCode}
                            </span>
                          )}
                          {groupedData.type === "funding" && (
                            <span className="school-level-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                              재원
                            </span>
                          )}
                          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{group.groupName}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            ({groupedData.type === "school" ? "세부사업" : "학교수"} {group.items.length}개)
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                          <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.875rem', flexWrap: 'wrap' }}>
                            <div>
                              <span style={{ color: 'var(--text-secondary)', marginRight: '0.25rem' }}>총 교부:</span>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{group.allocatedTotal.toLocaleString()}원</span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-secondary)', marginRight: '0.25rem' }}>총 지출:</span>
                              <span style={{ fontWeight: 700, color: '#38bdf8' }}>{group.spentTotal.toLocaleString()}원</span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-secondary)', marginRight: '0.25rem' }}>집행률:</span>
                              <span style={{
                                fontWeight: 700,
                                color: group.allocatedTotal > 0 && (group.spentTotal / group.allocatedTotal) * 100 > 90 ? '#f43f5e' : '#34d399'
                              }}>
                                {group.allocatedTotal > 0 ? ((group.spentTotal / group.allocatedTotal) * 100).toFixed(1) : '0.0'}%
                              </span>
                            </div>
                          </div>
                          <span style={{
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                            fontSize: '0.875rem',
                            color: 'var(--text-secondary)'
                          }}>
                            ▼
                          </span>
                        </div>
                      </div>

                      {/* 아코디언 바디 */}
                      {isExpanded && (
                        <div
                          style={{
                            padding: '0.5rem 1.5rem 1.5rem',
                            background: 'rgba(0, 0, 0, 0.15)',
                            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                          }}
                        >
                          <div className="table-container" style={{ margin: 0, boxShadow: 'none', background: 'none' }}>
                            <table className="premium-table" style={{ background: 'none' }}>
                              <thead>
                                <tr>
                                  {groupedData.type !== "school" && <th>학교명</th>}
                                  {groupedData.type !== "project" && (
                                    <>
                                      <th>유형</th>
                                      <th>코드</th>
                                      <th>세부 사업 명칭</th>
                                    </>
                                  )}
                                  {groupedData.type !== "funding" && <th>재원</th>}
                                  <th style={{ textAlign: 'right' }}>교부 금액</th>
                                  <th style={{ textAlign: 'center' }}>지출액</th>
                                  <th style={{ textAlign: 'center' }}>비밀번호</th>
                                  <th style={{ textAlign: 'center' }}>관리</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.items.map((alloc: any) => (
                                  <tr key={alloc.id}>
                                    {groupedData.type !== "school" && <td style={{ fontWeight: 700 }}>{alloc.schoolName}</td>}
                                    {groupedData.type !== "project" && (
                                      <>
                                        <td>
                                          <span className={`project-tag ${alloc.projectType === "필수" ? "required" : "contest"}`}>
                                            {alloc.projectType}
                                          </span>
                                        </td>
                                        <td className="project-code">{alloc.projectCode}</td>
                                        <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={alloc.projectName}>
                                          {alloc.projectName}
                                        </td>
                                      </>
                                    )}
                                    {groupedData.type !== "funding" && <td>{alloc.fundingSource}</td>}
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-contrast)' }}>
                                      {editingId === alloc.id ? (
                                        <input
                                          className="grid-edit-input"
                                          type="text"
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          autoFocus
                                        />
                                      ) : (
                                        `${alloc.allocatedAmount.toLocaleString()}원`
                                      )}
                                    </td>
                                    <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                      {alloc.spentAmount.toLocaleString()}원
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      <button
                                        className="btn btn-secondary"
                                        onClick={() => resetPassword(alloc.schoolId, alloc.schoolName)}
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                      >
                                        초기화
                                      </button>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      {editingId === alloc.id ? (
                                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                          <button
                                            className="btn btn-success"
                                            onClick={() => saveEdit(alloc.id)}
                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                          >
                                            저장
                                          </button>
                                          <button
                                            className="btn btn-secondary"
                                            onClick={cancelEdit}
                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                          >
                                            취소
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          className="btn btn-primary"
                                          onClick={() => startEdit(alloc)}
                                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                        >
                                          수정
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2. 실시간 집행 모니터링 탭 */}
        {activeTab === "monitor" && (
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>학교별 소진율 모니터링</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  관내 학교별 총액 대비 실시간 예산 집행 수준을 파악합니다.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className={`btn ${monitorFilter === "all" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setMonitorFilter("all")}
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                >
                  전체 보기
                </button>
                <button
                  className={`btn ${monitorFilter === "low" ? "btn-danger" : "btn-secondary"}`}
                  onClick={() => setMonitorFilter("low")}
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                >
                  집행 저조 학교 필터 (소진율 20% 미만)
                </button>
              </div>
            </div>

            <div className="monitor-list">
              {schoolSummaries.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>
                  집행율 조건에 해당하는 학교가 없거나 배정 내역이 존재하지 않습니다.
                </div>
              ) : (
                schoolSummaries.map((s) => {
                  const isLow = s.burnRate < 20;
                  return (
                    <div key={s.schoolId} className="monitor-item glass-card" style={{ padding: '1.25rem' }}>
                      <div className="monitor-info">
                        <span className="monitor-school-name" style={{ fontSize: '1.05rem' }}>{s.schoolName}</span>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            집행액: <strong>{s.totalSpent.toLocaleString()}원</strong> / 교부액: {s.totalAllocated.toLocaleString()}원
                          </span>
                          <span className={`monitor-burn-rate ${isLow ? "low" : "good"}`} style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                            {s.burnRate}%
                          </span>
                        </div>
                      </div>
                      <div className="progress-bar-bg" style={{ height: '10px' }}>
                        <div
                          className={`progress-bar-fill ${isLow ? "danger-fill" : "required"}`}
                          style={{ width: `${Math.min(s.burnRate, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* 3. 예산 일괄 업로드 탭 */}
        {activeTab === "upload" && (
          <div className="glass-card" style={{ maxWidth: '700px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>교부 예산 일괄 등록</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              사전에 취합된 여주 관내 학교별 필수/공모 사업의 통합 교부액 스프레드시트 파일(xlsx 또는 csv)을 주입(Upload)합니다.
            </p>

            <div className="alert alert-info">
              <strong>업로드 파일 필수 헤더 칼럼 구조:</strong>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                <span style={{ background: 'rgba(0,0,0,0.2)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>학교명</span>
                <span style={{ background: 'rgba(0,0,0,0.2)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>사업유형</span>
                <span style={{ background: 'rgba(0,0,0,0.2)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>세부사업코드_및_명칭</span>
                <span style={{ background: 'rgba(0,0,0,0.2)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>재원구분</span>
                <span style={{ background: 'rgba(0,0,0,0.2)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>교부금액</span>
              </div>
            </div>

            <form onSubmit={handleUploadSubmit} style={{ marginTop: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="excelFile">엑셀/CSV 파일 선택</label>
                <input
                  className="form-control"
                  type="file"
                  id="excelFile"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button className="btn btn-primary" type="submit" disabled={loading || !uploadFile}>
                  {loading ? "데이터 처리 및 업로드 중..." : "예산 데이터 일괄 주입"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 4. Q&A 티켓 답변 관리 탭 */}
        {activeTab === "tickets" && (
          <div className="glass-card">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>학교 1:1 지원 요청 목록</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {tickets.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>
                  학교에서 남긴 질의사항 및 지원 요청 내역이 없습니다.
                </div>
              ) : (
                tickets.map((ticket) => (
                  <div key={ticket.id} className="glass-card" style={{ padding: '1.5rem', background: 'rgba(21, 28, 46, 0.4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span className="user-badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-card)' }}>
                        {ticket.schoolName}
                      </span>
                      <span className={`project-tag ${ticket.status === "OPEN" ? "required" : "contest"}`}>
                        {ticket.status === "OPEN" ? "답변 대기" : "답변 완료"}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-contrast)' }}>
                      {ticket.title}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem', whiteSpace: 'pre-wrap' }}>
                      {ticket.content}
                    </p>

                    {ticket.status === "RESOLVED" ? (
                      <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '1rem', borderRadius: '8px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                          교육지원청 답변 ({new Date(ticket.answeredAt || '').toLocaleDateString()})
                        </div>
                        <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{ticket.answer}</p>
                      </div>
                    ) : (
                      <div className="form-group" style={{ marginTop: '1rem' }}>
                        <textarea
                          className="form-control"
                          rows={3}
                          placeholder="답변 및 승인 여부를 작성하세요..."
                          value={ticketAnswers[ticket.id] || ""}
                          onChange={(e) =>
                            setTicketAnswers((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                          }
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                          <button className="btn btn-success" onClick={() => submitAnswer(ticket.id)} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
                            답변 등록
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

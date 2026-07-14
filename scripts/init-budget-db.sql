-- ════════════════════════════════════════════════════
-- 여주 경기공유학교 학교맞춤형 - 예산 관리 시스템 DB 세팅
-- 실행 위치: Supabase Dashboard > SQL Editor
-- ════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────
-- 1. allocations (예산 배정 테이블) 생성
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS allocations (
  id                SERIAL PRIMARY KEY,
  school_id         INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  project_code      VARCHAR(50) NOT NULL,
  project_name      VARCHAR(200) NOT NULL,
  funding_source    VARCHAR(50) NOT NULL CHECK (funding_source IN ('시청 보조금', '교육청 지원금')),
  project_type      VARCHAR(20) NOT NULL CHECK (project_type IN ('필수', '공모')),
  allocated_amount  BIGINT NOT NULL CHECK (allocated_amount >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_allocations_school_id ON allocations(school_id);
CREATE INDEX IF NOT EXISTS idx_allocations_project_type ON allocations(project_type);

-- ─────────────────────────────────────────────────────
-- 2. expenditures (지출 내역 테이블) 생성
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenditures (
  id                SERIAL PRIMARY KEY,
  allocation_id     INTEGER NOT NULL REFERENCES allocations(id) ON DELETE CASCADE,
  expense_category  VARCHAR(100) NOT NULL, -- 강사비, 학생 주·부식비, 업무추진비, 운영비, 여비 등
  amount            BIGINT NOT NULL CHECK (amount >= 0),
  expense_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  description       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_expenditures_allocation_id ON expenditures(allocation_id);

-- ─────────────────────────────────────────────────────
-- 3. support_tickets (1:1 지원 요청 테이블) 생성
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id            SERIAL PRIMARY KEY,
  school_id     INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title         VARCHAR(200) NOT NULL,
  content       TEXT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
  answer        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at   TIMESTAMPTZ
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_support_tickets_school_id ON support_tickets(school_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

-- ─────────────────────────────────────────────────────
-- 4. Row Level Security(RLS) 활성화
-- ─────────────────────────────────────────────────────
ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenditures ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────
-- 5. RLS 정책 설정 (공용/인증된 세션 대상)
-- ─────────────────────────────────────────────────────

-- allocations 테이블 정책
DROP POLICY IF EXISTS "Allow read access to allocations" ON allocations;
CREATE POLICY "Allow read access to allocations"
  ON allocations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow service_role full control on allocations" ON allocations;
CREATE POLICY "Allow service_role full control on allocations"
  ON allocations FOR ALL TO service_role USING (true);

-- expenditures 테이블 정책
DROP POLICY IF EXISTS "Allow read access to expenditures" ON expenditures;
CREATE POLICY "Allow read access to expenditures"
  ON expenditures FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow service_role full control on expenditures" ON expenditures;
CREATE POLICY "Allow service_role full control on expenditures"
  ON expenditures FOR ALL TO service_role USING (true);

-- support_tickets 테이블 정책
DROP POLICY IF EXISTS "Allow read access to support_tickets" ON support_tickets;
CREATE POLICY "Allow read access to support_tickets" ON support_tickets FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow service_role full control on support_tickets" ON support_tickets;
CREATE POLICY "Allow service_role full control on support_tickets" ON support_tickets FOR ALL TO service_role USING (true);

-- ─────────────────────────────────────────────────────
-- 6. 테스트용 예산 배정 시드 데이터 삽입
-- ─────────────────────────────────────────────────────
-- 가남초등학교 테스트 예산 배정
INSERT INTO allocations (school_id, project_code, project_name, funding_source, project_type, allocated_amount)
SELECT id, '111', '여주형 미래교육', '시청 보조금', '필수', 12200000
FROM schools WHERE school_name = '가남초등학교';

INSERT INTO allocations (school_id, project_code, project_name, funding_source, project_type, allocated_amount)
SELECT id, '121', '지역협력 방과후학교', '시청 보조금', '필수', 40528000
FROM schools WHERE school_name = '가남초등학교';

INSERT INTO allocations (school_id, project_code, project_name, funding_source, project_type, allocated_amount)
SELECT id, '112', '같이학교 교육과정', '교육청 지원금', '공모', 5000000
FROM schools WHERE school_name = '가남초등학교';

-- 여주초등학교 테스트 예산 배정
INSERT INTO allocations (school_id, project_code, project_name, funding_source, project_type, allocated_amount)
SELECT id, '111', '여주형 미래교육', '시청 보조금', '필수', 14200000
FROM schools WHERE school_name = '여주초등학교';

INSERT INTO allocations (school_id, project_code, project_name, funding_source, project_type, allocated_amount)
SELECT id, '121', '지역협력 방과후학교', '시청 보조금', '필수', 24306000
FROM schools WHERE school_name = '여주초등학교';

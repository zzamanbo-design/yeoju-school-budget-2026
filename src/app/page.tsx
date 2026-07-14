export default function HomePage() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#0b0f19' }}>
      <div className="logo-group" style={{ flexDirection: 'column', gap: '1rem' }}>
        <div className="logo-icon" style={{ height: '3.5rem', width: '3.5rem', fontSize: '1.5rem' }}>여</div>
        <div className="logo-text" style={{ fontSize: '1.5rem' }}>여주시 학교맞춤형 예산관리시스템</div>
        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>대시보드로 이동하는 중입니다...</div>
      </div>
    </div>
  );
}

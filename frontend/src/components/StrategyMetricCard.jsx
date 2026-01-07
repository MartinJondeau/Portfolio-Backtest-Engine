// src/components/StrategyMetricCard.jsx
export default function StrategyMetricCard({ title, value, color }) {
  const finalColor = color || '#ffffff';

  return (
    <div className="bloomberg-panel metric-card">
      <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: `radial-gradient(circle, ${finalColor}20, transparent)`, pointerEvents: 'none' }}></div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '800', letterSpacing: '2px', marginBottom: '12px', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ fontSize: '28px', fontWeight: '900', color: finalColor, fontFamily: 'var(--font-mono)', textShadow: `0 0 15px ${finalColor}30` }}>{value}</div>
    </div>
  )
}
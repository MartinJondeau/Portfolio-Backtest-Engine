export default function StrategyMetricCard({ title, value, color }) {
  const finalColor = color || '#ffffff';

  return (
    <div className="bloomberg-panel metric-card">

      {/* Primary center-right light */}
      <div style={{
        position: 'absolute',
        inset: '-40%',
        background: `
          linear-gradient(
            135deg,
            transparent 25%,
            ${finalColor}20 45%,
            ${finalColor}10 65%,
            transparent 85%
          )
        `,
        filter: 'blur(45px)',
        transform: 'translateX(25%) rotate(-6deg)',
        pointerEvents: 'none'
      }} />

      {/* Right-edge reflection */}
      <div style={{
        position: 'absolute',
        inset: '-30%',
        background: `
          linear-gradient(
            60deg,
            transparent 55%,
            ${finalColor}14 70%,
            transparent 90%
          )
        `,
        filter: 'blur(65px)',
        transform: 'translateX(35%) rotate(10deg)',
        pointerEvents: 'none'
      }} />

      {/* Subtle glass edge */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          linear-gradient(
            to right,
            rgba(255,255,255,0.05),
            transparent 35%,
            transparent 75%,
            rgba(255,255,255,0.04)
          )
        `,
        pointerEvents: 'none'
      }} />

      <div style={{
        fontSize: '9px',
        color: 'var(--text-muted)',
        fontWeight: 700,
        letterSpacing: '2.4px',
        marginBottom: '10px'
      }}>
        {title}
      </div>

      <div style={{
        fontSize: '30px',
        fontWeight: 900,
        color: finalColor,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '-0.5px',
        fontVariantNumeric: 'tabular-nums',
        textShadow: `0 0 12px ${finalColor}25`
      }}>
        {value}
      </div>

    </div>
  );
}

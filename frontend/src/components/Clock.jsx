import { useState, useEffect } from 'react'

export default function Clock() {
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString())

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{
      fontSize: '11px',
      color: 'var(--text-muted)',
      fontFamily: 'var(--font-mono)',
      fontWeight: '600'
    }}>
      {currentTime}
    </div>
  )
}
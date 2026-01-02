import { useState } from 'react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import PortfolioView from './PortfolioView'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('single')

  return (
    <div style={{ 
      width: '100vw', 
      minHeight: '100vh', 
      backgroundColor: '#000000',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Bloomberg Terminal Header */}
      <header style={{ 
        background: 'linear-gradient(90deg, #000000 0%, #1a1a1a 50%, #000000 100%)',
        borderBottom: '3px solid #ff8c00',
        padding: '20px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 20px rgba(255, 140, 0, 0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '8px',
            height: '40px',
            background: 'linear-gradient(180deg, #ff8c00 0%, #ffa500 100%)',
            boxShadow: '0 0 15px rgba(255, 140, 0, 0.8)'
          }}></div>
          <div>
            <h1 style={{ 
              margin: 0, 
              fontSize: '28px', 
              fontWeight: '900',
              color: '#ff8c00',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              fontFamily: 'Consolas, monospace',
              textShadow: '0 0 10px rgba(255, 140, 0, 0.5)'
            }}>
              BLOOMBERG TERMINAL
            </h1>
            <p style={{ 
              margin: '5px 0 0 0', 
              color: '#888',
              fontSize: '11px', 
              letterSpacing: '3px',
              fontWeight: '600',
              textTransform: 'uppercase'
            }}>
              Quantitative Portfolio Analytics
            </p>
          </div>
        </div>
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <div style={{
            padding: '8px 16px',
            background: 'rgba(255, 140, 0, 0.1)',
            border: '1px solid #ff8c00',
            color: '#ff8c00',
            fontSize: '10px',
            fontWeight: '700',
            letterSpacing: '2px'
          }}>
            LIVE
          </div>
          <div style={{ 
            fontSize: '10px', 
            color: '#555',
            fontFamily: 'Consolas, monospace',
            letterSpacing: '1px'
          }}>
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div style={{ 
        display: 'flex', 
        backgroundColor: '#0a0a0a',
        borderBottom: '2px solid #222',
        padding: '0 40px'
      }}>
        {[
          { id: 'single', label: 'SINGLE ASSET' },
          { id: 'portfolio', label: 'PORTFOLIO' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '18px 35px',
              border: 'none',
              backgroundColor: activeTab === tab.id ? '#1a1a1a' : 'transparent',
              color: activeTab === tab.id ? '#ff8c00' : '#555',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '800',
              borderBottom: activeTab === tab.id ? '3px solid #ff8c00' : '3px solid transparent',
              transition: 'all 0.3s',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              fontFamily: 'Consolas, monospace',
              position: 'relative'
            }}
          >
            {activeTab === tab.id && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: 'linear-gradient(90deg, transparent, #ff8c00, transparent)'
              }}></div>
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content - Full Width */}
      <div style={{ flex: 1, width: '100%', overflowY: 'auto' }}>
        {activeTab === 'single' ? <SingleAssetView /> : <PortfolioView />}
      </div>

      {/* Footer */}
      <footer style={{
        padding: '15px 40px',
        backgroundColor: '#0a0a0a',
        borderTop: '1px solid #222',
        color: '#555',
        fontSize: '10px',
        textAlign: 'center',
        letterSpacing: '1px'
      }}>
        BLOOMBERG TERMINAL © 2026 | QUANT B - PORTFOLIO ANALYSIS MODULE
      </footer>
    </div>
  )
}

// Single Asset View
function SingleAssetView() {
  const [ticker, setTicker] = useState('AAPL')
  const [data, setData] = useState([])
  const [metrics, setMetrics] = useState(null)
  
  const fetchData = async () => {
    try {
      const response = await axios.get(`http://127.0.0.1:8001/api/backtest/sma/${ticker}`)      
      setData(response.data.data)      
      setMetrics(response.data.metrics)
    } catch (error) {
      console.error("Error:", error)
      alert('CONNECTION ERROR')
    }
  }

  return (
    <div style={{ padding: '40px', width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Section Header */}
      <div style={{ marginBottom: '35px', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{
          width: '5px',
          height: '30px',
          background: '#ff8c00',
          boxShadow: '0 0 10px rgba(255, 140, 0, 0.5)'
        }}></div>
        <h2 style={{ 
          fontSize: '20px', 
          fontWeight: '900', 
          color: '#ff8c00',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          margin: 0
        }}>
          SINGLE ASSET ANALYSIS
        </h2>
      </div>
      
      {/* Controls */}
      <div className="controls" style={{ display: 'flex', gap: '15px', marginBottom: '35px', flexWrap: 'wrap' }}>
        <input 
          value={ticker} 
          onChange={(e) => setTicker(e.target.value.toUpperCase())} 
          placeholder="TICKER"
          style={{ minWidth: '200px' }}
        />
        <button onClick={fetchData}>
          EXECUTE
        </button>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid-container" style={{ marginBottom: '35px' }}>
          <MetricCard title="TOTAL RETURN" value={metrics["Total Return"]} color="#00ff88" />
          <MetricCard title="SHARPE RATIO" value={metrics["Sharpe Ratio"]} color="#00d4ff" />
          <MetricCard title="VOLATILITY" value={metrics["Volatility"]} color="#ffa500" />
          <MetricCard title="MAX DRAWDOWN" value={metrics["Max Drawdown"]} color="#ff4444" />
        </div>
      )}

      {/* Chart */}
      {data.length > 0 && (
        <div className="bloomberg-panel" style={{ padding: '30px' }}>
          <h3 style={{ 
            fontSize: '13px', 
            fontWeight: '800', 
            color: '#ff8c00',
            letterSpacing: '2px',
            marginBottom: '25px',
            textTransform: 'uppercase'
          }}>
            CUMULATIVE PERFORMANCE
          </h3>
          <div style={{ width: '100%', height: 450 }}>
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="Date" stroke="#777" />
                <YAxis stroke="#777" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Cumulative_Market" name="BUY & HOLD" stroke="#00d4ff" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="Cumulative_Strategy" name="STRATEGY" stroke="#00ff88" dot={false} strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ title, value, color }) {
  return (
    <div className="metric-card bloomberg-panel" style={{ 
      padding: '25px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '100px',
        height: '100px',
        background: `radial-gradient(circle, ${color}15, transparent)`,
        pointerEvents: 'none'
      }}></div>
      <div style={{ 
        fontSize: '10px', 
        color: '#666', 
        fontWeight: '800', 
        letterSpacing: '2px', 
        marginBottom: '12px',
        textTransform: 'uppercase'
      }}>
        {title}
      </div>
      <div style={{ 
        fontSize: '32px', 
        fontWeight: '900', 
        color: color, 
        fontFamily: 'Consolas, monospace',
        textShadow: `0 0 15px ${color}40`
      }}>
        {value}
      </div>
    </div>
  )
}

export default App

import { useState, useEffect } from 'react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import PortfolioView from './PortfolioView'
import LiveBadge from './LiveBadge'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('strategies')

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
          fontSize: '10px', 
          color: '#555',
          fontFamily: 'Consolas, monospace',
          letterSpacing: '1px'
        }}>
          {new Date().toLocaleTimeString()}
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
          { id: 'strategies', label: 'STRATEGIES' },
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
        {activeTab === 'strategies' && <StrategiesView />}
        {activeTab === 'single' && <SingleAssetView />}
        {activeTab === 'portfolio' && <PortfolioView />}
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
        BLOOMBERG TERMINAL © 2026 | QUANT A & QUANT B - PORTFOLIO ANALYSIS MODULE
      </footer>
    </div>
  )
}

// ========================================
// STRATEGIES VIEW (QUANT A - Advanced)
// ========================================
function StrategiesView() {
  const [ticker, setTicker] = useState('AAPL')
  const [shortWindow, setShortWindow] = useState(20)
  const [longWindow, setLongWindow] = useState(50)
  const [window, setWindow] = useState(20)
  const [threshold, setThreshold] = useState(2.0)
  const [period, setPeriod] = useState('1y')
  const [timeframe, setTimeframe] = useState('daily')
  const [strategy, setStrategy] = useState('SMA')
  const [data, setData] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [error, setError] = useState(null)
  const [isAutoRefresh, setIsAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchData = async () => {
    setError(null)
    
    try {
      let url = ''
      
      if (strategy === 'SMA') {
        url = `http://127.0.0.1:8001/api/backtest/sma/${ticker}?short_window=${shortWindow}&long_window=${longWindow}&period=${period}&timeframe=${timeframe}`
      } else if (strategy === 'MeanReversion') {
        url = `http://127.0.0.1:8001/api/backtest/mean-reversion/${ticker}?window=${window}&threshold=${threshold}&period=${period}&timeframe=${timeframe}`
      }

      const response = await axios.get(url)
      setData(response.data.data)
      setMetrics(response.data.metrics)
      setLastUpdated(new Date().toLocaleTimeString())

    } catch (err) {
      console.error("Fetch error:", err)
      
      if (err.response) {
        const status = err.response.status
        const msg = err.response.data.detail
        
        if (status === 404) setError(`❌ Ticker Not Found: ${msg}`)
        else if (status === 400) setError(`⚠️ Parameter Error: ${msg}`)
        else if (status === 503) setError(`📡 Data Source Error: ${msg}`)
        else setError(`Server Error (${status}): ${msg}`)
      } else if (err.request) {
        setError("🔌 Cannot connect to Backend. Ensure Python is running.")
      } else {
        setError("An unexpected error occurred.")
      }
    }
  }

  useEffect(() => {
    let interval = null
    if (isAutoRefresh) {
      interval = setInterval(() => {
        if (!error) {
          console.log("🔄 Auto-refresh triggered...")
          fetchData()
        }
      }, 300000) // 5 minutes
    }
    return () => { if (interval) clearInterval(interval) }
  }, [isAutoRefresh, error, ticker, strategy, shortWindow, longWindow, window, threshold, period, timeframe])

  return (
    <div style={{ padding: '40px', width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header with LiveBadge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ marginBottom: '35px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{
            width: '5px',
            height: '30px',
            background: '#ff8c00',
            boxShadow: '0 0 10px rgba(255, 140, 0, 0.5)'
          }}></div>
          <div>
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: '900', 
              color: '#ff8c00',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              margin: 0
            }}>
              ADVANCED STRATEGIES
            </h2>
            {lastUpdated && (
              <div style={{ fontSize: '10px', color: '#666', marginTop: '5px' }}>
                Last Updated: {lastUpdated}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button 
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            style={{ 
              background: 'rgba(255, 140, 0, 0.1)', 
              border: '1px solid #ff8c00', 
              color: '#ff8c00',
              borderRadius: '4px', 
              cursor: 'pointer', 
              padding: '8px 16px', 
              fontSize: '10px',
              fontWeight: '700',
              letterSpacing: '1px'
            }}
          >
            {isAutoRefresh ? '⏸️ PAUSE' : '▶️ RESUME'}
          </button>
          <LiveBadge ticker={ticker} />
        </div>
      </div>

      {/* Controls */}
      <div className="controls" style={{ display: 'flex', gap: '15px', marginBottom: '35px', flexWrap: 'wrap' }}>
        <select value={strategy} onChange={(e) => setStrategy(e.target.value)} style={{ minWidth: '150px' }}>
          <option value="SMA">SMA CROSSOVER</option>
          <option value="MeanReversion">MEAN REVERSION</option>
        </select>

        <input 
          value={ticker} 
          onChange={(e) => setTicker(e.target.value.toUpperCase())} 
          placeholder="TICKER"
          style={{ minWidth: '150px' }}
        />

        {strategy === 'SMA' ? (
          <>
            <input type="number" value={shortWindow} onChange={(e) => setShortWindow(e.target.value)} placeholder="SHORT" style={{ width: '80px' }} />
            <input type="number" value={longWindow} onChange={(e) => setLongWindow(e.target.value)} placeholder="LONG" style={{ width: '80px' }} />
          </>
        ) : (
          <>
            <input type="number" value={window} onChange={(e) => setWindow(e.target.value)} placeholder="WINDOW" style={{ width: '80px' }} />
            <input type="number" step="0.1" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="Z-SCORE" style={{ width: '80px' }} />
          </>
        )}

        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="1mo">1 MONTH</option>
          <option value="6mo">6 MONTHS</option>
          <option value="1y">1 YEAR</option>
          <option value="2y">2 YEARS</option>
          <option value="5y">5 YEARS</option>
        </select>

        <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
          <option value="daily">DAILY</option>
          <option value="weekly">WEEKLY</option>
          <option value="monthly">MONTHLY</option>
        </select>

        <button onClick={fetchData}>EXECUTE</button>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{ padding: '15px', marginBottom: '20px', backgroundColor: '#331111', color: '#ff4444', border: '1px solid #ff4444', borderRadius: '4px' }}>
          {error}
        </div>
      )}

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
                <Line type="monotone" dataKey="Cumulative_Strategy" name={`STRATEGY (${strategy})`} stroke="#00ff88" dot={false} strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

// ========================================
// SINGLE ASSET VIEW (QUANT B - Simple SMA)
// ========================================
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
      
      <div className="controls" style={{ display: 'flex', gap: '15px', marginBottom: '35px', flexWrap: 'wrap' }}>
        <input 
          value={ticker} 
          onChange={(e) => setTicker(e.target.value.toUpperCase())} 
          placeholder="TICKER"
          style={{ minWidth: '200px' }}
        />
        <button onClick={fetchData}>EXECUTE</button>
      </div>

      {metrics && (
        <div className="grid-container" style={{ marginBottom: '35px' }}>
          <MetricCard title="TOTAL RETURN" value={metrics["Total Return"]} color="#00ff88" />
          <MetricCard title="SHARPE RATIO" value={metrics["Sharpe Ratio"]} color="#00d4ff" />
          <MetricCard title="VOLATILITY" value={metrics["Volatility"]} color="#ffa500" />
          <MetricCard title="MAX DRAWDOWN" value={metrics["Max Drawdown"]} color="#ff4444" />
        </div>
      )}

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

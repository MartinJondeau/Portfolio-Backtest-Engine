import { useState, useEffect } from 'react'
import axios from 'axios'
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts'
import PortfolioView from './PortfolioView'
import LiveBadge from './LiveBadge'
import './App.css'

function App() {
  // CHANGED: Default tab is now 'single'
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
        {/* RIGHT SIDE: Button & Time */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* 1. INSERT THE BUTTON HERE */}
          <DownloadReportButton />
          <div style={{ 
            fontSize: '10px', 
            color: '#555',
            fontFamily: 'Consolas, monospace',
            letterSpacing: '1px',
            borderLeft: '1px solid #333', // Little separator line
            paddingLeft: '15px'
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
          { id: 'single', label: 'ASSET VIEW' }, 
          { id: 'strategies', label: 'STRATEGY BACKTEST' },
          { id: 'portfolio', label: 'PORTFOLIO MANAGEMENT' }
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
      <div style={{ flex: 1, width: '100%', overflowY: 'auto', position: 'relative' }}>
        
        {/* 1. MARKET OVERVIEW (Always mounted, hidden if inactive) */}
        <div style={{ display: activeTab === 'single' ? 'block' : 'none', height: '100%' }}>
          <SingleAssetView />
        </div>

        {/* 2. STRATEGIES (Always mounted, hidden if inactive) */}
        <div style={{ display: activeTab === 'strategies' ? 'block' : 'none', height: '100%' }}>
          <StrategiesView />
        </div>

        {/* 3. PORTFOLIO (Always mounted, hidden if inactive) */}
        <div style={{ display: activeTab === 'portfolio' ? 'block' : 'none', height: '100%' }}>
          <PortfolioView />
        </div>

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
        © 2026 | ADRIEN BAYRE & MARTIN JONDEAU - PORTFOLIO BACKTEST ENGINE
      </footer>
    </div>
  )
}

// ========================================
// 1. WATCHLIST / MARKET OVERVIEW (Ordered & Color-Locked)
// ========================================
function SingleAssetView() {
  // Neon Color Palette
  const colors = ['#ff8c00', '#00ff88', '#00d4ff', '#ff4444', '#d264ff', '#ffff00']

  // STATE: Now stores objects { symbol: 'AAPL', color: '...' } to lock colors
  const [watchlist, setWatchlist] = useState([
    { symbol: 'AAPL', color: colors[0] },
    { symbol: 'NVDA', color: colors[1] },
    { symbol: 'BTC-USD', color: colors[2] },
    { symbol: 'SPY', color: colors[3] }
  ])
  
  const [period, setPeriod] = useState('1y')
  const [newTicker, setNewTicker] = useState('')
  const [assetsData, setAssetsData] = useState({})
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  // --- FETCHING LOGIC ---
  const fetchAllAssets = async () => {
    if (Object.keys(assetsData).length === 0) setLoading(true)
    
    const newData = { ...assetsData }

    // Loop through the objects in the watchlist
    for (const item of watchlist) {
      const ticker = item.symbol
      try {
        const response = await axios.get(`http://127.0.0.1:8001/api/asset/${ticker}?period=${period}`)
        const rawData = response.data
        
        const prices = rawData.map(d => d.Close)
        const last = prices[prices.length - 1]
        const first = prices[0]
        const change = ((last - first) / first) * 100
        
        newData[ticker] = {
          data: rawData,
          stats: {
            last: last.toFixed(2),
            high: Math.max(...prices).toFixed(2),
            low: Math.min(...prices).toFixed(2),
            change: change.toFixed(2),
            isPositive: change >= 0
          }
        }
        
        setAssetsData({ ...newData })
        await new Promise(r => setTimeout(r, 200)); 

      } catch (err) {
        console.error(`Failed to fetch ${ticker}`, err)
      }
    }

    setLastUpdated(new Date().toLocaleTimeString())
    setLoading(false)
  }

  // --- AUTO-REFRESH ---
  useEffect(() => {
    fetchAllAssets();
    const interval = setInterval(() => fetchAllAssets(), 300000); 
    return () => clearInterval(interval);
  }, [period, watchlist]);

  // --- ADD TICKER (PREPEND + ASSIGN COLOR) ---
  const handleAddTicker = () => {
    const upperTicker = newTicker.toUpperCase().trim()
    
    // Check for duplicates
    if (upperTicker && !watchlist.some(item => item.symbol === upperTicker)) {
      
      // 1. Pick the next color in the cycle based on current length
      const nextColor = colors[watchlist.length % colors.length]
      
      // 2. Create the new object
      const newItem = { symbol: upperTicker, color: nextColor }
      
      // 3. PREPEND: Add to the START of the array
      setWatchlist([newItem, ...watchlist])
      
      setNewTicker('')
    }
  }

  const handleRemoveTicker = (tickerToRemove) => {
    setWatchlist(watchlist.filter(t => t.symbol !== tickerToRemove))
    const newData = { ...assetsData }
    delete newData[tickerToRemove]
    setAssetsData(newData)
  }

  return (
    <div style={{ padding: '40px', width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
      
      {/* --- TOP: PARAMETERS --- */}
      <div style={{ 
        background: '#1a1a1a', padding: '20px', borderRadius: '8px', marginBottom: '30px',
        border: '1px solid #333', display: 'flex', flexWrap: 'wrap', gap: '20px',
        alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#ff8c00', fontSize: '14px', textTransform: 'uppercase' }}>Watchlist:</h3>
          <input 
            value={newTicker} 
            onChange={(e) => setNewTicker(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleAddTicker()}
            placeholder="ADD TICKER..."
            style={{ background: '#000', border: '1px solid #555', color: 'white', padding: '8px', borderRadius: '4px', outline: 'none', width: '120px' }}
          />
          <button onClick={handleAddTicker} style={{ cursor: 'pointer', background: '#333', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', fontWeight: 'bold' }}>+</button>
        </div>

        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
           <span style={{ color: '#888', fontSize: '12px', marginRight: '5px' }}>PERIOD:</span>
           {['1mo', '3mo', '6mo', '1y', '2y', '5y'].map(p => (
             <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  background: period === p ? '#ff8c00' : 'transparent',
                  color: period === p ? 'black' : '#888',
                  border: period === p ? 'none' : '1px solid #444',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase'
                }}
             >
               {p}
             </button>
           ))}
           <div style={{ marginLeft: '15px', fontSize: '10px', color: '#666', textAlign: 'right' }}>
              {loading ? <span style={{color: '#ff8c00'}}>UPDATING...</span> : <span>UPDATED: {lastUpdated}</span>}
           </div>
        </div>
      </div>

      {/* --- BOTTOM: 2-COLUMN GRID --- */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(600px, 1fr))', 
        gap: '25px' 
      }}>
        {watchlist.map((item) => {
          // Destructure object: symbol and fixed color
          const ticker = item.symbol
          const color = item.color 
          
          const asset = assetsData[ticker]
          
          if (!asset) return null 

          return (
            <div key={ticker} className="bloomberg-panel" style={{ 
              background: '#111', border: '1px solid #333', borderRadius: '6px',
              position: 'relative', overflow: 'hidden'
            }}>
              {/* Header with Fixed Color */}
              <div style={{ 
                padding: '15px 20px', borderBottom: '1px solid #222', 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: `linear-gradient(90deg, ${color}10, transparent)` 
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ margin: 0, color: color, fontSize: '22px', fontWeight: '900' }}>{ticker}</h3>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: asset.stats.isPositive ? '#00ff88' : '#ff4444' }}>
                      {asset.stats.isPositive ? '▲' : '▼'} {asset.stats.change}%
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    LAST PRICE: <span style={{ color: '#eee', fontWeight: 'bold' }}>${asset.stats.last}</span>
                  </div>
                </div>
                
                <div style={{ textAlign: 'right', fontSize: '11px', color: '#888' }}>
                  <div>HIGH: <span style={{ color: '#eee' }}>${asset.stats.high}</span></div>
                  <div style={{ marginTop: '2px' }}>LOW: <span style={{ color: '#eee' }}>${asset.stats.low}</span></div>
                  <button onClick={() => handleRemoveTicker(ticker)} style={{ marginTop: '5px', background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '10px', textDecoration: 'underline' }}>
                    REMOVE
                  </button>
                </div>
              </div>

              {/* Chart */}
              <div style={{ height: '300px', width: '100%', padding: '10px' }}>
                <ResponsiveContainer>
                  <AreaChart data={asset.data}>
                    <defs>
                      <linearGradient id={`grad${ticker}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={color} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                    <XAxis dataKey="Date" hide={true} />
                    <YAxis domain={['auto', 'auto']} hide={false} orientation="right" tick={{fill: '#444', fontSize: 10}} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#000', border: `1px solid ${color}` }} itemStyle={{ color: color }} labelStyle={{ color: '#888' }} formatter={(val) => [`$${val.toFixed(2)}`, 'Price']} labelFormatter={(label) => new Date(label).toLocaleDateString()} />
                    <Area type="monotone" dataKey="Close" stroke={color} strokeWidth={2} fill={`url(#grad${ticker})`} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ========================================
// 2. STRATEGIES VIEW (Quant A - Advanced)
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
          console.log("Auto-refresh triggered...")
          fetchData()
        }
      }, 300000) // 5 minutes
    }
    return () => { if (interval) clearInterval(interval) }
  }, [isAutoRefresh, error, ticker, strategy, shortWindow, longWindow, window, threshold, period, timeframe])

  return (
    <div style={{ padding: '40px', width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ marginBottom: '35px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '5px', height: '30px', background: '#ff8c00', boxShadow: '0 0 10px rgba(255, 140, 0, 0.5)' }}></div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#ff8c00', letterSpacing: '3px', textTransform: 'uppercase', margin: 0 }}>
              ADVANCED STRATEGIES
            </h2>
            {lastUpdated && <div style={{ fontSize: '10px', color: '#666', marginTop: '5px' }}>Last Updated: {lastUpdated}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => setIsAutoRefresh(!isAutoRefresh)} style={{ background: 'rgba(255, 140, 0, 0.1)', border: '1px solid #ff8c00', color: '#ff8c00', borderRadius: '4px', cursor: 'pointer', padding: '8px 16px', fontSize: '10px', fontWeight: '700', letterSpacing: '1px' }}>
            {isAutoRefresh ? 'PAUSE' : 'RESUME'}
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

        <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="TICKER" style={{ minWidth: '150px' }} />

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

      {error && <div style={{ padding: '15px', marginBottom: '20px', backgroundColor: '#331111', color: '#ff4444', border: '1px solid #ff4444', borderRadius: '4px' }}>{error}</div>}

      {/* Strategy Metrics */}
      {metrics && (
        <div className="grid-container" style={{ marginBottom: '35px' }}>
          <StrategyMetricCard title="TOTAL RETURN" value={metrics["Total Return"]} color="#00ff88" />
          <StrategyMetricCard title="SHARPE RATIO" value={metrics["Sharpe Ratio"]} color="#00d4ff" />
          <StrategyMetricCard title="VOLATILITY" value={metrics["Volatility"]} color="#ffa500" />
          <StrategyMetricCard title="MAX DRAWDOWN" value={metrics["Max Drawdown"]} color="#ff4444" />
        </div>
      )}

      {/* Strategy Chart */}
      {data.length > 0 && (
        <div className="bloomberg-panel" style={{ padding: '30px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#ff8c00', letterSpacing: '2px', marginBottom: '25px', textTransform: 'uppercase' }}>
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

// Renamed Global Metric Card for Strategies to distinguish from MarketStatCard
function StrategyMetricCard({ title, value, color }) {
  return (
    <div className="metric-card bloomberg-panel" style={{ padding: '25px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: `radial-gradient(circle, ${color}15, transparent)`, pointerEvents: 'none' }}></div>
      <div style={{ fontSize: '10px', color: '#666', fontWeight: '800', letterSpacing: '2px', marginBottom: '12px', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ fontSize: '32px', fontWeight: '900', color: color, fontFamily: 'Consolas, monospace', textShadow: `0 0 15px ${color}40` }}>{value}</div>
    </div>
  )
}
// ========================================
// 3. DOWNLOAD BUTTON COMPONENT
// ========================================
function DownloadReportButton() {
  const handleDownload = async () => {
    try {
      const response = await axios.get('/api/reports/latest');
      
      const jsonData = JSON.stringify(response.data, null, 4);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      const fileName = response.data.date 
        ? `${response.data.date}_daily_report.json` 
        : 'daily_report.json';
        
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error("Download failed:", err);
      alert("No report found. Please wait for the daily generation.");
    }
  }

  return (
    <button 
      onClick={handleDownload}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '6px 12px',
        marginRight: '15px', // Spacing between button and time
        background: 'rgba(255, 140, 0, 0.1)', 
        color: '#ff8c00',
        border: '1px solid #ff8c00', borderRadius: '4px',
        cursor: 'pointer', fontSize: '10px', fontWeight: 'bold',
        textTransform: 'uppercase', letterSpacing: '1px',
        transition: 'all 0.2s',
        height: '30px'
      }}
      onMouseOver={(e) => e.target.style.background = 'rgba(255, 140, 0, 0.2)'}
      onMouseOut={(e) => e.target.style.background = 'rgba(255, 140, 0, 0.1)'}
    >
      <span></span> REPORT
    </button>
  )
}
export default App
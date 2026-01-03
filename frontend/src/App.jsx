import { useState, useEffect } from 'react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import LiveBadge from './LiveBadge' 
import './App.css'

function App() {
  // --- STATE VARIABLES ---
  const [ticker, setTicker] = useState('AAPL')
  
  // SMA Strategy Parameters
  const [shortWindow, setShortWindow] = useState(20)
  const [longWindow, setLongWindow] = useState(50)
  
  // Mean Reversion Parameters
  const [window, setWindow] = useState(20)
  const [threshold, setThreshold] = useState(2.0)
  
  // Global Parameters
  const [period, setPeriod] = useState('1y')
  const [timeframe, setTimeframe] = useState('daily')
  const [strategy, setStrategy] = useState('SMA')
  
  // Data & Errors
  const [data, setData] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [error, setError] = useState(null)
  
  // Navigation
  const [activeTab, setActiveTab] = useState('strategy')

  // --- NEW: Auto-Refresh State ---
  const [isAutoRefresh, setIsAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  // --- DATA FETCHING FUNCTION ---
  const fetchData = async () => {
    // Reset UI Errors
    setError(null);
    // Note: We don't clear 'data' here to prevent flickering during auto-refresh
    
    try {
      let url = '';
      
      // Dynamic URL Construction
      if (strategy === 'SMA') {
        url = `http://127.0.0.1:8001/api/backtest/sma/${ticker}?short_window=${shortWindow}&long_window=${longWindow}&period=${period}&timeframe=${timeframe}`;
      } else if (strategy === 'MeanReversion') {
        url = `http://127.0.0.1:8001/api/backtest/mean-reversion/${ticker}?window=${window}&threshold=${threshold}&period=${period}&timeframe=${timeframe}`;
      }

      const response = await axios.get(url);
      
      // Success
      setData(response.data.data);
      setMetrics(response.data.metrics);
      setLastUpdated(new Date().toLocaleTimeString()); // Update timestamp

    } catch (err) {
      console.error("Fetch error:", err);
      
      // Robust Error Handling
      if (err.response) {
        const status = err.response.status;
        const msg = err.response.data.detail;
        
        if (status === 404) setError(`❌ Ticker Not Found: ${msg}`);
        else if (status === 400) setError(`⚠️ Parameter Error: ${msg}`);
        else if (status === 503) setError(`📡 Data Source Error: ${msg}`);
        else setError(`Server Error (${status}): ${msg}`);
      } else if (err.request) {
        setError("🔌 Cannot connect to Backend. Ensure Python is running.");
      } else {
        setError("An unexpected error occurred.");
      }
    }
  }

  // --- EFFECT: Auto-Refresh Timer ---
  useEffect(() => {
    let interval = null;
    if (isAutoRefresh) {
      // 300000 ms = 5 minutes
      interval = setInterval(() => {
        if (!error) { // Don't refresh if there is a blocking error (e.g. invalid ticker)
             console.log("🔄 Auto-refresh triggered...");
             fetchData();
        }
      }, 300000); 
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isAutoRefresh, error, ticker, strategy, shortWindow, longWindow, window, threshold, period, timeframe]);


  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      
      {/* 1. Header & Live Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
            <h1 style={{ margin: 0 }}>Quant Dashboard</h1>
            {/* Last Updated Indicator */}
            <div style={{ fontSize: '12px', color: '#888', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                {lastUpdated && <span>Last Updated: {lastUpdated}</span>}
                <button 
                    onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                    style={{ 
                        background: 'none', border: '1px solid #555', color: '#aaa', 
                        borderRadius: '4px', cursor: 'pointer', padding: '2px 8px', fontSize: '10px'
                    }}
                >
                    {isAutoRefresh ? '⏸️ Pause Auto-Refresh' : '▶️ Resume Auto-Refresh'}
                </button>
            </div>
        </div>
        <LiveBadge ticker={ticker} />
      </div>
      
      {/* 2. Control Panel */}
      <div className="controls" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px', padding: '20px', background: '#1e1e1e', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
        
        {/* Strategy Selector */}
        <ControlGroup label="Strategy">
            <select value={strategy} onChange={(e) => setStrategy(e.target.value)} style={inputStyle}>
                <option value="SMA">SMA Crossover</option>
                <option value="MeanReversion">Mean Reversion</option>
            </select>
        </ControlGroup>

        <ControlGroup label="Ticker">
            <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="AAPL" style={inputStyle} />
        </ControlGroup>

        {/* Conditional Inputs */}
        {strategy === 'SMA' ? (
            <>
                <ControlGroup label="Short Window">
                    <input type="number" value={shortWindow} onChange={(e) => setShortWindow(e.target.value)} style={{...inputStyle, width: '60px'}} />
                </ControlGroup>
                <ControlGroup label="Long Window">
                    <input type="number" value={longWindow} onChange={(e) => setLongWindow(e.target.value)} style={{...inputStyle, width: '60px'}} />
                </ControlGroup>
            </>
        ) : (
            <>
                <ControlGroup label="Window">
                    <input type="number" value={window} onChange={(e) => setWindow(e.target.value)} style={{...inputStyle, width: '60px'}} />
                </ControlGroup>
                <ControlGroup label="Z-Threshold">
                    <input type="number" step="0.1" value={threshold} onChange={(e) => setThreshold(e.target.value)} style={{...inputStyle, width: '60px'}} />
                </ControlGroup>
            </>
        )}

        <ControlGroup label="Period">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} style={inputStyle}>
                <option value="1mo">1 Month</option>
                <option value="6mo">6 Months</option>
                <option value="1y">1 Year</option>
                <option value="2y">2 Years</option>
                <option value="5y">5 Years</option>
            </select>
        </ControlGroup>

        <ControlGroup label="Timeframe">
            <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} style={inputStyle}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
            </select>
        </ControlGroup>

        <button onClick={fetchData} style={{ marginLeft: 'auto', background: '#2196F3', color: 'white', border: 'none', padding: '10px 25px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          Run Backtest
        </button>
      </div>

      {/* 3. Error Banner */}
      {error && (
        <div style={{ padding: '15px', marginBottom: '20px', backgroundColor: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: '8px', fontWeight: 'bold' }}>
            {error}
        </div>
      )}

      {/* 4. Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #444', marginBottom: '20px' }}>
        <TabButton label="Strategy Performance" isActive={activeTab === 'strategy'} onClick={() => setActiveTab('strategy')} />
        <TabButton label="Asset Analysis" isActive={activeTab === 'asset'} onClick={() => setActiveTab('asset')} />
      </div>

      {/* 5. Main Content Area */}
      {activeTab === 'strategy' ? (
        <>
          {metrics && (
            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
              <MetricCard title="Total Return" value={metrics["Total Return"]} color="#4CAF50" />
              <MetricCard title="Sharpe Ratio" value={metrics["Sharpe Ratio"]} color="#2196F3" />
              <MetricCard title="Volatility" value={metrics["Volatility"]} color="#FF9800" />
              <MetricCard title="Max Drawdown" value={metrics["Max Drawdown"]} color="#F44336" />
            </div>
          )}
          
          <div style={{ width: '100%', height: 400, background: '#1e1e1e', padding: '20px', borderRadius: '12px' }}>
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="Date" stroke="#888" tick={{fontSize: 12}} />
                <YAxis domain={['auto', 'auto']} stroke="#888" tick={{fontSize: 12}} />
                <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none', color: '#fff' }} />
                <Legend />
                <Line type="monotone" dataKey="Cumulative_Market" name="Buy & Hold" stroke="#8884d8" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="Cumulative_Strategy" name={`Strategy (${strategy})`} stroke="#82ca9d" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div style={{ height: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1e1e1e', borderRadius: '12px', color: '#888' }}>
            <h3>Price History</h3>
            <p>Switch to "Strategy Performance" to view backtest results.</p>
        </div>
      )}

    </div>
  )
}

// --- SUB-COMPONENTS (Styles & UI) ---

const inputStyle = {
    padding: '8px', borderRadius: '4px', border: '1px solid #555', 
    background: '#333', color: 'white', outline: 'none'
};

function ControlGroup({ label, children }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</label>
            {children}
        </div>
    )
}

function MetricCard({ title, value, color }) {
  return (
    <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: '#1e1e1e', borderLeft: `5px solid ${color}`, flex: '1', minWidth: '150px', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
      <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>{title}</div>
      <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'white' }}>{value}</div>
    </div>
  )
}

function TabButton({ label, isActive, onClick }) {
    return (
        <button onClick={onClick} style={{ background: 'transparent', border: 'none', borderBottom: isActive ? '3px solid #2196F3' : '3px solid transparent', color: isActive ? 'white' : '#888', padding: '12px 25px', cursor: 'pointer', fontSize: '16px', fontWeight: isActive ? 'bold' : 'normal', transition: 'all 0.3s' }}>
            {label}
        </button>
    )
}

export default App
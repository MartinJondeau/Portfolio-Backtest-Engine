// frontend/src/App.jsx
import { useState } from 'react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import LiveBadge from './LiveBadge' // Import the new component
import './App.css'

function App() {
  const [ticker, setTicker] = useState('AAPL')
  const [shortWindow, setShortWindow] = useState(20)
  const [longWindow, setLongWindow] = useState(50)
  const [data, setData] = useState([])
  const [metrics, setMetrics] = useState(null)
  
  // NEW: Tab State ('strategy' or 'asset')
  const [activeTab, setActiveTab] = useState('strategy')
  const [period, setPeriod] = useState('1y');     
  const [timeframe, setTimeframe] = useState('daily'); 
  const fetchData = async () => {
    try {
      // Updated URL with new parameters
      const response = await axios.get(`http://127.0.0.1:8001/api/backtest/sma/${ticker}?short_window=${shortWindow}&long_window=${longWindow}&period=${period}&timeframe=${timeframe}`)

      setData(response.data.data)
      setMetrics(response.data.metrics)
    } catch (error) {
      // NEW: Better error handling for our validation messages
      if (error.response && error.response.status === 400) {
          alert(error.response.data.detail); // Show the specific Python error
      } else {
          console.error("Error fetching data:", error);
      }
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      
      {/* 1. Header Section with Live Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ margin: 0 }}>Quant Dashboard</h1>
        {/* Pass the current ticker to the badge so it updates automatically */}
        <LiveBadge ticker={ticker} />
      </div>
      
      {/* 2. Controls Section */}
      <div className="controls" style={{ display: 'flex', gap: '10px', marginBottom: '20px', padding: '15px', background: '#2a2a2a', borderRadius: '8px' }}>
        <input 
          value={ticker} 
          onChange={(e) => setTicker(e.target.value)} 
          placeholder="Ticker (e.g. AAPL)" 
          style={{ padding: '8px', borderRadius: '4px', border: 'none' }}
        />
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', color: 'white' }}>
          <span style={{ fontSize: '12px' }}>Short:</span>
          <input 
            type="number" 
            value={shortWindow} 
            onChange={(e) => setShortWindow(e.target.value)} 
            style={{ width: '50px', padding: '8px', borderRadius: '4px', border: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', color: 'white' }}>
          <span style={{ fontSize: '12px' }}>Long:</span>
          <input 
            type="number" 
            value={longWindow} 
            onChange={(e) => setLongWindow(e.target.value)} 
            style={{ width: '50px', padding: '8px', borderRadius: '4px', border: 'none' }}
          />
        </div>
        {/* NEW: Period Selector */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '10px', color: '#ccc' }}>Period</label>
            <select 
                value={period} 
                onChange={(e) => setPeriod(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: 'none' }}
            >
                <option value="1mo">1 Month</option>
                <option value="6mo">6 Months</option>
                <option value="1y">1 Year</option>
                <option value="2y">2 Years</option>
                <option value="5y">5 Years</option>
            </select>
        </div>

        {/* NEW: Timeframe Selector */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '10px', color: '#ccc' }}>Timeframe</label>
            <select 
                value={timeframe} 
                onChange={(e) => setTimeframe(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: 'none' }}
            >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
            </select>
        </div>
        <button onClick={fetchData} style={{ marginLeft: 'auto', background: '#2196F3', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer' }}>
          Run Backtest
        </button>
      </div>

      {/* 3. Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid #444', marginBottom: '20px' }}>
        <TabButton 
          label="Strategy Performance" 
          isActive={activeTab === 'strategy'} 
          onClick={() => setActiveTab('strategy')} 
        />
        <TabButton 
          label="Asset Analysis" 
          isActive={activeTab === 'asset'} 
          onClick={() => setActiveTab('asset')} 
        />
      </div>

      {/* 4. Main Content Area */}
      {activeTab === 'strategy' ? (
        // --- STRATEGY VIEW ---
        <>
          {metrics && (
            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
              <MetricCard title="Total Return" value={metrics["Total Return"]} color="#4CAF50" />
              <MetricCard title="Sharpe Ratio" value={metrics["Sharpe Ratio"]} color="#2196F3" />
              <MetricCard title="Volatility" value={metrics["Volatility"]} color="#FF9800" />
              <MetricCard title="Max Drawdown" value={metrics["Max Drawdown"]} color="#F44336" />
            </div>
          )}
          
          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="Date" stroke="#888" />
                <YAxis domain={['auto', 'auto']} stroke="#888" />
                <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} />
                <Legend />
                <Line type="monotone" dataKey="Cumulative_Market" name="Buy & Hold" stroke="#8884d8" dot={false} />
                <Line type="monotone" dataKey="Cumulative_Strategy" name="SMA Strategy" stroke="#82ca9d" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        // --- ASSET VIEW (Placeholder for now) ---
        <div style={{ height: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1e1e1e', borderRadius: '8px', color: '#888' }}>
            <h3>Asset Price History</h3>
            <p>Switch to "Strategy View" to see backtest results.</p>
            <p style={{ fontSize: '12px' }}>(Candlestick charts coming in next update)</p>
        </div>
      )}

    </div>
  )
}

// --- Sub-Components ---

function MetricCard({ title, value, color }) {
  return (
    <div style={{ 
      padding: '15px', 
      borderRadius: '8px', 
      backgroundColor: '#1e1e1e', // Dark mode card
      borderLeft: `5px solid ${color}`,
      minWidth: '130px',
      flex: '1',
      boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
    }}>
      <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '5px' }}>{title}</div>
      <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>{value}</div>
    </div>
  )
}

function TabButton({ label, isActive, onClick }) {
    return (
        <button 
            onClick={onClick}
            style={{
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '3px solid #2196F3' : '3px solid transparent',
                color: isActive ? 'white' : '#888',
                padding: '10px 20px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: isActive ? 'bold' : 'normal',
                transition: 'all 0.3s'
            }}
        >
            {label}
        </button>
    )
}

export default App
import { useState } from 'react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './App.css'

function App() {
  const [ticker, setTicker] = useState('AAPL')
  const [shortWindow, setShortWindow] = useState(20); // New Control
  const [longWindow, setLongWindow] = useState(50); // New Control
  const [data, setData] = useState([])
  const [metrics, setMetrics] = useState(null)
  const fetchData = async () => {
    try {
      // Comm with Python Backend
      const response = await axios.get(`http://127.0.0.1:8001/api/backtest/sma/${ticker}?short_window=${shortWindow}&long_window=${longWindow}`)      
      setData(response.data.data)      
      setMetrics(response.data.metrics)
    } catch (error) {
      console.error("Error fetching data:", error)
    }
  }

  return (
    <div style={{ width: '100%', padding: '20px' }}>
      <h1>Portfolio Backtesting Dashboard</h1>
      
      <div className="controls">
        <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="Ticker" />
        <button onClick={fetchData}>Run Backtest</button>
      </div>
      {metrics && (
        <div style={{ display: 'flex', gap: '20px', marginTop: '20px', justifyContent: 'center' }}>
          <MetricCard title="Total Return" value={metrics["Total Return"]} color="#4CAF50" />
          <MetricCard title="Sharpe Ratio" value={metrics["Sharpe Ratio"]} color="#2196F3" />
          <MetricCard title="Volatility" value={metrics["Volatility"]} color="#FF9800" />
          <MetricCard title="Max Drawdown" value={metrics["Max Drawdown"]} color="#F44336" />
        </div>
      )}
      <div style={{ width: '100%', height: 400, marginTop: '20px' }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="Date" />
            <YAxis domain={['auto', 'auto']} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Cumulative_Market" name="Buy & Hold" stroke="#8884d8" dot={false} />
            <Line type="monotone" dataKey="Cumulative_Strategy" name="SMA Strategy" stroke="#82ca9d" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
function MetricCard({ title, value, color }) {
  return (
    <div style={{ 
      padding: '15px', 
      borderRadius: '8px', 
      backgroundColor: '#f5f5f5', 
      borderLeft: `5px solid ${color}`,
      minWidth: '120px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
    }}>
      <div style={{ fontSize: '12px', color: '#666' }}>{title}</div>
      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>{value}</div>
    </div>
  )
}
export default App
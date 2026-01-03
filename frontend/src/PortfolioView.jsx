import { useState } from 'react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function PortfolioView() {
  const [tickers, setTickers] = useState(['AAPL', 'MSFT', 'GOOGL'])
  const [newTicker, setNewTicker] = useState('')
  const [portfolioData, setPortfolioData] = useState([])
  const [correlation, setCorrelation] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [rebalanceFreq, setRebalanceFreq] = useState('never')

  const addTicker = () => {
    if (newTicker && !tickers.includes(newTicker.toUpperCase())) {
      setTickers([...tickers, newTicker.toUpperCase()])
      setNewTicker('')
    }
  }

  const removeTicker = (tickerToRemove) => {
    if (tickers.length > 3) {
      setTickers(tickers.filter(t => t !== tickerToRemove))
    } else {
      alert('MINIMUM 3 TICKERS REQUIRED')
    }
  }

  const fetchCorrelation = async () => {
    try {
      const response = await axios.post('http://127.0.0.1:8001/api/portfolio/correlation', {
        tickers: tickers,
        period: '1y'
      })
      setCorrelation(response.data)
    } catch (error) {
      console.error('Error:', error)
      alert('CONNECTION ERROR')
    }
  }

  const runBacktest = async () => {
    try {
      const response = await axios.post('http://127.0.0.1:8001/api/portfolio/backtest', {
        tickers: tickers,
        weights: null,
        rebalance_frequency: rebalanceFreq,
        period: '2y'
      })
      setPortfolioData(response.data.portfolio_data)
      setMetrics(response.data.metrics)
    } catch (error) {
      console.error('Error:', error)
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
          PORTFOLIO ANALYSIS
        </h2>
      </div>
      
      {/* Ticker Selection Panel */}
      <div className="bloomberg-panel" style={{ padding: '30px', marginBottom: '30px' }}>
        <h3 style={{ 
          fontSize: '12px', 
          color: '#ff8c00', 
          fontWeight: '800', 
          letterSpacing: '2px', 
          marginBottom: '20px',
          textTransform: 'uppercase'
        }}>
          ASSET SELECTION (MIN 3)
        </h3>
        
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <input 
            value={newTicker} 
            onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
            placeholder="TICKER"
            onKeyPress={(e) => e.key === 'Enter' && addTicker()}
            className="controls"
            style={{ flex: 1, minWidth: '200px' }}
          />
          <button onClick={addTicker} className="controls">
            ADD ASSET
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {tickers.map(ticker => (
            <div key={ticker} className="ticker-tag" style={{ 
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontFamily: 'Consolas, monospace',
              fontSize: '13px',
              fontWeight: '800',
              position: 'relative'
            }}>
              <span>{ticker}</span>
              <button 
                onClick={() => removeTicker(ticker)}
                style={{ 
                  background: 'none',
                  border: 'none',
                  color: '#ff4444',
                  cursor: 'pointer',
                  fontSize: '20px',
                  lineHeight: '1',
                  padding: 0,
                  transition: 'color 0.3s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ff0000'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#ff4444'}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '35px', flexWrap: 'wrap' }}>
        <select 
          value={rebalanceFreq} 
          onChange={(e) => setRebalanceFreq(e.target.value)}
          className="controls"
        >
          <option value="never">NO REBALANCING</option>
          <option value="monthly">MONTHLY</option>
          <option value="quarterly">QUARTERLY</option>
          <option value="yearly">YEARLY</option>
        </select>
        
        <button onClick={fetchCorrelation} className="controls">
          CORRELATION
        </button>
        
        <button onClick={runBacktest} className="controls">
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

      {/* Correlation Matrix */}
      {correlation && (
        <div className="bloomberg-panel" style={{ padding: '30px', marginBottom: '35px' }}>
          <h3 style={{ 
            fontSize: '13px', 
            fontWeight: '800', 
            color: '#ff8c00',
            letterSpacing: '2px',
            marginBottom: '25px',
            textTransform: 'uppercase'
          }}>
            CORRELATION MATRIX
          </h3>
          <CorrelationMatrix data={correlation.correlation_matrix} tickers={correlation.tickers} />
        </div>
      )}

      {/* Chart */}
      {portfolioData.length > 0 && (
        <div className="bloomberg-panel" style={{ padding: '30px' }}>
          <h3 style={{ 
            fontSize: '13px', 
            fontWeight: '800', 
            color: '#ff8c00',
            letterSpacing: '2px',
            marginBottom: '25px',
            textTransform: 'uppercase'
          }}>
            PORTFOLIO CUMULATIVE PERFORMANCE
          </h3>
          <div style={{ width: '100%', height: 450 }}>
            <ResponsiveContainer>
              <LineChart data={portfolioData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="Date" stroke="#777" />
                <YAxis stroke="#777" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Portfolio_Cumulative" name="PORTFOLIO" stroke="#ff8c00" dot={false} strokeWidth={3} />
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

function CorrelationMatrix({ data, tickers }) {
  const getColor = (value) => {
    if (value > 0.7) return '#00ff88'
    if (value > 0.3) return '#ffa500'
    if (value < 0) return '#ff4444'
    return '#666'
  }

  const getBgColor = (value) => {
    if (value > 0.7) return 'rgba(0, 255, 136, 0.1)'
    if (value > 0.3) return 'rgba(255, 165, 0, 0.1)'
    if (value < 0) return 'rgba(255, 68, 68, 0.1)'
    return 'transparent'
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%' }}>
        <thead>
          <tr>
            <th style={{ 
              padding: '15px', 
              fontSize: '11px',
              textAlign: 'left'
            }}></th>
            {tickers.map(ticker => (
              <th key={ticker} style={{ 
                padding: '15px',
                fontSize: '11px',
                textAlign: 'center'
              }}>
                {ticker}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.asset}>
              <td style={{ 
                padding: '15px',
                fontWeight: '800',
                fontSize: '11px'
              }}>
                {row.asset}
              </td>
              {tickers.map(ticker => {
                const value = row[ticker]
                return (
                  <td key={ticker} style={{ 
                    padding: '15px',
                    textAlign: 'center',
                    color: getColor(value),
                    backgroundColor: getBgColor(value),
                    fontWeight: '800',
                    fontSize: '14px',
                    fontFamily: 'Consolas, monospace'
                  }}>
                    {value.toFixed(2)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default PortfolioView

import { useState, useEffect } from 'react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function PortfolioView() {
  const [tickers, setTickers] = useState(['AAPL', 'MSFT', 'GOOGL'])
  const [newTicker, setNewTicker] = useState('')
  const [portfolioData, setPortfolioData] = useState([])
  const [individualAssets, setIndividualAssets] = useState({})
  const [correlation, setCorrelation] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [rebalanceFreq, setRebalanceFreq] = useState('never')
  const [period, setPeriod] = useState('2y')
  const [weightStrategy, setWeightStrategy] = useState('equal')
  const [customWeights, setCustomWeights] = useState({})
  const [isAutoRefresh, setIsAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  // Initialize custom weights when tickers change
  useEffect(() => {
    const equalWeight = (100 / tickers.length).toFixed(1)
    const newWeights = {}
    tickers.forEach(ticker => {
      newWeights[ticker] = customWeights[ticker] !== undefined ? customWeights[ticker] : parseFloat(equalWeight)
    })
    setCustomWeights(newWeights)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers])

  const addTicker = () => {
    if (newTicker && !tickers.includes(newTicker.toUpperCase())) {
      setTickers([...tickers, newTicker.toUpperCase()])
      setNewTicker('')
    }
  }

  const removeTicker = (tickerToRemove) => {
    if (tickers.length > 3) {
      const newTickers = tickers.filter(t => t !== tickerToRemove)
      setTickers(newTickers)

      // Remove from custom weights
      const newWeights = { ...customWeights }
      delete newWeights[tickerToRemove]
      setCustomWeights(newWeights)
    } else {
      alert('MINIMUM 3 TICKERS REQUIRED')
    }
  }

  const handleWeightChange = (ticker, value) => {
    setCustomWeights({
      ...customWeights,
      [ticker]: parseFloat(value) || 0
    })
  }

  const getTotalWeight = () => {
    return Object.values(customWeights).reduce((sum, weight) => sum + weight, 0)
  }

  const normalizeWeights = () => {
    const total = getTotalWeight()
    if (total === 0) return

    const normalized = {}
    Object.keys(customWeights).forEach(ticker => {
      normalized[ticker] = (customWeights[ticker] / total) * 100
    })
    setCustomWeights(normalized)
  }

  const runBacktest = async () => {
    try {
      // Prepare weights based on strategy
      let weights = null
      if (weightStrategy === 'custom') {
        const total = getTotalWeight()
        if (Math.abs(total - 100) > 0.1) {
          alert(`WEIGHT SUM = ${total.toFixed(1)}%. MUST EQUAL 100%`)
          return
        }

        // Convert to decimal format for backend
        weights = {}
        Object.keys(customWeights).forEach(ticker => {
          weights[ticker] = customWeights[ticker] / 100
        })
      }

      const response = await axios.post('http://127.0.0.1:8001/api/portfolio/backtest', {
        tickers: tickers,
        weights: weights,
        rebalance_frequency: rebalanceFreq,
        period: period
      })
      setPortfolioData(response.data.portfolio_data)
      setMetrics(response.data.metrics)
      setIndividualAssets(response.data.individual_assets)
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (error) {
      console.error('Error:', error)
      alert('CONNECTION ERROR')
    }
  }

  const fetchCorrelation = async () => {
    try {
      const response = await axios.post('http://127.0.0.1:8001/api/portfolio/correlation', {
        tickers: tickers,
        period: period
      })
      setCorrelation(response.data)
    } catch (error) {
      console.error('Error:', error)
      alert('CONNECTION ERROR')
    }
  }

  // Auto-refresh every 5 minutes
  useEffect(() => {
    let interval = null
    if (isAutoRefresh && portfolioData.length > 0) {
      interval = setInterval(() => {
        console.log("🔄 Auto-refresh triggered...")
        runBacktest()
      }, 300000) // 5 minutes
    }
    return () => { if (interval) clearInterval(interval) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoRefresh, portfolioData.length])

  return (
    <div style={{ padding: '40px', width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
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
              PORTFOLIO ANALYSIS
            </h2>
            {lastUpdated && (
              <div style={{ fontSize: '10px', color: '#666', marginTop: '5px' }}>
                Last Updated: {lastUpdated}
              </div>
            )}
          </div>
        </div>
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

      {/* Weight Configuration Panel */}
      {weightStrategy === 'custom' && (
        <div className="bloomberg-panel" style={{ padding: '30px', marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{
              fontSize: '12px',
              color: '#ff8c00',
              fontWeight: '800',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              margin: 0
            }}>
              CUSTOM WEIGHTS
            </h3>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <span style={{
                fontSize: '11px',
                color: getTotalWeight() === 100 ? '#00ff88' : '#ff4444',
                fontWeight: '800',
                fontFamily: 'Consolas, monospace'
              }}>
                TOTAL: {getTotalWeight().toFixed(1)}%
              </span>
              <button
                onClick={normalizeWeights}
                className="controls"
                style={{ padding: '6px 12px', fontSize: '10px' }}
              >
                NORMALIZE
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            {tickers.map(ticker => (
              <div key={ticker} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#ff8c00',
                    textTransform: 'uppercase'
                  }}>
                    {ticker}
                  </label>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '900',
                    color: '#00d4ff',
                    fontFamily: 'Consolas, monospace'
                  }}>
                    {customWeights[ticker]?.toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={customWeights[ticker] || 0}
                  onChange={(e) => handleWeightChange(ticker, e.target.value)}
                  style={{
                    width: '100%',
                    height: '4px',
                    background: '#222',
                    outline: 'none',
                    accentColor: '#ff8c00'
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '35px', flexWrap: 'wrap' }}>
        <select
          value={weightStrategy}
          onChange={(e) => setWeightStrategy(e.target.value)}
          className="controls"
        >
          <option value="equal">EQUAL WEIGHT</option>
          <option value="custom">CUSTOM WEIGHTS</option>
        </select>

        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="controls"
        >
          <option value="1mo">1 MONTH</option>
          <option value="6mo">6 MONTHS</option>
          <option value="1y">1 YEAR</option>
          <option value="2y">2 YEARS</option>
          <option value="5y">5 YEARS</option>
        </select>

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
              <LineChart data={portfolioData.map((row, index) => {
                const enrichedRow = { ...row }
                // Add individual asset data for this date
                Object.keys(individualAssets).forEach(ticker => {
                  enrichedRow[ticker] = individualAssets[ticker][index]
                })
                return enrichedRow
              })}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="Date" stroke="#777" />
                <YAxis stroke="#777" />
                <Tooltip />
                <Legend />

                {/* Portfolio Line - Bold Orange */}
                <Line type="monotone" dataKey="Portfolio_Cumulative" name="PORTFOLIO" stroke="#ff8c00" dot={false} strokeWidth={4} />

                {/* Individual Asset Lines - Thinner, Different Colors */}
                {Object.keys(individualAssets).map((ticker, index) => {
                  const colors = ['#00d4ff', '#00ff88', '#a855f7', '#fbbf24', '#ec4899']
                  return (
                    <Line
                      key={ticker}
                      type="monotone"
                      dataKey={ticker}
                      name={ticker}
                      stroke={colors[index % colors.length]}
                      dot={false}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                  )
                })}
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

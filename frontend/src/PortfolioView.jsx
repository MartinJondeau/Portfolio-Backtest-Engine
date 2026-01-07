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
  const [assetStrategies, setAssetStrategies] = useState({})
  const [startDate, setStartDate] = useState('')
  const [initialAmount, setInitialAmount] = useState('')
  const [hasRealSimulation, setHasRealSimulation] = useState(false)
  const [graphTimeWindow, setGraphTimeWindow] = useState('all')

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
    // Check if using individual strategies
    const useIndividualStrategies = Object.keys(assetStrategies).length > 0

    if (useIndividualStrategies) {
      // Build assets config
      const assets = tickers.map(ticker => ({
        ticker: ticker,
        strategy: assetStrategies[ticker]?.strategy || 'buy_hold',
        params: assetStrategies[ticker]?.params || {}
      }))

      // Prepare weights
      let weightsPayload = null
      if (weightStrategy === 'custom') {
        const total = getTotalWeight()
        if (Math.abs(total - 100) > 0.1) {
          alert(`WEIGHT SUM = ${total.toFixed(1)}%. MUST EQUAL 100%`)
          return
        }
        weightsPayload = {}
        Object.keys(customWeights).forEach(ticker => {
          weightsPayload[ticker] = customWeights[ticker] / 100
        })
      }

      const payload = {
        assets: assets,
        period: period,
        weights: weightsPayload
      }

      const response = await axios.post('/api/portfolio/backtest-strategies', payload)

      setPortfolioData(response.data.portfolio_data)
      setMetrics(response.data.metrics)
      setIndividualAssets(response.data.individual_assets)
      setHasRealSimulation(false)
      setLastUpdated(new Date().toLocaleTimeString())
    } else {
      // Original backtest logic (equal weight or custom weight, no strategies)
      let weights = null
      if (weightStrategy === 'custom') {
        const total = getTotalWeight()
        if (Math.abs(total - 100) > 0.1) {
          alert(`WEIGHT SUM = ${total.toFixed(1)}%. MUST EQUAL 100%`)
          return
        }
        weights = {}
        Object.keys(customWeights).forEach(ticker => {
          weights[ticker] = customWeights[ticker] / 100
        })
      }

      const response = await axios.post('/api/portfolio/backtest', {
        tickers: tickers,
        weights: weights,
        rebalance_frequency: rebalanceFreq,
        period: period
      })
      setPortfolioData(response.data.portfolio_data)
      setMetrics(response.data.metrics)
      setIndividualAssets(response.data.individual_assets)
      setHasRealSimulation(false)
      setLastUpdated(new Date().toLocaleTimeString())
    }
  } catch (error) {
    console.error('Error:', error)
    alert('CONNECTION ERROR')
  }
}

const simulatePnL = () => {
  // Validate inputs
  if (!startDate || !initialAmount || parseFloat(initialAmount) <= 0) {
    alert('PLEASE ENTER BOTH START DATE AND INITIAL AMOUNT')
    return
  }

  if (portfolioData.length === 0) {
    alert('PLEASE EXECUTE A BACKTEST FIRST')
    return
  }

  try {
    // Filter portfolio data by start date
    let filteredData = portfolioData
    if (startDate) {
      filteredData = portfolioData.filter(row => new Date(row.Date) >= new Date(startDate))
    }

    if (filteredData.length === 0) {
      alert('NO DATA AVAILABLE FOR THE SELECTED START DATE')
      return
    }

    // Get initial and final portfolio cumulative returns
    const initialReturn = filteredData[0].Portfolio_Cumulative || filteredData[0].Cumulative_Portfolio
    const finalReturn = filteredData[filteredData.length - 1].Portfolio_Cumulative || filteredData[filteredData.length - 1].Cumulative_Portfolio

    // Calculate P&L in euros
    const amount = parseFloat(initialAmount)
    const initialValue = amount
    const finalValue = (finalReturn / initialReturn) * amount
    const totalPnL = finalValue - initialValue
    const totalPnLPct = (totalPnL / initialValue) * 100

    // Update metrics with P&L data
    setMetrics(prevMetrics => ({
      ...prevMetrics,
      "Initial Investment": `€${initialValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      "Final Value": `€${finalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      "Total P&L": `€${totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      "Total P&L %": `${totalPnLPct.toFixed(2)}%`
    }))

    setHasRealSimulation(true)
  } catch (error) {
    console.error('Error calculating P&L:', error)
    alert('ERROR CALCULATING P&L')
  }
}

const getFilteredGraphData = () => {
  if (portfolioData.length === 0) return []

  if (graphTimeWindow === 'all') return portfolioData

  // Calculate cutoff date based on selected window
  const now = new Date(portfolioData[portfolioData.length - 1].Date)
  let cutoffDate = new Date(now)

  switch (graphTimeWindow) {
    case '1mo':
      cutoffDate.setMonth(cutoffDate.getMonth() - 1)
      break
    case '3mo':
      cutoffDate.setMonth(cutoffDate.getMonth() - 3)
      break
    case '6mo':
      cutoffDate.setMonth(cutoffDate.getMonth() - 6)
      break
    case '1y':
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 1)
      break
    case '5y':
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 5)
      break
    default:
      return portfolioData
  }

  return portfolioData.filter(row => new Date(row.Date) >= cutoffDate)
}

const handleStrategyChange = (ticker, strategy, params = {}) => {
  setAssetStrategies({
    ...assetStrategies,
    [ticker]: { strategy, params }
  })
}


  const fetchCorrelation = async () => {
    try {
      const response = await axios.post('/api/portfolio/correlation', {
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
        console.log(" Auto-refresh triggered...")
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
          {isAutoRefresh ? '⏸ PAUSE' : '▶ RESUME'}
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

{/* Strategy Selection Panel */}
<div className="bloomberg-panel" style={{ padding: '30px', marginBottom: '30px' }}>
  <h3 style={{
    fontSize: '12px',
    color: '#ff8c00',
    fontWeight: '800',
    letterSpacing: '2px',
    marginBottom: '20px',
    textTransform: 'uppercase'
  }}>
    STRATEGY PER ASSET (OPTIONAL)
  </h3>
  
  {tickers.map(ticker => (
    <div key={ticker} style={{ 
      marginBottom: '20px',
      padding: '15px',
      background: 'rgba(255, 140, 0, 0.05)',
      border: '1px solid rgba(255, 140, 0, 0.2)',
      borderRadius: '4px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
        <span style={{
          color: '#ff8c00',
          fontWeight: '800',
          width: '80px',
          fontSize: '12px',
          letterSpacing: '1px'
        }}>{ticker}</span>
        <div style={{ position: 'relative', flex: 1 }}>
          <select
            value={assetStrategies[ticker]?.strategy || 'buy_hold'}
            onChange={(e) => {
              const strategy = e.target.value
              if (strategy === 'buy_hold') {
                handleStrategyChange(ticker, strategy, {})
              } else if (strategy === 'sma') {
                handleStrategyChange(ticker, strategy, { short_window: 20, long_window: 50 })
              } else if (strategy === 'mean_reversion') {
                handleStrategyChange(ticker, strategy, { window: 20, threshold: 2.0 })
              }
            }}
            style={{
              minWidth: '220px',
              width: '100%',
              backgroundColor: '#0f0f0f',
              border: '2px solid #444',
              borderLeft: '3px solid #00d4ff',
              color: '#d4d4d4',
              padding: '10px 35px 10px 15px',
              borderRadius: '2px',
              fontSize: '11px',
              fontFamily: 'Consolas, monospace',
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontWeight: '700',
              letterSpacing: '0.5px',
              appearance: 'none',
              transition: 'all 0.3s',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = '#00d4ff'
              e.target.style.boxShadow = '0 0 15px rgba(0, 212, 255, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = '#444'
              e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)'
            }}
          >
            <option value="buy_hold"> BUY & HOLD</option>
            <option value="sma"> SMA CROSSOVER</option>
            <option value="mean_reversion"> MEAN REVERSION</option>
          </select>
          <div style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: '#00d4ff',
            fontSize: '10px'
          }}>▼</div>
        </div>
      </div>
      
      {/* Strategy Parameters */}
      {assetStrategies[ticker]?.strategy === 'sma' && (
        <div style={{ display: 'flex', gap: '10px', marginLeft: '95px', marginTop: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '9px', color: '#888', letterSpacing: '1px', fontWeight: '700' }}>SHORT</label>
            <input
              type="number"
              value={assetStrategies[ticker]?.params?.short_window || 20}
              onChange={(e) => handleStrategyChange(ticker, 'sma', {
                ...assetStrategies[ticker].params,
                short_window: parseInt(e.target.value)
              })}
              style={{
                width: '80px',
                backgroundColor: '#0a0a0a',
                border: '2px solid #333',
                color: '#00ff88',
                padding: '8px 12px',
                borderRadius: '2px',
                fontSize: '12px',
                fontFamily: 'Consolas, monospace',
                fontWeight: '700',
                textAlign: 'center',
                transition: 'all 0.3s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#00ff88'
                e.target.style.boxShadow = '0 0 10px rgba(0, 255, 136, 0.3)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#333'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '9px', color: '#888', letterSpacing: '1px', fontWeight: '700' }}>LONG</label>
            <input
              type="number"
              value={assetStrategies[ticker]?.params?.long_window || 50}
              onChange={(e) => handleStrategyChange(ticker, 'sma', {
                ...assetStrategies[ticker].params,
                long_window: parseInt(e.target.value)
              })}
              style={{
                width: '80px',
                backgroundColor: '#0a0a0a',
                border: '2px solid #333',
                color: '#00ff88',
                padding: '8px 12px',
                borderRadius: '2px',
                fontSize: '12px',
                fontFamily: 'Consolas, monospace',
                fontWeight: '700',
                textAlign: 'center',
                transition: 'all 0.3s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#00ff88'
                e.target.style.boxShadow = '0 0 10px rgba(0, 255, 136, 0.3)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#333'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>
        </div>
      )}

      {assetStrategies[ticker]?.strategy === 'mean_reversion' && (
        <div style={{ display: 'flex', gap: '10px', marginLeft: '95px', marginTop: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '9px', color: '#888', letterSpacing: '1px', fontWeight: '700' }}>WINDOW</label>
            <input
              type="number"
              value={assetStrategies[ticker]?.params?.window || 20}
              onChange={(e) => handleStrategyChange(ticker, 'mean_reversion', {
                ...assetStrategies[ticker].params,
                window: parseInt(e.target.value)
              })}
              style={{
                width: '80px',
                backgroundColor: '#0a0a0a',
                border: '2px solid #333',
                color: '#ffa500',
                padding: '8px 12px',
                borderRadius: '2px',
                fontSize: '12px',
                fontFamily: 'Consolas, monospace',
                fontWeight: '700',
                textAlign: 'center',
                transition: 'all 0.3s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#ffa500'
                e.target.style.boxShadow = '0 0 10px rgba(255, 165, 0, 0.3)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#333'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '9px', color: '#888', letterSpacing: '1px', fontWeight: '700' }}>Z-SCORE</label>
            <input
              type="number"
              step="0.1"
              value={assetStrategies[ticker]?.params?.threshold || 2.0}
              onChange={(e) => handleStrategyChange(ticker, 'mean_reversion', {
                ...assetStrategies[ticker].params,
                threshold: parseFloat(e.target.value)
              })}
              style={{
                width: '80px',
                backgroundColor: '#0a0a0a',
                border: '2px solid #333',
                color: '#ffa500',
                padding: '8px 12px',
                borderRadius: '2px',
                fontSize: '12px',
                fontFamily: 'Consolas, monospace',
                fontWeight: '700',
                textAlign: 'center',
                transition: 'all 0.3s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#ffa500'
                e.target.style.boxShadow = '0 0 10px rgba(255, 165, 0, 0.3)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#333'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>
        </div>
      )}
    </div>
  ))}
</div>



      {/* Controls */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '35px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <select
            value={weightStrategy}
            onChange={(e) => setWeightStrategy(e.target.value)}
            style={{
              backgroundColor: '#1a1a1a',
              border: '2px solid #333',
              borderLeft: '3px solid #ff8c00',
              color: '#d4d4d4',
              padding: '12px 40px 12px 18px',
              borderRadius: '2px',
              fontSize: '11px',
              fontFamily: 'Consolas, monospace',
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontWeight: '700',
              letterSpacing: '1px',
              appearance: 'none',
              minWidth: '200px',
              transition: 'all 0.3s',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)'
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = '#ff8c00'
              e.target.style.boxShadow = '0 0 15px rgba(255, 140, 0, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = '#333'
              e.target.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.5)'
            }}
          >
            <option value="equal"> EQUAL WEIGHT</option>
            <option value="custom"> CUSTOM WEIGHTS</option>
          </select>
          <div style={{
            position: 'absolute',
            right: '15px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: '#ff8c00',
            fontSize: '12px'
          }}>▼</div>
        </div>

        <div style={{ position: 'relative' }}>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{
              backgroundColor: '#1a1a1a',
              border: '2px solid #333',
              borderLeft: '3px solid #ff8c00',
              color: '#d4d4d4',
              padding: '12px 40px 12px 18px',
              borderRadius: '2px',
              fontSize: '11px',
              fontFamily: 'Consolas, monospace',
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontWeight: '700',
              letterSpacing: '1px',
              appearance: 'none',
              minWidth: '180px',
              transition: 'all 0.3s',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)'
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = '#ff8c00'
              e.target.style.boxShadow = '0 0 15px rgba(255, 140, 0, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = '#333'
              e.target.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.5)'
            }}
          >
            <option value="1mo"> 1 MONTH</option>
            <option value="6mo"> 6 MONTHS</option>
            <option value="1y"> 1 YEAR</option>
            <option value="2y"> 2 YEARS</option>
            <option value="5y"> 5 YEARS</option>
          </select>
          <div style={{
            position: 'absolute',
            right: '15px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: '#ff8c00',
            fontSize: '12px'
          }}>▼</div>
        </div>

        <div style={{ position: 'relative' }}>
          <select
            value={rebalanceFreq}
            onChange={(e) => setRebalanceFreq(e.target.value)}
            style={{
              backgroundColor: '#1a1a1a',
              border: '2px solid #333',
              borderLeft: '3px solid #ff8c00',
              color: '#d4d4d4',
              padding: '12px 40px 12px 18px',
              borderRadius: '2px',
              fontSize: '11px',
              fontFamily: 'Consolas, monospace',
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontWeight: '700',
              letterSpacing: '1px',
              appearance: 'none',
              minWidth: '200px',
              transition: 'all 0.3s',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)'
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = '#ff8c00'
              e.target.style.boxShadow = '0 0 15px rgba(255, 140, 0, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = '#333'
              e.target.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.5)'
            }}
          >
            <option value="never"> NO REBALANCING</option>
            <option value="monthly"> MONTHLY</option>
            <option value="quarterly"> QUARTERLY</option>
            <option value="yearly"> YEARLY</option>
          </select>
          <div style={{
            position: 'absolute',
            right: '15px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: '#ff8c00',
            fontSize: '12px'
          }}>▼</div>
        </div>

        <button
          onClick={fetchCorrelation}
          style={{
            background: 'linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%)',
            border: '2px solid #ff8c00',
            color: '#ff8c00',
            padding: '12px 28px',
            borderRadius: '2px',
            fontSize: '11px',
            fontWeight: '800',
            cursor: 'pointer',
            transition: 'all 0.3s',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            fontFamily: 'Consolas, monospace',
            boxShadow: '0 4px 15px rgba(255, 140, 0, 0.2)'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'linear-gradient(135deg, #ff8c00 0%, #ffa500 100%)'
            e.target.style.color = '#000'
            e.target.style.transform = 'translateY(-2px)'
            e.target.style.boxShadow = '0 6px 20px rgba(255, 140, 0, 0.5)'
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%)'
            e.target.style.color = '#ff8c00'
            e.target.style.transform = 'translateY(0)'
            e.target.style.boxShadow = '0 4px 15px rgba(255, 140, 0, 0.2)'
          }}
        >
           CORRELATION
        </button>

        <button
          onClick={runBacktest}
          style={{
            background: 'linear-gradient(135deg, #ff8c00 0%, #ffa500 100%)',
            border: 'none',
            color: '#000',
            padding: '12px 35px',
            borderRadius: '2px',
            fontSize: '12px',
            fontWeight: '900',
            cursor: 'pointer',
            transition: 'all 0.3s',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            fontFamily: 'Consolas, monospace',
            boxShadow: '0 4px 20px rgba(255, 140, 0, 0.4)'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-3px) scale(1.05)'
            e.target.style.boxShadow = '0 8px 30px rgba(255, 140, 0, 0.6)'
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0) scale(1)'
            e.target.style.boxShadow = '0 4px 20px rgba(255, 140, 0, 0.4)'
          }}
        >
          ▶ EXECUTE
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
            <h3 style={{
              fontSize: '13px',
              fontWeight: '800',
              color: '#ff8c00',
              letterSpacing: '2px',
              margin: 0,
              textTransform: 'uppercase'
            }}>
              PORTFOLIO CUMULATIVE PERFORMANCE
            </h3>

            {/* Time Window Selector */}
            <div style={{ display: 'flex', gap: '10px' }}>
              {['1mo', '3mo', '6mo', '1y', '5y', 'all'].map(window => (
                <button
                  key={window}
                  onClick={() => setGraphTimeWindow(window)}
                  style={{
                    background: graphTimeWindow === window
                      ? 'linear-gradient(135deg, #ff8c00 0%, #ffa500 100%)'
                      : 'rgba(255, 140, 0, 0.1)',
                    border: graphTimeWindow === window ? 'none' : '1px solid #ff8c00',
                    color: graphTimeWindow === window ? '#000' : '#ff8c00',
                    padding: '8px 16px',
                    borderRadius: '2px',
                    fontSize: '10px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    fontFamily: 'Consolas, monospace'
                  }}
                  onMouseEnter={(e) => {
                    if (graphTimeWindow !== window) {
                      e.target.style.background = 'rgba(255, 140, 0, 0.2)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (graphTimeWindow !== window) {
                      e.target.style.background = 'rgba(255, 140, 0, 0.1)'
                    }
                  }}
                >
                  {window === 'all' ? 'ALL' : window.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div style={{ width: '100%', height: 450 }}>
            <ResponsiveContainer>
              <LineChart data={getFilteredGraphData().map((row) => {
                const enrichedRow = { ...row }
                // Calculate the correct index in the original data
                const originalIndex = portfolioData.findIndex(d => d.Date === row.Date)
                // Add individual asset data for this date
                Object.keys(individualAssets).forEach(ticker => {
                  enrichedRow[ticker] = individualAssets[ticker][originalIndex]
                })
                // Normalize portfolio field name (handle both formats)
                if (row.Cumulative_Portfolio && !row.Portfolio_Cumulative) {
                  enrichedRow.Portfolio_Cumulative = row.Cumulative_Portfolio
                }
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

      {/* Real Portfolio Simulation Section */}
      {portfolioData.length > 0 && (
        <div className="bloomberg-panel" style={{ padding: '30px', marginTop: '35px' }}>
          <h3 style={{
            fontSize: '13px',
            fontWeight: '800',
            color: '#00ff88',
            letterSpacing: '2px',
            marginBottom: '25px',
            textTransform: 'uppercase'
          }}>
             REAL PORTFOLIO SIMULATION
          </h3>

          {/* Simulation Inputs and P&L Display */}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* Start Date Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{
                fontSize: '10px',
                color: '#888',
                letterSpacing: '1px',
                fontWeight: '700',
                textTransform: 'uppercase'
              }}> Investment Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '2px solid #333',
                  borderLeft: '3px solid #00d4ff',
                  color: '#d4d4d4',
                  padding: '12px 18px',
                  borderRadius: '2px',
                  fontSize: '12px',
                  fontFamily: 'Consolas, monospace',
                  fontWeight: '700',
                  transition: 'all 0.3s',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
                  width: '200px'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#00d4ff'
                  e.target.style.boxShadow = '0 0 15px rgba(0, 212, 255, 0.4)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#333'
                  e.target.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.5)'
                }}
              />
            </div>

            {/* Initial Amount Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{
                fontSize: '10px',
                color: '#888',
                letterSpacing: '1px',
                fontWeight: '700',
                textTransform: 'uppercase'
              }}> Initial Investment (€)</label>
              <input
                type="number"
                value={initialAmount}
                onChange={(e) => setInitialAmount(e.target.value)}
                placeholder="0"
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '2px solid #333',
                  borderLeft: '3px solid #00ff88',
                  color: '#00ff88',
                  padding: '12px 18px',
                  borderRadius: '2px',
                  fontSize: '12px',
                  fontFamily: 'Consolas, monospace',
                  fontWeight: '700',
                  transition: 'all 0.3s',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
                  width: '180px',
                  textAlign: 'center'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#00ff88'
                  e.target.style.boxShadow = '0 0 15px rgba(0, 255, 136, 0.4)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#333'
                  e.target.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.5)'
                }}
              />
            </div>

            {/* Execute Simulation Button */}
            <button
              onClick={simulatePnL}
              style={{
                background: 'linear-gradient(135deg, #00ff88 0%, #00d4aa 100%)',
                border: 'none',
                color: '#000',
                padding: '12px 30px',
                borderRadius: '2px',
                fontSize: '11px',
                fontWeight: '900',
                cursor: 'pointer',
                transition: 'all 0.3s',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                fontFamily: 'Consolas, monospace',
                boxShadow: '0 4px 20px rgba(0, 255, 136, 0.4)',
                height: '46px'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px) scale(1.05)'
                e.target.style.boxShadow = '0 8px 30px rgba(0, 255, 136, 0.6)'
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0) scale(1)'
                e.target.style.boxShadow = '0 4px 20px rgba(0, 255, 136, 0.4)'
              }}
            >
               SIMULATE
            </button>

            {/* P&L Metrics Display - Inline */}
            {hasRealSimulation && (
              <>
                {/* Separator */}
                <div style={{
                  width: '2px',
                  height: '46px',
                  background: 'linear-gradient(to bottom, transparent, #00ff88, transparent)',
                  margin: '0 10px'
                }}></div>

                {/* P&L Values */}
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: '#666', marginBottom: '5px', letterSpacing: '1px', fontWeight: '700' }}>INVESTED</div>
                    <div style={{ fontSize: '16px', fontWeight: '900', color: '#00d4ff', fontFamily: 'Consolas, monospace' }}>
                      {metrics["Initial Investment"]}
                    </div>
                  </div>

                  <div style={{ fontSize: '20px', color: '#555' }}>→</div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: '#666', marginBottom: '5px', letterSpacing: '1px', fontWeight: '700' }}>FINAL VALUE</div>
                    <div style={{ fontSize: '16px', fontWeight: '900', color: '#00ff88', fontFamily: 'Consolas, monospace' }}>
                      {metrics["Final Value"]}
                    </div>
                  </div>

                  <div style={{ fontSize: '20px', color: '#555' }}>=</div>

                  <div style={{
                    padding: '12px 20px',
                    background: metrics["Total P&L"].includes('-')
                      ? 'linear-gradient(135deg, rgba(255, 68, 68, 0.1) 0%, rgba(255, 68, 68, 0.2) 100%)'
                      : 'linear-gradient(135deg, rgba(0, 255, 136, 0.1) 0%, rgba(0, 255, 136, 0.2) 100%)',
                    border: `2px solid ${metrics["Total P&L"].includes('-') ? '#ff4444' : '#00ff88'}`,
                    borderRadius: '4px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '9px', color: '#888', marginBottom: '5px', letterSpacing: '1px', fontWeight: '700' }}>P&L</div>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '900',
                      color: metrics["Total P&L"].includes('-') ? '#ff4444' : '#00ff88',
                      fontFamily: 'Consolas, monospace'
                    }}>
                      {metrics["Total P&L"]}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: '700',
                      color: metrics["Total P&L %"].includes('-') ? '#ff4444' : '#00ff88',
                      fontFamily: 'Consolas, monospace',
                      marginTop: '3px'
                    }}>
                      ({metrics["Total P&L %"]})
                    </div>
                  </div>
                </div>
              </>
            )}
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

import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import LiveBadge from './components/LiveBadge'
import StrategyMetricCard from './components/StrategyMetricCard'

export default function PortfolioView() {
  const [tickers, setTickers] = useState(['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN', 'JPM'])
  const [newTicker, setNewTicker] = useState('')
  const [portfolioData, setPortfolioData] = useState([])
  const [individualAssets, setIndividualAssets] = useState({})
  const [correlation, setCorrelation] = useState(null)
  const [metrics, setMetrics] = useState(null)
  
  // Global Settings
  const [rebalanceFreq, setRebalanceFreq] = useState('never')
  const [period, setPeriod] = useState('2y')
  const [weightStrategy, setWeightStrategy] = useState('equal')
  const [customWeights, setCustomWeights] = useState({})
  
  // App State
  const [isAutoRefresh, setIsAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isFetching, setIsFetching] = useState(false)
  const [chartKey, setChartKey] = useState(0) // Animation Key
  
  // Individual Strategy State
  const [assetStrategies, setAssetStrategies] = useState({})
  
  // Simulation State
  const [startDate, setStartDate] = useState('')
  const [initialAmount, setInitialAmount] = useState('')
  const [hasRealSimulation, setHasRealSimulation] = useState(false)

  // Initialize custom weights
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
    // FAILSAFE: Trim whitespace to prevent empty or space-only tickers
    const cleanTicker = newTicker.trim().toUpperCase();
    if (cleanTicker && !tickers.includes(cleanTicker)) {
      setTickers([...tickers, cleanTicker])
      setNewTicker('')
    }
  }

  const removeTicker = (tickerToRemove) => {
    const newTickers = tickers.filter(t => t !== tickerToRemove);
    setTickers(newTickers);
    const newWeights = { ...customWeights };
    delete newWeights[tickerToRemove];
    setCustomWeights(newWeights);
  };

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

  const handleStrategyChange = (ticker, strategy, params = {}) => {
    setAssetStrategies({
      ...assetStrategies,
      [ticker]: { strategy, params }
    })
  }

  const runBacktest = async () => {
    if (tickers.length < 3) {
      alert("ERROR: Portfolio requires at least 3 assets.");
      return;
    }
    
    setIsFetching(true);
    
    try {
      const useIndividualStrategies = Object.keys(assetStrategies).length > 0

      // Weights Logic
      let weightsPayload = null
      if (weightStrategy === 'custom') {
        const total = getTotalWeight()
        if (Math.abs(total - 100) > 0.1) {
          alert(`WEIGHT SUM = ${total.toFixed(1)}%. MUST EQUAL 100%`)
          setIsFetching(false);
          return
        }
        weightsPayload = {}
        Object.keys(customWeights).forEach(ticker => {
          weightsPayload[ticker] = customWeights[ticker] / 100
        })
      }

      let response;

      if (useIndividualStrategies) {
        const assets = tickers.map(ticker => ({
          ticker: ticker,
          strategy: assetStrategies[ticker]?.strategy || 'buy_hold',
          params: assetStrategies[ticker]?.params || {}
        }))

        response = await axios.post('/api/portfolio/backtest-strategies', {
          assets: assets,
          period: period,
          weights: weightsPayload
        })
      } else {
        response = await axios.post('/api/portfolio/backtest', {
          tickers: tickers,
          weights: weightsPayload,
          rebalance_frequency: rebalanceFreq,
          period: period
        })
      }

      // FAILSAFE: Ensure response data structure is valid before mapping
      if (!response.data || !Array.isArray(response.data.portfolio_data)) {
          throw new Error("Invalid data received from server");
      }

      // --- ROBUST DATA NORMALIZATION ---
      const normalizedData = response.data.portfolio_data.map(row => ({
        ...row,
        Portfolio_Cumulative:
          row.Portfolio_Cumulative ??
          row.Cumulative_Portfolio ??
          null
      }));

      setPortfolioData(normalizedData);
      setMetrics(response.data.metrics)
      // FAILSAFE: Default to empty object if missing
      setIndividualAssets(response.data.individual_assets || {}) 
      setHasRealSimulation(false)
      setLastUpdated(new Date().toLocaleTimeString())
      
      // Reset PnL Date
      setStartDate('');
      
      // Force Re-render
      setChartKey(prev => prev + 1)

    } catch (error) {
      console.error('Error:', error)
      // Display slightly more info if available, otherwise generic error
      const msg = error.response?.data?.detail || 'CONNECTION ERROR';
      alert(msg);
    } finally {
        setIsFetching(false);
    }
  }

  // --- CHART DATA PRE-CALCULATION ---
  const chartData = useMemo(() => {
    if (!portfolioData || portfolioData.length === 0) return [];
    
    return portfolioData.map((row, i) => {
      const merged = { ...row };
      // FAILSAFE: Check if individualAssets exists
      if (individualAssets) {
          Object.keys(individualAssets).forEach(ticker => {
            // FAILSAFE: Optional chaining + nullish coalescing to prevent undefined errors
            merged[ticker] = individualAssets[ticker]?.[i] ?? null;
          });
      }
      return merged;
    });
  }, [portfolioData, individualAssets]);

  // --- DATE LIMITS ---
  const availableDates = useMemo(() => {
    if (!portfolioData || portfolioData.length === 0) return { min: '', max: '' };
    return {
        min: portfolioData[0].Date,
        max: portfolioData[portfolioData.length - 1].Date
    };
  }, [portfolioData]);

  const simulatePnL = () => {
    if (!startDate || !initialAmount || parseFloat(initialAmount) <= 0) {
      alert('PLEASE ENTER BOTH START DATE AND INITIAL AMOUNT');
      return;
    }
    if (portfolioData.length === 0) {
      alert('PLEASE EXECUTE A BACKTEST FIRST');
      return;
    }

    try {
      const targetDate = new Date(startDate);
      const startIndex = portfolioData.findIndex(row => new Date(row.Date) >= targetDate);

      if (startIndex === -1) {
        alert('SELECTED DATE IS OUT OF RANGE');
        return;
      }

      const simulationPeriodData = portfolioData.slice(startIndex);
      const initialCumulative = simulationPeriodData[0].Portfolio_Cumulative || simulationPeriodData[0].Cumulative_Portfolio;
      const finalCumulative = simulationPeriodData[simulationPeriodData.length - 1].Portfolio_Cumulative || simulationPeriodData[simulationPeriodData.length - 1].Cumulative_Portfolio;

      // FAILSAFE: Prevent Division by Zero or NaN results if data is corrupt/missing at start date
      if (!initialCumulative || initialCumulative === 0) {
          alert("Cannot calculate P&L: Initial portfolio value is invalid (0 or null) for this date.");
          return;
      }

      const amount = parseFloat(initialAmount);
      const finalValue = (finalCumulative / initialCumulative) * amount;
      const totalPnL = finalValue - amount;
      const totalPnLPct = (totalPnL / amount) * 100;

      setMetrics(prevMetrics => ({
        ...prevMetrics,
        "Initial Investment": `€${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        "Final Value": `€${finalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        "Total P&L": `€${totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        "Total P&L %": `${totalPnLPct.toFixed(2)}%`
      }));

      setHasRealSimulation(true);
    } catch (error) {
      console.error('Error calculating P&L:', error);
      alert('ERROR CALCULATING P&L');
    }
  };

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

  // Auto-refresh logic
  useEffect(() => {
    let interval = null
    if (isAutoRefresh && portfolioData.length > 0) {
      interval = setInterval(() => {
        if (!isFetching) runBacktest()
      }, 300000)
    }
    return () => { if (interval) clearInterval(interval) }
  }, [isAutoRefresh, portfolioData.length, isFetching])

  return (
    <div className="view-container">
      
      {/* 1. HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '4px', height: '32px', background: 'var(--color-primary)', boxShadow: '0 0 12px var(--color-primary-glow)' }}></div>
          <div>
            <h2 style={{ fontSize: '18px', color: 'var(--color-primary)', margin: 0 }}>PORTFOLIO CONSTRUCTION</h2>
          </div>
        </div>    
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => setIsAutoRefresh(!isAutoRefresh)} style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-surface)', color: 'var(--text-muted)' }}>
            {isAutoRefresh ? 'PAUSE' : 'RESUME'}
          </button>
        </div>
      </div>

      {/* 2. CONTROL BAR */}
      <div
        className="controls"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px'
        }}
      >
        {/* A. ADD TICKER (LEFT) */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '14px' }}>
            ASSETS
          </h3>

          <input
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && addTicker()}
            placeholder="ADD TICKER..."
            style={{ width: '140px' }}
          />

          <button
            onClick={addTicker}
            style={{
              width: '30px',
              height: '30px',
              fontSize: '20px',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            +
          </button>
        </div>

        {/* B. DATE SELECTORS — PUSHED RIGHT */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            marginLeft: 'auto'
          }}
        >
          {['1mo', '3mo', '6mo', '1y', '2y', '5y'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                background: period === p ? 'var(--color-primary)' : 'transparent',
                color: period === p ? '#000' : 'var(--text-muted)',
                border: period === p ? 'none' : '1px solid var(--border-strong)',
                padding: '6px 12px'
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* C. CONFIG */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <select value={weightStrategy} onChange={(e) => setWeightStrategy(e.target.value)}>
            <option value="equal">EQUAL WEIGHT</option>
            <option value="custom">CUSTOM WEIGHT</option>
          </select>

          <select value={rebalanceFreq} onChange={(e) => setRebalanceFreq(e.target.value)}>
            <option value="never">NO REBALANCING</option>
            <option value="monthly">MONTHLY</option>
            <option value="quarterly">QUARTERLY</option>
            <option value="yearly">YEARLY</option>
          </select>
        </div>

        {/* D. EXECUTE */}
        <button onClick={runBacktest} disabled={isFetching}>
          {isFetching ? 'EXECUTING...' : 'EXECUTE'}
        </button>
      </div>


      {/* 3. ASSET CONFIGURATION GRID (3 Columns) */}
      <div className="bloomberg-panel" style={{ padding: '25px', marginBottom: '25px', background: 'transparent', border: 'none', boxShadow: 'none', paddingLeft: 0, paddingRight: 0 }}>
        
        {/* Header Row for Asset Grid */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ fontSize: '12px', color: 'var(--color-primary)', letterSpacing: '2px', textTransform: 'uppercase', margin: 0 }}>
                ALLOCATION ({tickers.length})
            </h3>
            
            {weightStrategy === 'custom' && (
               <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                 <span style={{ fontSize: '11px', fontWeight: 'bold', color: getTotalWeight().toFixed(1) === "100.0" ? 'var(--color-success)' : 'var(--color-danger)', fontFamily: 'var(--font-mono)' }}>
                    TOTAL: {getTotalWeight().toFixed(1)}%
                 </span>
                 <button onClick={normalizeWeights} style={{ fontSize: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '4px 8px', cursor: 'pointer' }}>NORMALIZE</button>
               </div>
            )}
        </div>
        
        <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', 
            gap: '20px' 
        }}>
          {tickers.map(ticker => (
            <div key={ticker} style={{ 
                backgroundColor: '#141414', 
                border: '1px solid #333', 
                borderRadius: '4px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)', 
                overflow: 'hidden'
            }}>
              
              {/* TOP: LIVE BADGE & REMOVE BUTTON */}
              <div style={{ 
                  padding: '15px', 
                  display: 'flex', 
                  justifyContent: 'flex-start',
                  position: 'relative'
              }}>
                 <LiveBadge ticker={ticker} isLive={isAutoRefresh} />

                 <button 
                    onClick={() => removeTicker(ticker)} 
                    style={{ 
                        position: 'absolute', 
                        top: '15px', 
                        right: '15px',
                        background: 'rgba(255, 68, 68, 0.15)', 
                        border: '1px solid var(--color-danger)', 
                        color: 'var(--color-danger)', 
                        fontSize: '14px', 
                        cursor: 'pointer',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '2px',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = 'rgba(255, 68, 68, 0.3)'}
                    onMouseLeave={(e) => e.target.style.background = 'rgba(255, 68, 68, 0.15)'}
                 >×</button>
              </div>

              {/* BOTTOM: SPLIT LAYOUT (Strategy & Weights) */}
              <div style={{ 
                  marginTop: 'auto', 
                  background: 'rgba(0,0,0,0.3)', 
                  borderTop: '1px solid #2a2a2a', 
                  padding: '15px',
                  display: 'flex',
                  alignItems: 'center', 
                  gap: '15px'
              }}>
                
                {/* LEFT SIDE: Strategy Selection */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                        <select 
                            value={assetStrategies[ticker]?.strategy || 'buy_hold'}
                            onChange={(e) => {
                                const strat = e.target.value;
                                let defaultParams = {};
                                // Set default params based on strategy
                                if (strat === 'sma') defaultParams = { short_window: 20, long_window: 50 };
                                else if (strat === 'mean_reversion') defaultParams = { window: 20, threshold: 2.0 };
                                // ML_RandomForest defaults
                                
                                handleStrategyChange(ticker, strat, defaultParams);
                            }}
                            style={{ 
                                width: '100%', 
                                padding: '6px', 
                                fontSize: '10px', 
                                background: '#0a0a0a', 
                                border: '1px solid #444', 
                                color: '#eee', 
                                fontWeight: 'bold',
                                outline: 'none'
                            }}
                        >
                            <option value="buy_hold">STRATEGY: BUY & HOLD</option>
                            <option value="sma">STRATEGY: SMA CROSSOVER</option>
                            <option value="mean_reversion">STRATEGY: MEAN REVERSION</option>
                            <option value="ML_RandomForest">STRATEGY: RANDOM FOREST</option>
                        </select>
                    </div>

                    {/* Inline Strategy Parameters */}
                    {assetStrategies[ticker]?.strategy === 'sma' && (
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <input type="number" placeholder="S" value={assetStrategies[ticker]?.params?.short_window || 20} onChange={(e) => handleStrategyChange(ticker, 'sma', { ...assetStrategies[ticker].params, short_window: parseInt(e.target.value) })} style={{ width: '48%', background: '#0a0a0a', border: '1px solid #444', color: '#eee', padding: '4px', fontSize: '10px', textAlign: 'center' }} />
                            <input type="number" placeholder="L" value={assetStrategies[ticker]?.params?.long_window || 50} onChange={(e) => handleStrategyChange(ticker, 'sma', { ...assetStrategies[ticker].params, long_window: parseInt(e.target.value) })} style={{ width: '48%', background: '#0a0a0a', border: '1px solid #444', color: '#eee', padding: '4px', fontSize: '10px', textAlign: 'center' }} />
                        </div>
                    )}
                    {assetStrategies[ticker]?.strategy === 'mean_reversion' && (
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <input type="number" placeholder="W" value={assetStrategies[ticker]?.params?.window || 20} onChange={(e) => handleStrategyChange(ticker, 'mean_reversion', { ...assetStrategies[ticker].params, window: parseInt(e.target.value) })} style={{ width: '48%', background: '#0a0a0a', border: '1px solid #444', color: '#eee', padding: '4px', fontSize: '10px', textAlign: 'center' }} />
                            <input type="number" step="0.1" placeholder="Z" value={assetStrategies[ticker]?.params?.threshold || 2.0} onChange={(e) => handleStrategyChange(ticker, 'mean_reversion', { ...assetStrategies[ticker].params, threshold: parseFloat(e.target.value) })} style={{ width: '48%', background: '#0a0a0a', border: '1px solid #444', color: '#eee', padding: '4px', fontSize: '10px', textAlign: 'center' }} />
                        </div>
                    )}
                </div>

                {/* RIGHT SIDE: Weight Slider (Only visible if Custom Weight) */}
                {weightStrategy === 'custom' && (
                    <div style={{ flex: 1, borderLeft: '1px solid #333', paddingLeft: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                            <span>Weight</span>
                            <span style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>{customWeights[ticker]?.toFixed(1)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.1"
                            value={customWeights[ticker] || 0}
                            onChange={(e) => handleWeightChange(ticker, e.target.value)}
                            style={{ width: '100%', height: '4px', background: '#333', outline: 'none', accentColor: 'var(--color-primary)', cursor: 'ew-resize' }}
                        />
                    </div>
                )}

              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. RESULTS SECTION */}
      {metrics && (
        <div className="grid-container" style={{ marginBottom: '25px' }}>
          <StrategyMetricCard title="TOTAL RETURN" value={metrics["Total Return"]} color={metrics["Total Return"].includes("-") ? "#ff4444" : "#00ff88"} />          
          <StrategyMetricCard title="SHARPE RATIO" value={metrics["Sharpe Ratio"]} color="#00d4ff" />
          <StrategyMetricCard title="VOLATILITY" value={metrics["Volatility"]} color="#ffa500" />
          <StrategyMetricCard title="MAX DRAWDOWN" value={metrics["Max Drawdown"]} color="#ff4444" />
        </div>
      )}

      {/* 5. CHART & CORRELATION */}
      {chartData.length > 0 && (
        <>
            <div className="bloomberg-panel" style={{ padding: '24px', minHeight: '500px', marginBottom: '30px', backgroundColor: '#141414', border: '1px solid #333' }}>
                
                {/* HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                        CUMULATIVE PERFORMANCE
                    </h3>
                    <button onClick={fetchCorrelation} style={{ fontSize: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '6px 12px', cursor: 'pointer' }}>
                        VIEW CORRELATION MATRIX
                    </button>
                </div>

                {/* CUSTOM LEGEND */}
                <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
                    {/* Portfolio Legend Item */}
                    <div style={{ fontSize: 11 }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>
                            PORTFOLIO
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 12, height: 2, background: '#FFFFFF' }} />
                            COMBINED RETURN
                        </div>
                    </div>

                    {/* Constituents Legend Item */}
                    <div style={{ fontSize: 11 }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>
                            CONSTITUENTS
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                            {Object.keys(individualAssets).map((ticker, i) => (
                                <div key={ticker} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <svg width="12" height="2" style={{ marginRight: 0 }}>
                                        <line x1="0" y1="1" x2="12" y2="1" stroke={['#ff8c00', '#00ff88', '#00d4ff', '#ff4444', '#a855f7', '#ffff00', '#0059ffff', '#ec4899'][i%8]} strokeWidth="1" strokeDasharray="3 2" />
                                    </svg>
                                    {ticker}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div style={{ width: '100%', height: 450 }}>
                    <ResponsiveContainer key={chartKey}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                        <XAxis dataKey="Date" stroke="var(--text-muted)" tick={{fontSize: 10}} minTickGap={40} />
                        <YAxis stroke="var(--text-muted)" domain={['auto', 'auto']} tick={{fontSize: 10}} />
                        <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} itemStyle={{ fontSize: '12px' }} formatter={(value) => typeof value === 'number' ? value.toFixed(5) : value} />
                        
                        {/* PORTFOLIO LINE - FORCE WHITE AND CONNECT NULLS */}
                        <Line 
                            type="monotone" 
                            dataKey="Portfolio_Cumulative" 
                            name="PORTFOLIO" 
                            stroke="#FFFFFF" 
                            strokeWidth={2} 
                            dot={false}
                            connectNulls={true} 
                            isAnimationActive={true}
                            animationDuration={1500}
                        />
                        
                        {Object.keys(individualAssets).map((ticker, i) => (
                           <Line 
                                key={ticker} 
                                type="monotone" 
                                dataKey={ticker} 
                                name={ticker} 
                                stroke={['#ff8c00', '#00ff88', '#00d4ff', '#ff4444', '#a855f7', '#ffff00', '#0059ffff', '#ec4899'][i%8]} // Extended color palette
                                strokeWidth={1} 
                                dot={false} 
                                strokeDasharray="5 5"
                                connectNulls={true} 
                                isAnimationActive={true}
                                animationDuration={1500}
                            />
                        ))}
                    </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* CORRELATION MODAL/PANEL (Conditional) */}
            {correlation && (
                <div className="bloomberg-panel" style={{ padding: '30px', marginBottom: '30px', backgroundColor: '#141414', border: '1px solid #333' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--color-primary)', marginBottom: '25px', letterSpacing: '2px' }}>CORRELATION MATRIX</h3>
                  <CorrelationMatrix data={correlation.correlation_matrix} tickers={correlation.tickers} />
                </div>
            )}
        </>
      )}

      {/* 6. REALITY SIMULATION */}
      {portfolioData.length > 0 && (
        <div className="bloomberg-panel" style={{ 
            padding: '25px 30px', 
            background: 'linear-gradient(180deg, rgba(20,20,20,1) 0%, rgba(10,10,10,1) 100%)', 
            borderTop: '3px solid var(--color-success)', 
            border: '1px solid #333',
            height: '150px', 
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '900', color: 'var(--color-success)', marginBottom: '20px', letterSpacing: '2px', display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0 }}>
            P&L SIMULATION
          </h3>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '50px' }}>
            {/* INPUTS */}
            <div className="controls" style={{ background: 'transparent', border: 'none', padding: 0, margin: 0 }}>
                <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    // FIX: Auto-correct date on blur
                    onBlur={() => {
                        if (startDate && startDate < availableDates.min) {
                            alert(`Date too early. Resetting to start of backtest: ${availableDates.min}`);
                            setStartDate(availableDates.min);
                        } else if (startDate && startDate > availableDates.max) {
                            setStartDate(availableDates.max);
                        }
                    }}
                    min={availableDates.min} 
                    max={availableDates.max}
                    style={{ width: '200px' }} 
                />
                <input type="number" placeholder="INITIAL CAPITAL (€)" value={initialAmount} onChange={(e) => setInitialAmount(e.target.value)} style={{ width: '200px' }} />
                
                <button onClick={() => {
                    // FIX: Hard stop before calculation
                    if (new Date(startDate) < new Date(availableDates.min)) {
                        alert(`Please select a date after ${availableDates.min}`);
                        setStartDate(availableDates.min);
                        return;
                    }
                    simulatePnL();
                }} style={{ background: 'var(--color-success)', color: 'black', fontWeight: 'bold' }}>
                SIMULATE
                </button>
            </div>
            
            {/* RESULTS */}
            {hasRealSimulation ? (
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '20px', 
                    background: 'rgba(0, 255, 136, 0.05)', 
                    padding: '10px 20px', 
                    borderRadius: '4px', 
                    border: '1px solid var(--color-success)',
                    boxShadow: '0 0 15px rgba(0, 255, 136, 0.1)' 
                }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>INVESTED</div>
                        <div style={{ fontSize: '20px', color: '#00d4ff', fontWeight: 'bold' }}>{metrics["Initial Investment"]}</div>
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>➜</div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>FINAL</div>
                        <div style={{ fontSize: '20px', color: '#eee', fontWeight: 'bold' }}>{metrics["Final Value"]}</div>
                    </div>
                    <div style={{ height: '20px', width: '1px', background: 'var(--color-success)', opacity: 0.3 }}></div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>P&L</div>
                        <div style={{ fontSize: '20px', color: metrics["Total P&L"].includes('-') ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: '900' }}>
                        {metrics["Total P&L"]}
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ height: '42px' }}></div> 
            )}
          </div>
        </div>
      )}

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
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ padding: '10px' }}></th>
            {tickers.map(ticker => (
              <th key={ticker} style={{ padding: '10px', fontSize: '11px', color: '#888' }}>{ticker}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.asset} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '10px', fontSize: '11px', fontWeight: 'bold', color: '#eee' }}>{row.asset}</td>
              {tickers.map(ticker => {
                const value = row[ticker]
                return (
                  <td key={ticker} style={{ padding: '10px', textAlign: 'center', color: getColor(value), backgroundColor: getBgColor(value), fontSize: '12px', fontFamily: 'Consolas, monospace' }}>
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
import { useState, useEffect } from 'react'
import axios from 'axios'
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area } from 'recharts'

import StrategyMetricCard from './components/StrategyMetricCard'
import LiveBadge from './components/LiveBadge'

export default function StrategiesView() {
  const [ticker, setTicker] = useState('AAPL')
  
  // Strategy Parameters
  const [shortWindow, setShortWindow] = useState(20)
  const [longWindow, setLongWindow] = useState(50)
  const [window, setWindow] = useState(20)
  const [threshold, setThreshold] = useState(2.0)
  
  // Global Settings
  const [period, setPeriod] = useState('1y')
  const [timeframe, setTimeframe] = useState('daily')
  const [strategy, setStrategy] = useState('SMA')
  
  // Data State
  const [data, setData] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [error, setError] = useState(null)
  const [isAutoRefresh, setIsAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [showForecast, setShowForecast] = useState(false)
  const [forecastData, setForecastData] = useState([])
  
  // Fetching state
  const [isFetching, setIsFetching] = useState(false)
  // Animation Key
  const [chartKey, setChartKey] = useState(0)

  const fetchData = async () => {
    if (isFetching) return;

    setIsFetching(true)
    setError(null)
    
    // NOTE: We do NOT clear data here. Old chart stays visible.

    try {
      let url = null

      if (strategy === 'SMA') {
        url = `/api/backtest/sma/${ticker}?short_window=${shortWindow}&long_window=${longWindow}&period=${period}&timeframe=${timeframe}`
      } else if (strategy === 'MeanReversion') {
        url = `/api/backtest/mean-reversion/${ticker}?window=${window}&threshold=${threshold}&period=${period}&timeframe=${timeframe}`
      } else if (strategy === 'ML_RandomForest') {
        url = `/api/backtest/ml/${ticker}?period=${period}&timeframe=${timeframe}`
      }

      if (!url) {
        setIsFetching(false);
        return;
      }

      const response = await axios.get(url)

      // FAILSAFE 1: Validate Main Data
      if (!response.data || !Array.isArray(response.data.data) || response.data.data.length === 0) {
          throw new Error("No data returned. Check ticker symbol or period.");
      }

      // FAILSAFE 2: Validate Metrics
      if (!response.data.metrics) {
          throw new Error("Metrics calculation failed.");
      }

      // --- SUCCESS PATH ---
      setData(response.data.data)
      setMetrics(response.data.metrics)
      setLastUpdated(new Date().toLocaleTimeString())
      
      // Increment key to trigger the smooth "draw" animation on the new data
      setChartKey(prev => prev + 1) 

      // FAILSAFE 3: Isolated Forecast Fetching
      let newForecast = [];
      if (strategy === 'ML_RandomForest' && showForecast) {
          try {
            const forecastUrl = `/api/forecast/ml/${ticker}?period=${period}`
            const forecastRes = await axios.get(forecastUrl)
            if (forecastRes.data && Array.isArray(forecastRes.data.forecast)) {
               newForecast = forecastRes.data.forecast;
            } else {
               console.warn("Forecast API returned invalid structure");
            }
          } catch (forecastErr) {
            console.error("Forecast failed (Non-critical):", forecastErr)
          }
      }
      setForecastData(newForecast);

    } catch (err) {
      console.error("Fetch error:", err)
      const msg = err.response?.status === 404 
        ? `Symbol '${ticker}' not found.` 
        : (err.message || "Cannot connect to Backend.");
      setError(msg)
    } finally {
      setIsFetching(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchData(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) 

  // Auto-refresh logic
  useEffect(() => {
    let interval = null
    if (isAutoRefresh) {
      interval = setInterval(() => {
        if (!error && !isFetching) fetchData()
      }, 300000)
    }
    return () => { if (interval) clearInterval(interval) }
  }, [isAutoRefresh, error, isFetching, ticker, strategy, shortWindow, longWindow, window, threshold, period, timeframe])

  const getPlotData = () => {
    if (!data || data.length === 0) return [];

    if (!showForecast || forecastData.length === 0 || strategy !== 'ML_RandomForest') {
      return data;
    }

    const historyMinusLast = data.slice(0, data.length - 1); 
    const lastPoint = data[data.length - 1]; 
    const baseValue = lastPoint.Cumulative_Strategy; 
    
    const bridgePoint = {
      ...lastPoint, 
      Forecast_Mean: baseValue, 
      Forecast_Range: [baseValue, baseValue] 
    };

    const forecastPlot = forecastData.map(f => ({
       Date: f.Date,
       Forecast_Mean: f.Forecast_Ratio * baseValue,
       Forecast_Range: [f.Lower_Ratio * baseValue, f.Upper_Ratio * baseValue]
    }));

    return [...historyMinusLast, bridgePoint, ...forecastPlot];
  }

  return (
    <div className="view-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '4px', height: '32px', background: 'var(--color-primary)', boxShadow: '0 0 12px var(--color-primary-glow)' }}></div>
          <div>
            <h2 style={{ fontSize: '18px', color: 'var(--color-primary)', margin: 0 }}>ADVANCED STRATEGIES</h2>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => setIsAutoRefresh(!isAutoRefresh)} style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-surface)', color: 'var(--text-muted)' }}>
            {isAutoRefresh ? 'PAUSE' : 'RESUME'}
          </button>
          <LiveBadge ticker={ticker} isLive={isAutoRefresh} />
        </div>
      </div>

      {/* Controls */}
      <div className="controls">
        <select value={strategy} onChange={(e) => setStrategy(e.target.value)} style={{ minWidth: '160px' }}>
          <option value="SMA">SMA CROSSOVER</option>
          <option value="MeanReversion">MEAN REVERSION</option>
          <option value="ML_RandomForest">RANDOM FOREST</option>
        </select>

        {strategy === 'ML_RandomForest' && (
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '10px', marginRight: '10px' }}>
             <label style={{ color: 'var(--color-primary)', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
               <input 
                 type="checkbox" 
                 checked={showForecast} 
                 onChange={(e) => setShowForecast(e.target.checked)}
                 style={{ accentColor: 'var(--color-primary)', marginRight: '8px', cursor: 'pointer' }}
               />
               ENABLE AI FORECAST
             </label>
           </div>
        )}

        <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="TICKER" style={{ width: '100px' }} />

        {strategy === 'SMA' && (
          <>
            <input type="number" value={shortWindow} onChange={(e) => setShortWindow(e.target.value)} placeholder="SHORT" style={{ width: '80px' }} />
            <input type="number" value={longWindow} onChange={(e) => setLongWindow(e.target.value)} placeholder="LONG" style={{ width: '80px' }} />
          </>
        )}

        {strategy === 'MeanReversion' && (
          <>
            <input type="number" value={window} onChange={(e) => setWindow(e.target.value)} placeholder="WINDOW" style={{ width: '80px' }} />
            <input type="number" step="0.1" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="Z-SCORE" style={{ width: '80px' }} />
          </>
        )}

        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="1y">1 YEAR</option>
          <option value="2y">2 YEARS</option>
          <option value="5y">5 YEARS</option>
        </select>

        <button onClick={fetchData} disabled={isFetching}>
            {isFetching ? 'EXECUTING...' : 'EXECUTE'}
        </button>
      </div>

      {/* ERROR STATE */}
      {error ? (
        <div className="bloomberg-panel" style={{ padding: '40px', textAlign: 'center', border: '1px solid var(--color-danger)' }}>
            <h3 style={{ color: 'var(--color-danger)', fontSize: '24px', marginBottom: '10px' }}>STRATEGY ERROR</h3>
            <p style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{error}</p>
            <div style={{ marginTop: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Please check the ticker symbol or adjust your parameters.
            </div>
        </div>
      ) : (
        <>
            {/* METRICS */}
            {metrics && (
                <div className="grid-container" style={{ marginBottom: '25px' }}>
                <StrategyMetricCard title="TOTAL RETURN" value={metrics["Total Return"]} color={metrics["Total Return"].includes("-") ? "#ff4444" : "#00ff88"} />          
                <StrategyMetricCard title="SHARPE RATIO" value={metrics["Sharpe Ratio"]} color="#00d4ff" />
                <StrategyMetricCard title="VOLATILITY" value={metrics["Volatility"]} color="#ffa500" />
                <StrategyMetricCard title="MAX DRAWDOWN" value={metrics["Max Drawdown"]} color="#ff4444" />
                </div>
            )}

            {/* CHART */}
            {data.length > 0 && (
                <div className="bloomberg-panel" style={{ padding: '24px', minHeight: '500px' }}>
                <h3 style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>CUMULATIVE PERFORMANCE {strategy === 'ML_RandomForest' ? '(OUT-OF-SAMPLE)' : ''}</span>
                    <span style={{ color: 'var(--color-primary)' }}>■ STRATEGY vs ■ MARKET</span>
                </h3>
                
                <div style={{ width: '100%', height: 450 }}>
                    <ResponsiveContainer key={chartKey}>
                    <ComposedChart data={getPlotData()}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="Date" stroke="var(--text-muted)" tick={{fontSize: 10}} minTickGap={40} />
                        <YAxis stroke="var(--text-muted)" domain={['auto', 'auto']} tick={{fontSize: 10}} />
                        
                        <Tooltip 
                        contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }}
                        itemStyle={{ color: '#ccc' }}
                        />
                        <Legend />

                        <Line 
                            type="monotone" 
                            dataKey="Cumulative_Market" 
                            name="BUY & HOLD" 
                            stroke="#00d4ff" 
                            dot={false} 
                            strokeWidth={2} 
                            isAnimationActive={true} 
                            animationDuration={1500}
                        />
                        <Line 
                            type="monotone" 
                            dataKey="Cumulative_Strategy" 
                            name={`STRATEGY (${strategy})`} 
                            stroke="#00ff88" 
                            dot={false} 
                            strokeWidth={3} 
                            isAnimationActive={true}
                            animationDuration={1500}
                        />

                        {showForecast && (
                        <>
                            <Area 
                                type="monotone" 
                                dataKey="Forecast_Range" 
                                name="95% Confidence" 
                                stroke="none" 
                                fill="#00ff88" 
                                fillOpacity={0.15} 
                                isAnimationActive={true} 
                                animationDuration={1500}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="Forecast_Mean" 
                                name="AI FORECAST" 
                                stroke="#00ff88" 
                                strokeWidth={2} 
                                dot={false} 
                                style={{ filter: 'drop-shadow(0px 0px 6px rgba(255, 255, 255, 0.6))' }} 
                                isAnimationActive={true}
                                animationDuration={1500}
                            />
                        </>
                        )}
                    </ComposedChart>
                    </ResponsiveContainer>
                </div>
                </div>
            )}
        </>
      )}
    </div>
  )
}
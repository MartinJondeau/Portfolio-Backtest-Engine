import { useState, useEffect } from 'react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import StrategyMetricCard from './components/StrategyMetricCard'

export default function OptionsView() {
  // --- INPUT STATE ---
  const [spot, setSpot] = useState(100)
  const [strike, setStrike] = useState(100)
  const [volatility, setVolatility] = useState(0.20)
  const [timeToMaturity, setTimeToMaturity] = useState(1.0)
  const [rate, setRate] = useState(0.05)
  const [optionType, setOptionType] = useState('Call')
  
  // --- RESULTS STATE ---
  const [pricing, setPricing] = useState(null)
  const [stressResults, setStressResults] = useState(null)
  const [hedgingData, setHedgingData] = useState(null)
  
  // --- UI STATE ---
  const [isCalculating, setIsCalculating] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [chartKey, setChartKey] = useState(0)

  // 1. CALCULATE PRICING & GREEKS
  const calculatePricing = async () => {
    setIsCalculating(true)
    try {
      // Prepare Payload
      const payload = {
        S: parseFloat(spot),
        K: parseFloat(strike),
        T: parseFloat(timeToMaturity),
        r: parseFloat(rate),
        sigma: parseFloat(volatility),
        option_type: optionType,
        N: 50
      }

      // Parallel Requests
      const [priceRes, stressRes] = await Promise.all([
        axios.post('/api/options/pricing', payload),
        axios.post('/api/options/stress', payload)
      ])

      setPricing(priceRes.data.bs) // Use Black-Scholes for main display
      setStressResults(stressRes.data)
      
    } catch (err) {
      console.error("Pricing Error:", err)
      alert("Error calculating price. Check inputs.")
    } finally {
      setIsCalculating(false)
    }
  }

  // 2. RUN MONTE CARLO HEDGING
  const runSimulation = async () => {
    setIsSimulating(true)
    try {
      const payload = {
        S: parseFloat(spot),
        K: parseFloat(strike),
        T: parseFloat(timeToMaturity),
        r: parseFloat(rate),
        sigma: parseFloat(volatility),
        option_type: optionType,
        n_steps: 52, // Weekly rebalancing
        n_paths: 20  // Limit paths for clean visualization
      }

      const response = await axios.post('/api/options/hedging', payload)
      
      // Transform Data for Recharts
      // API returns 'paths' as [[S0, S1...], [S0, S1...]]
      // We need [{step: 0, path0: 100, path1: 100}, {step: 1, ...}]
      
      const rawPaths = response.data.paths
      const timeSteps = response.data.time_steps
      
      const chartData = timeSteps.map((t, stepIdx) => {
        const point = { time: t.toFixed(2) }
        rawPaths.forEach((path, pathIdx) => {
            point[`path_${pathIdx}`] = path[stepIdx]
        })
        return point
      })

      setHedgingData({
        metrics: {
            mean_error: response.data.mean_error,
            std_error: response.data.std_error,
            initial_cost: response.data.initial_price
        },
        chartData: chartData,
        pathCount: rawPaths.length
      })
      
      setChartKey(prev => prev + 1) // Trigger animation

    } catch (err) {
      console.error("Simulation Error:", err)
      alert("Simulation failed.")
    } finally {
      setIsSimulating(false)
    }
  }

  // Initial Load
  useEffect(() => {
    calculatePricing()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="view-container">
      
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
        <div style={{ width: '4px', height: '32px', background: 'var(--color-primary)', boxShadow: '0 0 12px var(--color-primary-glow)' }}></div>
        <h2 style={{ fontSize: '18px', color: 'var(--color-primary)', margin: 0 }}>DERIVATIVES LAB</h2>
      </div>

      {/* CONTROLS (Top Bar) */}
      <div className="controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', paddingBottom: '20px', borderBottom: '1px solid #222', marginBottom: '20px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>SPOT PRICE ($)</label>
            <input type="number" value={spot} onChange={(e) => setSpot(e.target.value)} style={{ width: '80px' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>STRIKE ($)</label>
            <input type="number" value={strike} onChange={(e) => setStrike(e.target.value)} style={{ width: '80px' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>VOLATILITY (0.2=20%)</label>
            <input type="number" step="0.01" value={volatility} onChange={(e) => setVolatility(e.target.value)} style={{ width: '80px' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>MATURITY (Yrs)</label>
            <input type="number" step="0.1" value={timeToMaturity} onChange={(e) => setTimeToMaturity(e.target.value)} style={{ width: '80px' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>RATE (0.05=5%)</label>
            <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} style={{ width: '80px' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>TYPE</label>
            <select value={optionType} onChange={(e) => setOptionType(e.target.value)} style={{ width: '80px', height: '32px' }}>
                <option value="Call">CALL</option>
                <option value="Put">PUT</option>
            </select>
        </div>

        <button onClick={calculatePricing} disabled={isCalculating} style={{ marginTop: 'auto', height: '32px' }}>
            {isCalculating ? 'PRICING...' : 'RE-PRICE'}
        </button>

      </div>

      {/* RESULTS GRID */}
      {pricing && (
        <>
            {/* 1. GREEKS ROW */}
            <div className="grid-container" style={{ marginBottom: '25px', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                <StrategyMetricCard title="THEORETICAL PRICE" value={`$${pricing.Price.toFixed(4)}`} color="var(--color-primary)" />
                <StrategyMetricCard title="DELTA (Δ)" value={pricing.Delta.toFixed(4)} color="#00d4ff" />
                <StrategyMetricCard title="GAMMA (Γ)" value={pricing.Gamma.toFixed(4)} color="#a855f7" />
                <StrategyMetricCard title="VEGA (ν)" value={pricing.Vega.toFixed(4)} color="#ffa500" />
                <StrategyMetricCard title="THETA (Θ)" value={pricing.Theta.toFixed(4)} color="#ff4444" />
            </div>

            {/* 2. MAIN PANEL: HEDGING SIMULATION */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '25px' }}>
                
                {/* LEFT: HEDGING CHART */}
                <div className="bloomberg-panel" style={{ padding: '20px', minHeight: '400px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                        <h3 style={{ fontSize: '12px', color: 'var(--text-muted)' }}>MONTE CARLO DELTA HEDGING (20 PATHS)</h3>
                        <button onClick={runSimulation} disabled={isSimulating} style={{ padding: '4px 12px', fontSize: '10px' }}>
                            {isSimulating ? 'RUNNING...' : 'RUN SIMULATION'}
                        </button>
                    </div>

                    {hedgingData ? (
                        <div style={{ height: '320px', width: '100%' }}>
                            <ResponsiveContainer key={chartKey}>
                                <LineChart data={hedgingData.chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                    <XAxis dataKey="time" stroke="var(--text-muted)" tick={{fontSize: 10}} label={{ value: 'Time (Years)', position: 'insideBottom', offset: -5, fill: '#666', fontSize: 10 }} />
                                    <YAxis stroke="var(--text-muted)" domain={['auto', 'auto']} tick={{fontSize: 10}} />
                                    <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} itemStyle={{ fontSize: '12px' }} />
                                    
                                    {/* Render a line for each path */}
                                    {Array.from({ length: hedgingData.pathCount }).map((_, i) => (
                                        <Line 
                                            key={i} 
                                            type="monotone" 
                                            dataKey={`path_${i}`} 
                                            stroke="var(--color-primary)" 
                                            strokeWidth={1} 
                                            dot={false} 
                                            strokeOpacity={0.3}
                                            isAnimationActive={true}
                                            animationDuration={1500}
                                        />
                                    ))}
                                    
                                    {/* Strike Line */}
                                    <Line type="monotone" dataKey={() => strike} stroke="#ff4444" strokeDasharray="3 3" strokeWidth={1} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                            CLICK "RUN SIMULATION" TO GENERATE PATHS
                        </div>
                    )}
                </div>

                {/* RIGHT: HEDGING METRICS */}
                <div className="bloomberg-panel" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>HEDGING PERFORMANCE</h3>
                    {hedgingData ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>MEAN HEDGING ERROR</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: hedgingData.metrics.mean_error >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                    ${hedgingData.metrics.mean_error.toFixed(4)}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>STD DEVIATION (RISK)</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#eee' }}>
                                    ${hedgingData.metrics.std_error.toFixed(4)}
                                </div>
                            </div>
                            <div style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                                <div style={{ fontSize: '10px', color: '#888' }}>SIMULATION PARAMETERS</div>
                                <div style={{ fontSize: '11px', color: '#ccc', marginTop: '5px' }}>
                                    REBALANCING: WEEKLY<br/>
                                    MODEL: BLACK-SCHOLES<br/>
                                    PATHS: 20 (VISUAL)
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                            Run simulation to see hedging error statistics.
                        </div>
                    )}
                </div>
            </div>

            {/* 3. STRESS TEST CARDS */}
            <h3 style={{ fontSize: '14px', color: 'var(--color-primary)', marginBottom: '15px', letterSpacing: '1px' }}>STRESS TESTING (SHOCK SCENARIOS)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '15px' }}>
                {stressResults && stressResults.map((scenario, i) => (
                    <div key={i} className="bloomberg-panel" style={{ 
                        padding: '15px', 
                        textAlign: 'center',
                        borderTop: scenario.pnl >= 0 ? '2px solid var(--color-success)' : '2px solid var(--color-danger)'
                    }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px' }}>{scenario.name}</div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: scenario.pnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {scenario.pnl >= 0 ? '+' : ''}{scenario.pnl.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '9px', color: '#666', marginTop: '5px' }}>
                            S: {scenario.spot.toFixed(0)} | σ: {scenario.vol.toFixed(2)}
                        </div>
                    </div>
                ))}
            </div>
        </>
      )}

    </div>
  )
}
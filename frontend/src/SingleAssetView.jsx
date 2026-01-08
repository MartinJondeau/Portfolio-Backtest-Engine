import { useState, useEffect } from 'react'
import axios from 'axios'
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function SingleAssetView() {
  const colors = ['#ff8c00', '#00ff88', '#00d4ff', '#ff4444', '#a855f7', '#ffff00', '#0059ffff', '#ec4899']

  const [watchlist, setWatchlist] = useState([
    { symbol: 'AAPL', color: colors[0] },
    { symbol: 'NVDA', color: colors[1] },
    { symbol: 'BTC-USD', color: colors[2] },
    { symbol: 'SPY', color: colors[3] }
  ])
  
  const [period, setPeriod] = useState('1y')
  const [newTicker, setNewTicker] = useState('')
  
  // assetsData holds objects: { status: 'success' | 'error', data: ..., message: ... }
  const [assetsData, setAssetsData] = useState({})
  
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  // --- SMART FETCHING LOGIC ---
  const fetchAllAssets = async () => {
    if (Object.keys(assetsData).length === 0) setLoading(true)
    
    const fetchPromises = watchlist.map(async (item) => {
      const ticker = item.symbol
      
      try {
        let rawData = []
        let usedPeriod = period // Track which period we actually used

        // 1. ATTEMPT: Try the requested period
        try {
            const response = await axios.get(`/api/asset/${ticker}?period=${period}`)
            rawData = response.data
        } catch (e) {
            console.warn(`Initial fetch failed for ${ticker} (${period}), trying fallback...`)
        }

        // 2. FALLBACK: If data is empty or request failed, try 'max'
        if (!Array.isArray(rawData) || rawData.length === 0) {
            console.log(`Switching to MAX period for ${ticker}`)
            const responseMax = await axios.get(`/api/asset/${ticker}?period=max`)
            rawData = responseMax.data
            usedPeriod = 'MAX' // Mark that we switched
        }

        // 3. FINAL CHECK: If still empty, it's a real error
        if (!Array.isArray(rawData) || rawData.length === 0) {
            throw new Error("No data available")
        }
        
        const prices = rawData.map(d => d.Close)
        
        // Sanity check for nulls
        if (prices.some(p => p === null || p === undefined)) {
             // (Optional: Filter nulls if needed, Recharts handles them mostly)
        }

        const last = prices[prices.length - 1] || 0
        const first = prices[0] || last // Safety if only 1 point
        const change = first !== 0 ? ((last - first) / first) * 100 : 0
        
        return {
          ticker,
          status: 'success', 
          // We attach the 'usedPeriod' so the UI can show a badge if it switched
          usedPeriod: usedPeriod, 
          data: {
            data: rawData,
            stats: {
              last: last.toFixed(2),
              high: Math.max(...prices).toFixed(2),
              low: Math.min(...prices).toFixed(2),
              change: change.toFixed(2),
              isPositive: change >= 0
            }
          }
        }
      } catch (err) {
        console.warn(`All attempts failed for ${ticker}`, err)
        return {
            ticker,
            status: 'error',
            message: err.response?.status === 404 ? 'SYMBOL NOT FOUND' : 'NO DATA'
        }
      }
    })

    const results = await Promise.all(fetchPromises)

    const newData = {}
    results.forEach(result => {
      if (result) newData[result.ticker] = result
    })

    setAssetsData(newData)
    setLastUpdated(new Date().toLocaleTimeString())
    setLoading(false)
  }

  useEffect(() => {
    fetchAllAssets();
    const interval = setInterval(() => fetchAllAssets(), 300000); 
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, watchlist]);

  const handleAddTicker = () => {
    const upperTicker = newTicker.toUpperCase().trim()
    if (!upperTicker) return; // Prevent empty

    if (!watchlist.some(item => item.symbol === upperTicker)) {
      const nextColor = colors[watchlist.length % colors.length]
      setWatchlist([{ symbol: upperTicker, color: nextColor }, ...watchlist])
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
    <div className="view-container">
      
      {/* --- CONTROLS --- */}
      <div className="controls" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '14px' }}>WATCHLIST</h3>
          <input 
            value={newTicker} 
            onChange={(e) => setNewTicker(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleAddTicker()}
            placeholder="ADD TICKER..."
            style={{ width: '140px' }}
          />
          <button 
            onClick={handleAddTicker} 
            style={{ 
                width: '30px',              
                height: '30px',            
                fontSize: '20px',          
                padding: 0,                 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                lineHeight: 1,             
                verticalAlign: 'middle'
            }}
            >
            +
            </button>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
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
           <div style={{ marginLeft: '15px', fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
              {loading && Object.keys(assetsData).length === 0 ? <span style={{color: 'var(--color-primary)'}}>INITIALIZING...</span> : <span>UPDATED: {lastUpdated}</span>}
           </div>
        </div>
      </div>

      {/* --- GRID --- */}
      <div className="grid-container" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))' }}>
        {watchlist.map((item) => {
          const { symbol: ticker, color } = item
          const assetState = assetsData[ticker] 
          
          // 1. SKELETON (Loading)
          if (!assetState) {
            return (
                <div key={ticker} className="bloomberg-panel">
                    <div style={{ 
                        height: '83px', 
                        borderBottom: '1px solid var(--border-subtle)', 
                        background: `linear-gradient(90deg, ${color}10, transparent)`,
                        display: 'flex', alignItems: 'center', padding: '0 20px'
                    }}>
                        <span style={{ color: color, fontSize: '22px', opacity: 0.5 }}>{ticker}</span>
                    </div>
                    <div style={{ aspectRatio: '20/9', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <div style={{
                            width: '40px', height: '40px',
                            border: `3px solid ${color}`,
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite'
                        }}>
                            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                        </div>
                    </div>
                </div>
            )
          }

          // 2. ERROR (Invalid)
          if (assetState.status === 'error') {
            return (
                <div key={ticker} className="bloomberg-panel" style={{ border: '1px solid var(--color-danger)' }}>
                    <div style={{ 
                        height: '83px', 
                        borderBottom: '1px solid var(--color-danger)', 
                        background: 'rgba(255, 68, 68, 0.05)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px'
                    }}>
                        <h3 style={{ margin: 0, color: 'var(--color-danger)', fontSize: '22px', textDecoration: 'line-through' }}>{ticker}</h3>
                        <span style={{ fontSize: '12px', color: 'var(--color-danger)', fontWeight: 'bold' }}>{assetState.message}</span>
                    </div>
                    
                    <div style={{ aspectRatio: '20/9', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
                        <span style={{ fontSize: '40px' }}>⚠️</span>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
                            Could not retrieve data.<br/>Check spelling or API status.
                        </div>
                        <button 
                            onClick={() => handleRemoveTicker(ticker)} 
                            style={{ 
                                background: 'var(--color-danger-bg)', 
                                border: '1px solid var(--color-danger)',
                                color: 'var(--color-danger)',
                                padding: '8px 16px',
                                fontSize: '11px'
                            }}
                        >
                            REMOVE CARD
                        </button>
                    </div>
                </div>
            )
          }

          // 3. SUCCESS (With optional fallback Badge)
          const asset = assetState.data; 
          const isFallback = assetState.usedPeriod === 'MAX';

          return (
            <div key={ticker} className="bloomberg-panel">
              {/* Card Header */}
              <div style={{ 
                padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: `linear-gradient(90deg, ${color}10, transparent)` 
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ margin: 0, color: color, fontSize: '22px' }}>{ticker}</h3>
                    <span style={{ 
                      fontSize: '16px', fontWeight: 'bold', fontFamily: 'var(--font-mono)',
                      color: asset.stats.isPositive ? 'var(--color-success)' : 'var(--color-danger)' 
                    }}>
                      {asset.stats.isPositive ? '▲' : '▼'} {asset.stats.change}%
                    </span>
                    {/* Badge if we used Fallback Period */}
                    {isFallback && (
                        <span style={{ 
                            fontSize: '9px', 
                            background: '#333', 
                            color: '#fff', 
                            padding: '2px 4px', 
                            borderRadius: '2px',
                            fontFamily: 'var(--font-ui)',
                            marginLeft: '5px'
                        }}>
                            MAX AVAIL.
                        </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    LAST: <span style={{ color: 'var(--text-main)', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>${asset.stats.last}</span>
                  </div>
                </div>
                
                <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  <div>HIGH: <span style={{ color: 'var(--text-main)' }}>{asset.stats.high}</span></div>
                  <div>LOW: <span style={{ color: 'var(--text-main)' }}>{asset.stats.low}</span></div>
                  <button 
                    onClick={() => handleRemoveTicker(ticker)} 
                    style={{ 
                      marginTop: '5px', background: 'none', border: 'none', 
                      color: '#444', padding: 0, fontSize: '10px', textDecoration: 'underline' 
                    }}
                  >
                    REMOVE
                  </button>
                </div>
              </div>

              {/* Chart */}
              <div style={{ aspectRatio: '20/9', width: '100%', padding: '10px' }}>
                <ResponsiveContainer>
                  <AreaChart data={asset.data}>
                    <defs>
                      <linearGradient id={`grad${ticker}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={color} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                    <XAxis dataKey="Date" hide={true} />
                    <YAxis domain={['auto', 'auto']} hide={false} orientation="right" tick={{fill: '#666', fontSize: 10}} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111', border: `1px solid ${color}` }} 
                      itemStyle={{ color: color }} 
                      labelStyle={{ display: 'none' }} 
                      formatter={(val) => [`$${val.toFixed(2)}`, 'Price']} 
                    />
                    
                    <Area 
                        type="monotone" 
                        dataKey="Close" 
                        stroke={color} 
                        strokeWidth={2} 
                        fill={`url(#grad${ticker})`} 
                        isAnimationActive={true} 
                        animationDuration={1500} 
                    />
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
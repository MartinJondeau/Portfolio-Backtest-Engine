import { useState, useEffect } from 'react'
import axios from 'axios'
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function SingleAssetView() {
  // Neon Color Palette
  const colors = ['#ff8c00', '#00ff88', '#00d4ff', '#ff4444', '#d264ff', '#ffff00']

  const [watchlist, setWatchlist] = useState([
    { symbol: 'AAPL', color: colors[0] },
    { symbol: 'NVDA', color: colors[1] },
    { symbol: 'BTC-USD', color: colors[2] },
    { symbol: 'SPY', color: colors[3] }
  ])
  
  const [period, setPeriod] = useState('1y')
  const [newTicker, setNewTicker] = useState('')
  const [assetsData, setAssetsData] = useState({})
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  // --- FETCHING LOGIC ---
  const fetchAllAssets = async () => {
    if (Object.keys(assetsData).length === 0) setLoading(true)
    
    const newData = { ...assetsData }

    for (const item of watchlist) {
      const ticker = item.symbol
      try {
        const response = await axios.get(`/api/asset/${ticker}?period=${period}`)
        const rawData = response.data
        
        const prices = rawData.map(d => d.Close)
        const last = prices[prices.length - 1]
        const first = prices[0]
        const change = ((last - first) / first) * 100
        
        newData[ticker] = {
          data: rawData,
          stats: {
            last: last.toFixed(2),
            high: Math.max(...prices).toFixed(2),
            low: Math.min(...prices).toFixed(2),
            change: change.toFixed(2),
            isPositive: change >= 0
          }
        }
        setAssetsData({ ...newData })
        await new Promise(r => setTimeout(r, 200)); 

      } catch (err) {
        console.error(`Failed to fetch ${ticker}`, err)
      }
    }

    setLastUpdated(new Date().toLocaleTimeString())
    setLoading(false)
  }

  // --- EFFECTS ---
  useEffect(() => {
    fetchAllAssets();
    const interval = setInterval(() => fetchAllAssets(), 300000); 
    return () => clearInterval(interval);
  }, [period, watchlist]);

  // --- HANDLERS ---
  const handleAddTicker = () => {
    const upperTicker = newTicker.toUpperCase().trim()
    if (upperTicker && !watchlist.some(item => item.symbol === upperTicker)) {
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
              {loading ? <span style={{color: 'var(--color-primary)'}}>UPDATING...</span> : <span>UPDATED: {lastUpdated}</span>}
           </div>
        </div>
      </div>

      {/* --- GRID --- */}
      <div className="grid-container" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))' }}>
        {watchlist.map((item) => {
          const { symbol: ticker, color } = item
          const asset = assetsData[ticker]
          
          if (!asset) return null 

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
                    <Area type="monotone" dataKey="Close" stroke={color} strokeWidth={2} fill={`url(#grad${ticker})`} />
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
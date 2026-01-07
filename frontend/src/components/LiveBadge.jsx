import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export default function LiveBadge({ ticker, isLive = true }) {
    const [quote, setQuote] = useState(null);
    const [error, setError] = useState(false);
    
    // Track first load to avoid "Loading..." flash on updates
    const isFirstLoad = useRef(true);
    
    // --- DEBOUNCE LOGIC (Keeps your typing smooth) ---
    const [debouncedTicker, setDebouncedTicker] = useState(ticker);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedTicker(ticker);
        }, 1000); // 1 second delay
        return () => clearTimeout(handler);
    }, [ticker]);

    // --- FETCH LOGIC ---
    const fetchQuote = async () => {
        if (!debouncedTicker) return; 
        try {
            setError(false);
            const res = await axios.get(`/api/asset/${debouncedTicker}/realtime`);
            setQuote(res.data);
            isFirstLoad.current = false;
        } catch (err) {
            console.error("LiveBadge Fetch Error:", err);
            setError(true);
        }
    };

    useEffect(() => {
        fetchQuote();   
    }, [debouncedTicker]); 

    useEffect(() => {
        if (isLive) {
            const interval = setInterval(fetchQuote, 60000); 
            return () => clearInterval(interval);
        }
    }, [isLive, debouncedTicker]); 

    // --- RENDER LOGIC ---

    const badgeStyle = {
        // KEY CHANGE: Dynamic Width
        display: 'inline-flex',     // Shrink-wraps content, but allows growth
        width: 'auto',              // Allows expansion
        minWidth: '300px',          // Prevents it from being too small
        height: '80px',                 
        alignItems: 'center', 
        padding: '0 16px',      
        background: 'var(--bg-surface)',    
        border: '1px solid var(--border-subtle)', 
        borderRadius: '2px',                
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
        boxSizing: 'border-box',
        whiteSpace: 'nowrap'
    };

    if (error) return (
        <div style={{ ...badgeStyle, borderColor: 'var(--color-danger)', borderLeft: '4px solid var(--color-danger)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>INVALID TICKER</span>
        </div>
    );

    if (!quote && isFirstLoad.current) return (
        <div style={{ ...badgeStyle }}>
             <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: '100%', textAlign: 'center' }}>
                INITIALIZING...
             </span>
        </div>
    );

    if (!quote) return null; 
    
    const isPositive = quote.change >= 0;
    const color = isPositive ? 'var(--color-success)' : 'var(--color-danger)';
    const containerOpacity = isLive ? 1 : 0.7;

    // Optional: You can keep the dynamic font, or set a fixed large size since the box now grows.
    // I've kept it slightly dynamic for aesthetics.
    const txtLen = quote.symbol.length;
    const dynamicFontSize = Math.max(20, Math.min(28, 200 / txtLen)) + 'px';

    return (
        <div style={{ 
            ...badgeStyle,
            borderLeft: `4px solid ${isLive ? color : 'var(--text-muted)'}`, 
            opacity: containerOpacity,
            transition: 'opacity 0.3s, border-left 0.3s',
            justifyContent: 'space-between',
            gap: '16px' // Adds consistent spacing between flex elements
        }}>
            
            {/* LEFT: TICKER (Determines width) */}
            <div style={{ 
                fontFamily: 'var(--font-ticker)', 
                fontWeight: '700', 
                fontSize: dynamicFontSize, 
                color: 'var(--text-main)',
                letterSpacing: '-0.5px',
                whiteSpace: 'nowrap'
            }}>
                {quote.symbol}
            </div>

            {/* DIVIDER */}
            <div style={{ width: '1px', height: '32px', background: 'var(--border-subtle)', flexShrink: 0 }}></div>

            {/* MIDDLE: PRICE (Auto width) */}
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'flex-start',
                flexShrink: 0
            }}>
                <div style={{ 
                    fontFamily: 'var(--font-price)', 
                    fontSize: '22px',
                    fontWeight: '700', 
                    color: 'var(--text-main)',
                    lineHeight: '1',
                    marginBottom: '4px'
                }}>
                    ${quote.price}
                </div>
                <div style={{ 
                    fontFamily: 'var(--font-mono)', 
                    color: isLive ? color : 'var(--text-muted)', 
                    fontSize: '13px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap'
                }}>
                    {isPositive ? '▲' : '▼'} {quote.change}
                </div>
            </div>
            
            {/* RIGHT: STATUS (Strictly Fixed) */}
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'flex-end', 
                width: '70px',      // Fixed width
                flexShrink: 0       // Never shrink
            }}>
                <div style={{ 
                    fontSize: '10px', 
                    color: isLive ? 'var(--color-success)' : 'var(--color-primary)', 
                    fontFamily: 'var(--font-mono)', 
                    letterSpacing: '1px',
                    fontWeight: 'bold'
                }}>
                     {isLive ? '● LIVE' : '⏸ PAUSED'}
                </div>
                
                <div style={{ 
                    fontSize: '9px', 
                    color: 'var(--text-muted)', 
                    marginTop: '2px', 
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'nowrap'
                }}>
                    {quote.last_updated || '00:00:00'}
                </div>
            </div>
        </div>
    );
}
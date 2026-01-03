// frontend/src/LiveBadge.jsx

import { useState, useEffect } from 'react';
import axios from 'axios';

export default function LiveBadge({ ticker }) {
    const [quote, setQuote] = useState(null);
    const [error, setError] = useState(false); // New Error State

    const fetchQuote = async () => {
        try {
            setError(false);
            const res = await axios.get(`http://127.0.0.1:8001/api/asset/${ticker}/realtime`);
            setQuote(res.data);
        } catch (err) {
            console.error(err);
            setError(true); // Trigger error mode
        }
    };

    useEffect(() => {
        fetchQuote(); 
        const interval = setInterval(fetchQuote, 60000); // 60s is better than 5s for rate limits
        return () => clearInterval(interval); 
    }, [ticker]);

    // Handle Error State in UI
    if (error) return (
        <div style={{ padding: '10px 20px', background: '#333', color: '#ff6b6b', borderRadius: '12px', border: '1px solid #ff6b6b' }}>
            Invalid Ticker
        </div>
    );

    if (!quote) return <div style={{ color: '#888' }}>Loading...</div>;
    const isPositive = quote.change >= 0;
    const color = isPositive ? '#4CAF50' : '#F44336';

    return (
        <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '15px', 
            padding: '10px 20px', 
            background: '#222', 
            borderRadius: '12px',
            color: 'white',
            border: `1px solid ${color}`,
            marginBottom: '20px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)' 
        }}>
            {/* 1. Symbol */}
            <h2 style={{ margin: 0 }}>{quote.symbol}</h2>

            {/* 2. Middle Section: Price & Time Stacked */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', lineHeight: '1' }}>
                    ${quote.price}
                </div>
                <span style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                    Updated: {quote.last_updated}
                </span>
            </div>

            {/* 3. Change % */}
            <div style={{ color: color, fontWeight: 'bold', fontSize: '18px' }}>
                {isPositive ? '+' : ''}{quote.change} ({isPositive ? '+' : ''}{quote.pct_change}%)
            </div>
        </div>
    );
}
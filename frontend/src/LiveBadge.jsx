import { useState, useEffect } from 'react';
import axios from 'axios';

export default function LiveBadge({ ticker }) {
    const [quote, setQuote] = useState(null);

    const fetchQuote = async () => {
        try {
            const res = await axios.get(`http://127.0.0.1:8001/api/asset/${ticker}/realtime`);
            setQuote(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchQuote(); // Run immediately
        const interval = setInterval(fetchQuote, 5000); // Refresh every 5 seconds
        return () => clearInterval(interval); // Cleanup on close
    }, [ticker]);

    if (!quote) return <div className="badge loading">Loading...</div>;

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
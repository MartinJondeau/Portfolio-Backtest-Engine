import { useState, useEffect } from 'react';
import axios from 'axios';

export default function LiveBadge({ ticker }) {
    const [quote, setQuote] = useState(null);

    const fetchQuote = async () => {
        try {
            const res = await axios.get(`http://127.0.0.1:8001/api/quote/${ticker}`);
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
            marginBottom: '20px'
        }}>
            <h2 style={{ margin: 0 }}>{quote.symbol}</h2>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                ${quote.price}
            </div>
            <div style={{ color: color, fontWeight: 'bold' }}>
                {isPositive ? '+' : ''}{quote.change} ({isPositive ? '+' : ''}{quote.pct_change}%)
            </div>
        </div>
    );
}
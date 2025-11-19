import { useState } from 'react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css'

function App() {
  const [ticker, setTicker] = useState('AAPL')
  const [data, setData] = useState([])

  const fetchData = async () => {
    try {
      // Comm with Python Backend
      const response = await axios.get(`http://127.0.0.1:8001/api/asset/${ticker}`)
      setData(response.data)
    } catch (error) {
      console.error("Error fetching data:", error)
    }
  }

  return (
    <div style={{ width: '100%', padding: '20px' }}>
      <h1>Quant Dashboard (React + Python)</h1>
      
      <div className="controls">
        <input 
          value={ticker} 
          onChange={(e) => setTicker(e.target.value)} 
          placeholder="Enter Ticker" 
        />
        <button onClick={fetchData}>Load Asset</button>
      </div>

      <div style={{ width: '100%', height: 400, marginTop: '20px' }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="Date" />
            <YAxis domain={['auto', 'auto']} />
            <Tooltip />
            <Line type="monotone" dataKey="Close" stroke="#8884d8" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default App
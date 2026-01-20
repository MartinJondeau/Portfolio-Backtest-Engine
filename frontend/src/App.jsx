import { useState } from 'react'
import OptionsView from './OptionsView'
import Clock from './components/Clock'
import './App.css'

function App() {
  // Since there is only one view, we don't strictly need state for tabs,
  // but keeping the structure allows you to add more "Option" related tabs later (e.g. Vol Surface)
  const [activeTab, setActiveTab] = useState('options')

  return (
    <div className="app-container">
      {/* --- HEADER --- */}
      <header className="bloomberg-header">
        <div className="brand-section">
          <div className="neon-bar"></div>
          <div>
            <h1 className="brand-title">OPTION PRICING PLATFORM</h1>
            <p className="brand-subtitle">Quantitative Risk Management</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Clock />
          {/* You can keep or remove the report button depending on if you want PDF/Excel exports for options */}
          <button 
            className="btn-download"
            onClick={() => alert("Export feature coming soon for Options data")}
          >
            EXPORT DATA
          </button>
        </div>
      </header>

      {/* --- NAVIGATION --- */}
      <nav className="main-nav">
        {[
          { id: 'options', label: 'PRICING & HEDGING' },
          // You can add more option-specific tabs here later, e.g.:
          // { id: 'surface', label: 'VOLATILITY SURFACE' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* --- MAIN CONTENT --- */}
      <main className="main-content">
        <div style={{ display: activeTab === 'options' ? 'block' : 'none', height: '100%' }}>
          <OptionsView />
        </div>
      </main>

      {/* --- FOOTER --- */}
      <footer className="app-footer">
        ESILV © 2026 | PI² Team 406 - OPTION PRICING ENGINE
      </footer>
    </div>
  )
}

export default App
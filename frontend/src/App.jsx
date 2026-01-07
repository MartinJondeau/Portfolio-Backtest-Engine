import { useState } from 'react'
import SingleAssetView from './SingleAssetView'
import StrategiesView from './StrategiesView'
import PortfolioView from './PortfolioView'
import Clock from './components/Clock'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('single')

  return (
    <div className="app-container">
      {/* --- HEADER --- */}
      <header className="bloomberg-header">
        <div className="brand-section">
          <div className="neon-bar"></div>
          <div>
            <h1 className="brand-title">HADES PLATFORM INTELLIGENCE</h1>
            <p className="brand-subtitle">Quantitative Portfolio Analytics</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Clock />
          <button 
            className="btn-download"
            onClick={() => window.open('/api/report/download', '_blank')}
          >
            EXCEL REPORT
          </button>
        </div>
      </header>

      {/* --- NAVIGATION --- */}
      <nav className="main-nav">
        {[
          { id: 'single', label: 'ASSET VIEW' }, 
          { id: 'strategies', label: 'STRATEGY BACKTEST' },
          { id: 'portfolio', label: 'PORTFOLIO MANAGEMENT' }
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
        {/* We use distinct mounts (display: none) to preserve state when switching tabs */}
        <div style={{ display: activeTab === 'single' ? 'block' : 'none', height: '100%' }}>
          <SingleAssetView />
        </div>

        <div style={{ display: activeTab === 'strategies' ? 'block' : 'none', height: '100%' }}>
          <StrategiesView />
        </div>

        <div style={{ display: activeTab === 'portfolio' ? 'block' : 'none', height: '100%' }}>
          <PortfolioView />
        </div>
      </main>

      {/* --- FOOTER --- */}
      <footer className="app-footer">
        HADES © 2026 | ADRIEN BAYRE & MARTIN JONDEAU - PORTFOLIO BACKTEST ENGINE
      </footer>
    </div>
  )
}

export default App
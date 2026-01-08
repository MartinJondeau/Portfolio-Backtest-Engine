# Portfolio Backtest Engine & Quant Dashboard

A full-stack quantitative finance platform designed to backtest trading strategies, monitor live market data, and generate automated risk reports. Built with **FastAPI (Python)** for the calculation engine and **React (Vite)** for the interactive dashboard.

## Key Features

### 1. Advanced Strategy Backtesting
- **Classic Strategies:** SMA Crossover & Mean Reversion (Bollinger / Z-Score) with dynamic parameter tuning.
- **Machine Learning:** Random Forest Trend Follower with **Hybrid Logic** (Buy & Hold during training phase → AI predictions for out-of-sample testing).
- **Forecasting:** AI-powered price forecasting with **95% Confidence Intervals** (Cone Charts).
- **Metrics:** Sharpe Ratio, Max Drawdown, Annualized Volatility, Total Return.

### 2. Dynamic Portfolio Construction
- **Multi-Asset Simulation:** Custom portfolios with mixed strategies per asset (e.g. AAPL on SMA, MSFT on Random Forest).
- **Allocation Control:** Interactive sliders for **Custom Weighting** or auto-normalization (Equal Weights).
- **Rebalancing:** Monthly, Quarterly, Yearly, or No Rebalancing.
- **Correlation Matrix:** Real-time heatmap to analyze diversification and correlation risk.

### 3. Reality Simulation (P&L)
- **Historical Simulation:** Exact Profit & Loss computation from historical performance.
- **Smart Date Constraints:** Prevents invalid date selection outside backtest ranges.
- **Visual Feedback:** Clear *Invested vs Final Value* breakdown with color-coded P&L indicators.

### 4. Live Market Monitoring
- **Real-time Data:** Live price updates with 60s caching to avoid API rate limits.
- **Asset View:** Watchlist with daily % change and last update timestamps.

### 5. Automated Reporting System
- **Daily Cron Job:** `daily_report.py` runs automatically at 20:00 to analyze portfolio risk.
- **JSON Archiving:** Daily volatility and drawdown snapshots saved to `/reports`.

---

## Tech Stack

- **Backend:** Python 3.10+, FastAPI, Pandas, NumPy, **Scikit-Learn**, yFinance  
- **Frontend:** React 18, Vite, **Recharts**, Axios  
- **DevOps:** Git Feature Branch Workflow, Bash Automation (Cron)

---

## Installation & Setup

### Prerequisites
- Node.js & npm
- Python 3.10+

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/Portfolio-Backtest-Engine.git
cd Portfolio-Backtest-Engine
````

### 2. Backend Setup

```bash
cd backend
python -m venv venv

# Activate virtual environment
# Windows
.\venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
```

---

## How to Run the Application

Run backend and frontend in **two separate terminals**.

### Terminal 1 — Backend

```bash
cd backend
.\venv\Scripts\activate
python -m uvicorn main:app --reload --port 8001
```

API available at: `http://127.0.0.1:8001`

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

Dashboard available at: `http://localhost:5173`

---

## Automation & Reporting

### Manual Execution

```bash
cd backend
python daily_report.py
```

Output: `reports/YYYY-MM-DD_daily_report.json`

### Automated Setup (Linux / AWS)

```bash
chmod +x setup_cron.sh
./setup_cron.sh
```

---

## API Documentation

| Method | Endpoint                             | Description                                          |
| ------ | ------------------------------------ | ---------------------------------------------------- |
| POST   | `/api/portfolio/backtest-strategies` | Complex backtest with different strategies per asset |
| POST   | `/api/portfolio/correlation`         | Correlation matrix for selected assets               |
| GET    | `/api/forecast/ml/{ticker}`          | Price forecasts with confidence intervals            |
| GET    | `/api/backtest/ml/{ticker}`          | Random Forest backtest (out-of-sample)               |
| GET    | `/api/backtest/sma/{ticker}`         | SMA backtest with custom windows                     |
| GET    | `/api/asset/{ticker}/realtime`       | Live price with 60s caching                          |
| POST   | `/api/reports/generate`              | Trigger report generation                            |

---

## License

Project created for **ESILV – Finance Department**
**Authors:** Adrien BAYRE & Martin JONDEAU

```
```

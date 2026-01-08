# 📈 Portfolio Backtest Engine & Quant Dashboard

A full-stack quantitative finance platform designed to backtest trading strategies, monitor live market data, and generate automated risk reports. Built with **FastAPI (Python)** for the calculation engine and **React (Vite)** for the interactive dashboard.

## 🚀 Key Features

### 1. Advanced Backtesting Engine
* **Strategies:** SMA Crossover & Mean Reversion (Bollinger/Z-Score).
* **Metrics:** Calculates Sharpe Ratio, Max Drawdown, Annualized Volatility, and Total Return.
* **Interactive Controls:** Custom timeframes (Daily/Weekly) and dynamic parameters (Window sizes, Z-Thresholds).

### 2. Live Market Monitoring
* **Real-time Data:** Live price updates with caching (60s validity) to prevent API rate limits.
* **Asset View:** Watchlist tracking with daily change % and timestamps.

### 3. Automated Reporting System
* **Daily Cron Job:** A script (`daily_report.py`) runs automatically at 20:00 to analyze portfolio risk.
* **JSON Archiving:** Saves daily volatility and drawdown snapshots to a `/reports` directory.
* **On-Demand:** Trigger reports manually via the API.

---

## 🛠️ Tech Stack

* **Backend:** Python 3.10+, FastAPI, Pandas, NumPy, YFinance.
* **Frontend:** React 18, Vite, Recharts, Axios.
* **DevOps:** Git Feature Branch Workflow, Bash Automation (Cron).

---

## ⚙️ Installation & Setup

### Prerequisites
* Node.js & npm
* Python 3.8+

### 1. Clone the Repository
```bash
git clone [https://github.com/YOUR_USERNAME/Portfolio-Backtest-Engine.git](https://github.com/YOUR_USERNAME/Portfolio-Backtest-Engine.git)
cd Portfolio-Backtest-Engine

```

### 2. Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate venv
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

```

### 3. Frontend Setup

```bash
# Navigate to frontend
cd ../frontend

# Install node modules
npm install

```

---

## 🖥️ How to Run the Application

You must run the Backend and Frontend in **two separate terminal windows**.

**Terminal 1: Python Backend**

```bash
cd backend
.\venv\Scripts\activate
python -m uvicorn main:app --reload --port 8001

```

*API will run at: https://www.google.com/search?q=http://127.0.0.1:8001*

**Terminal 2: React Frontend**

```bash
cd frontend
npm run dev

```

*Dashboard will open at: http://localhost:5173*

---

## 📊 Automation & Reporting

The system includes a standalone script for daily risk analysis.

### Manual Execution

To generate a report immediately:

```bash
cd backend
python daily_report.py

```

*Output: `reports/YYYY-MM-DD_daily_report.json*`

### Automated Setup (Linux/AWS)

To schedule the report for 20:00 daily:

```bash
chmod +x setup_cron.sh
./setup_cron.sh

```

---

## 🔌 API Documentation

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/asset/{ticker}/realtime` | Get live price with caching (60s). |
| `GET` | `/api/backtest/sma/{ticker}` | Run SMA Strategy with custom windows. |
| `GET` | `/api/backtest/mean-reversion/{ticker}` | Run Z-Score Mean Reversion strategy. |
| `GET` | `/api/reports/latest` | Retrieve the most recent risk report. |
| `POST` | `/api/reports/generate` | Trigger background report generation. |

---

## 🤝 Contribution Workflow

We follow a strict **Feature Branch Workflow**:

1. **Never commit to main directly.**
2. Create a branch: `git checkout -b feature/my-new-feature`
3. Commit changes: `git add .` then `git commit -m "Added X"`
4. Push: `git push -u origin feature/my-new-feature`
5. Open a Pull Request (PR) on GitHub.

---

## 📝 License

Project created for **ESILV - Finance Department**.
*Authors: Adrien BAYRE & Martin JONDEAU*

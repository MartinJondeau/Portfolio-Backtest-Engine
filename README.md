# FOR THE TEACHER (ACTUAL README STARTS BELOW)

To summarize the project (for testing and evaluation purposes only, **not** documentation), we deliberately placed a strong emphasis on **infrastructure and reliability**. While there are clear opportunities to improve code structure and modularity, the primary focus was not on deploying highly sophisticated strategies.

That said, the application currently supports testing the following strategies:
- Buy & Hold  
- Golden Cross  
- Mean Reversion  
- Random Forest Classifier (test period / out-of-sample only)  

A small forecasting module is also included.

The **portfolio construction** page is designed to give full control over strategy allocation. It is intended as a **second step**, to be used *after* evaluating strategies on individual assets.

### Random Forest Strategy Notes

We recommend testing the **Random Forest Classifier** on **cryptocurrencies**, as they tend to exhibit strong trending behavior. Our backtests suggest that, across multiple time frames and crypto assets, the strategy appears to consistently outperform simpler benchmarks.

In the **portfolio view**, the Random Forest strategy is only meaningful on the **test set**, as applying it on the training data would introduce severe bias. To address this while maintaining visual continuity, we imputed performance as follows:
- **70% (training period)** → Buy & Hold  
- **30% (test period)** → Actual Random Forest model performance  

This approach ensures a smooth performance curve but does **not** represent the Random Forest strategy applied over the entire time horizon.

We chose this method over alternatives such as extending the lookback period, because many assets (particularly cryptocurrencies and newer ETFs) have been listed for less than 5–10 years. In such cases, a long enough historical window to properly train and test a Random Forest model simply does not exist.

### Potential Future Improvements

During the design and development of the application, we identified quite a few areas for improvement:

- A more **modular and atomic code structure**, as some functions currently handle multiple responsibilities instead of strictly adhering to their intended scope.
- A **paper trading module** incorporating transaction costs, allowing users to test strategies live before deploying real capital and improving robustness assessment.
- Additional **portfolio optimization methods**, such as:
  - Minimum variance
  - Maximum Sharpe ratio
  - Maximum expected return
- Enhanced UI elements to improve usability and overall user experience.

Here is a small guide to find the right tickers on yfinance, even though we handle undefined ticker cases, it is useful for testing purposes (from ChatGPT):

## Supported Tickers in `yfinance` (Yahoo Finance)

`yfinance` does **not** define its own list of tickers.  
It is a Python wrapper around **Yahoo Finance**, meaning:

> **Any symbol that exists on Yahoo Finance _can_ be queried with `yfinance`.**  
> If a ticker is not recognized by Yahoo Finance, `yfinance` will return *invalid*.

There is **no official exhaustive ticker list shipped with `yfinance`**.  
Tickers must follow **Yahoo Finance naming conventions**, which depend on the asset class and exchange.

---

## 1️⃣ US Stocks & ETFs

**Format:**  
```

TICKER

```

**Examples:**
```

AAPL     MSFT     TSLA
SPY      QQQ      VOO

```

Includes:
- NYSE / NASDAQ / AMEX stocks
- ETFs
- Some mutual funds (often ending with `X`, e.g. `VTSAX`)

---

## 2️⃣ International Stocks (Exchange Suffix Required)

For **non-US equities**, Yahoo Finance requires an **exchange suffix**:

```

<BASE_SYMBOL>.<EXCHANGE_SUFFIX>

```

### Common exchange suffixes

| Market | Suffix | Example |
|------|------|--------|
| France (Euronext Paris) | `.PA` | `MC.PA` (LVMH) |
| UK (London Stock Exchange) | `.L` | `HSBA.L` |
| Germany (XETRA) | `.DE` | `BMW.DE` |
| Spain (Madrid) | `.MC` | `ITX.MC` |
| Canada (TSX) | `.TO` | `RY.TO` |
| Australia (ASX) | `.AX` | `BHP.AX` |
| India (NSE) | `.NS` | `RELIANCE.NS` |
| Hong Kong | `.HK` | `0700.HK` |

⚠️ **Example:**  
Typing `LVMH` fails because it is **not a US ticker**.  
The correct Yahoo Finance ticker is:

```

MC.PA

```

---

## 3️⃣ Stock Indices

**Format:**  
```

^INDEX

```

**Examples:**
```

^GSPC   (S&P 500)
^DJI    (Dow Jones)
^IXIC   (NASDAQ Composite)
^FTSE   (FTSE 100)
^N225   (Nikkei 225)

```

Notes:
- Indices return price data but not full fundamentals
- Caret (`^`) is mandatory

---

## 4️⃣ Forex (FX Rates)

**Format:**  
```

BASEQUOTE=X

```

**Examples:**
```

EURUSD=X
GBPUSD=X
USDJPY=X

```

⚠️ Without `=X`, the ticker is invalid.

---

## 5️⃣ Cryptocurrencies

**Format:**  
```

CRYPTO-FIAT

```

**Examples:**
```

BTC-USD
ETH-USD
SOL-USD
DOGE-EUR

```

---

## 6️⃣ Futures & Commodities

**Format:**  
```

SYMBOL=F

```

**Examples:**
```

CL=F   (Crude Oil)
GC=F   (Gold)
SI=F   (Silver)

```

Notes:
- Data availability varies by contract
- Not all futures are reliable via Yahoo Finance

---

## 7️⃣ Bonds & Interest Rates

**Examples:**
```

^TNX   (US 10Y Treasury Yield)
^IRX   (13-Week T-Bill)

```

These are **rates/yields**, not tradeable equities.

---

## ❌ What Is NOT Reliably Supported

- Options chains as standalone tickers
- Exotic derivatives
- Custom symbols not listed on Yahoo Finance

---

## 🔍 How to Find the Correct Ticker

1. Search the asset on **Yahoo Finance**
2. Copy the exact ticker shown (including suffix)
3. Use that ticker in `yfinance`

There is **no automatic way** to retrieve *all* valid tickers from `yfinance`.

---

## ✅ Summary

- `yfinance` supports **all Yahoo Finance tickers**
- **US stocks** → no suffix
- **International stocks** → exchange suffix required
- **Indices** → start with `^`
- **FX** → end with `=X`
- **Crypto** → `-USD`, `-EUR`, etc.
- **Futures** → end with `=F`

If Yahoo Finance recognizes the symbol, `yfinance` can usually fetch it.

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

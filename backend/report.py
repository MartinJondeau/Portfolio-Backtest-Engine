import yfinance as yf
import pandas as pd
import numpy as np
import json
import os
from datetime import datetime

# 1. Configuration
WATCHLIST = ["AAPL", "NVDA", "MSFT", "TSLA", "BTC-USD"]
REPORTS_DIR = "reports"

def calculate_metrics(df):
    """Calculates Volatility and Max Drawdown for a single asset"""
    # Daily Returns
    df['Return'] = df['Close'].pct_change()
    
    # Volatility (Annualized)
    volatility = df['Return'].std() * np.sqrt(252)
    
    # Max Drawdown
    cumulative = (1 + df['Return']).cumprod()
    running_max = cumulative.cummax()
    drawdown = (cumulative - running_max) / running_max
    max_drawdown = drawdown.min()
    
    return volatility, max_drawdown

def generate_daily_report():
    # Create folder if not exists
    if not os.path.exists(REPORTS_DIR):
        os.makedirs(REPORTS_DIR)

    report_data = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "assets": []
    }

    print(f"📊 Generating Report for {len(WATCHLIST)} assets...")

    for ticker in WATCHLIST:
        try:
            # Get 1 year of data
            df = yf.download(ticker, period="1y", interval="1d", progress=False)
            # Handle None response or empty DataFrame
            if df is None or df.empty:
                print(f"No data for {ticker}, skipping...")
                continue            
            # Handle MultiIndex if present
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)

            # Get Open/Close of the LAST available day
            last_day = df.iloc[-1]
            price_close = float(last_day['Close'])
            price_open = float(last_day['Open'])
            
            # Calculate Risk Metrics
            volatility, max_drawdown = calculate_metrics(df)

            asset_report = {
                "ticker": ticker,
                "price_open": round(price_open, 2),
                "price_close": round(price_close, 2),
                "change_pct": round(((price_close - price_open) / price_open) * 100, 2),
                "volatility": round(volatility * 100, 2), # In %
                "max_drawdown": round(max_drawdown * 100, 2) # In %
            }
            report_data["assets"].append(asset_report)
            print(f"✅ Processed {ticker}")

        except Exception as e:
            print(f"❌ Error {ticker}: {e}")

    # Save to JSON
    filename = f"{REPORTS_DIR}/{datetime.now().strftime('%Y-%m-%d')}_daily_report.json"
    with open(filename, "w") as f:
        json.dump(report_data, f, indent=4)
    
    print(f"💾 Report saved to {filename}")

if __name__ == "__main__":
    generate_daily_report()
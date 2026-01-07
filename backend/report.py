import yfinance as yf
import pandas as pd
import numpy as np
import json
from datetime import datetime
from pathlib import Path

# --- CONFIGURATION (Dynamic Path for Server/Local compatibility) ---
WATCHLIST = ["AAPL", "NVDA", "MSFT", "TSLA", "BTC-USD"]
BASE_DIR = Path(__file__).resolve().parent
REPORTS_DIR = BASE_DIR / "reports"


def calculate_metrics(df):
    """Calculates Volatility and Max Drawdown"""
    df["Return"] = df["Close"].pct_change()
    volatility = df["Return"].std() * np.sqrt(252)
    cumulative = (1 + df["Return"]).cumprod()
    running_max = cumulative.cummax()
    drawdown = (cumulative - running_max) / running_max
    max_drawdown = drawdown.min()
    return volatility, max_drawdown


def generate_daily_report():
    """Generates JSON & Excel reports and returns the Excel file path"""
    # Create folder if not exists
    REPORTS_DIR.mkdir(exist_ok=True)

    report_data = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "assets": [],
    }

    print(f"📊 Generating Report for {len(WATCHLIST)} assets...")

    for ticker in WATCHLIST:
        try:
            # Get 1 year of data
            df = yf.download(ticker, period="1y", interval="1d", progress=False)

            if df is None or df.empty:
                print(f"No data for {ticker}, skipping...")
                continue

            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)

            last_day = df.iloc[-1]
            price_close = float(last_day["Close"])
            price_open = float(last_day["Open"])

            volatility, max_drawdown = calculate_metrics(df)

            asset_report = {
                "Ticker": ticker,
                "Price Open": round(price_open, 2),
                "Price Close": round(price_close, 2),
                "Change (%)": round(((price_close - price_open) / price_open) * 100, 2),
                "Volatility (Ann.)": round(volatility * 100, 2),
                "Max Drawdown": round(max_drawdown * 100, 2),
            }
            report_data["assets"].append(asset_report)
            print(f"✅ Processed {ticker}")

        except Exception as e:
            print(f"❌ Error {ticker}: {e}")

    # 1. Save JSON (Archive)
    json_filename = (
        REPORTS_DIR / f"{datetime.now().strftime('%Y-%m-%d')}_daily_report.json"
    )
    with open(json_filename, "w") as f:
        json.dump(report_data, f, indent=4)

    # 2. Save Excel (For User Download)
    excel_filename = (
        REPORTS_DIR / f"Daily_Report_{datetime.now().strftime('%Y-%m-%d')}.xlsx"
    )
    df_report = pd.DataFrame(report_data["assets"])
    df_report.to_excel(excel_filename, index=False)

    print(f"💾 Report saved: {excel_filename}")

    # 👇 THIS LINE IS CRITICAL. IT MUST BE HERE.
    return excel_filename


if __name__ == "__main__":
    generate_daily_report()

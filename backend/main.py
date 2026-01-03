# Backend Main
# Import other files
from strategies import apply_sma_strategy, calculate_performance_metrics
import time
# Import libraries
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np
app = FastAPI()

# Allow React to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "API is running"}
quote_cache = {}
CACHE_DURATION = 60
# Endpoint for Single Asset Data
@app.get("/api/asset/{ticker}")
def get_asset_data(ticker: str):
    # Fetch 1 year of data
    df = yf.download(ticker, period="2y")
    
    # Check ticker
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No data found for {ticker}")
    
    # Flatten columns if yfinance returns ('Close', 'AAPL') format
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    # Reset index to make Date a column
    df.reset_index(inplace=True)
    
    # Filter columns safely
    required_columns = ['Date', 'Close', 'Open', 'High', 'Low']
    available_columns = [col for col in required_columns if col in df.columns]
    
    result = df[available_columns].to_dict(orient='records')
    return result

@app.get("/api/asset/{ticker}/realtime")
def get_realtime_asset(ticker: str):
    ticker = ticker.upper()
    current_time = time.time()
    
    # 1. Check Cache
    if ticker in quote_cache:
        cached_item = quote_cache[ticker]
        if current_time < cached_item['expiry']:
            print(f"⚡ Serving {ticker} from Cache")
            return cached_item['data']

    # 2. Fetch Fresh Data (if cache missing or expired)
    try:
        print(f"Fetching {ticker} from API...")
        stock = yf.Ticker(ticker)
        price = stock.fast_info['last_price']
        prev_close = stock.fast_info['previous_close']
        
        change = price - prev_close
        pct_change = (change / prev_close) * 100
        
        # 3. Build Response Object with Timestamp
        data = {
            "symbol": ticker,
            "price": round(price, 2),
            "change": round(change, 2),
            "pct_change": round(pct_change, 2),
            "last_updated": time.strftime('%H:%M:%S', time.localtime(current_time)) # <--- Timestamp Requirement
        }
        
        # 4. Save to Cache
        quote_cache[ticker] = {
            "data": data,
            "expiry": current_time + CACHE_DURATION
        }
        
        return data

    except Exception as e:
        raise HTTPException(status_code=404, detail="Ticker not found")
# Endpoint for the SMAC Strategy
@app.get("/api/backtest/sma/{ticker}")
def backtest_sma(
    ticker: str, 
    short_window: int = 20, 
    long_window: int = 50,
    period: str = "1y",       # <--- NEW
    timeframe: str = "daily"  # <--- NEW
):
    # --- 1. VALIDATION LAYER (Safety Checks) ---
    # Define allowed values
    valid_periods = ["1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "max"]
    timeframe_mapping = {
        "daily": "1d",
        "weekly": "1wk", 
        "monthly": "1mo"
    }
    
    # Check 1: Is the period valid?
    if period not in valid_periods:
        raise HTTPException(status_code=400, detail=f"Invalid period. Allowed: {valid_periods}")

    # Check 2: Is the timeframe valid?
    if timeframe not in timeframe_mapping:
        raise HTTPException(status_code=400, detail="Invalid timeframe. Use: daily, weekly, monthly")

    # Check 3: Logical Math Error (Short > Long)
    if short_window >= long_window:
        raise HTTPException(status_code=400, detail="Short window must be less than Long window")

    # --- 2. FETCH DATA ---
    # Use the mapped interval (e.g., "daily" -> "1d")
    df = yf.download(ticker, period=period, interval=timeframe_mapping[timeframe])
    
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail="No data found for this configuration")

    # Fix MultiIndex if necessary
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    # --- 3. APPLY STRATEGY ---
    # (The strategy logic remains the same, it adapts to the DF length)
    processed_data = apply_sma_strategy(df, short_window, long_window)
    
    # Calculate Metrics
    metrics = calculate_performance_metrics(processed_data['Strategy_Return'])

    # --- 4. FORMAT RESPONSE ---
    processed_data.reset_index(inplace=True)
    # Handle different date formats (Weekly/Monthly might look different)
    processed_data['Date'] = pd.to_datetime(processed_data['Date']).dt.strftime('%Y-%m-%d')
    
    processed_data.replace([np.inf, -np.inf], 0, inplace=True)
    processed_data.fillna(0, inplace=True)
    
    result = processed_data[[
        'Date', 'Cumulative_Market', 'Cumulative_Strategy', 'Signal'
    ]].to_dict(orient='records')
    
    return {
        "metrics": metrics,
        "data": result
    }
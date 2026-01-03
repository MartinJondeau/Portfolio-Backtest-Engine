# Backend Main
# Import other files
from strategies import apply_sma_strategy, calculate_performance_metrics

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

@app.get("/api/quote/{ticker}")
def get_quote(ticker: str):
    try:
        # Fetch just 1 day of data to get the latest close
        stock = yf.Ticker(ticker)
        # fast_info is often faster than history() for current price
        price = stock.fast_info['last_price']
        prev_close = stock.fast_info['previous_close']
        
        change = price - prev_close
        pct_change = (change / prev_close) * 100
        
        return {
            "symbol": ticker.upper(),
            "price": round(price, 2),
            "change": round(change, 2),
            "pct_change": round(pct_change, 2)
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail="Ticker not found")
# Endpoint for the SMAC Strategy
@app.get("/api/backtest/sma/{ticker}")
def backtest_sma(ticker: str, short_window: int = 20, long_window: int = 50):
    # 1. Fetch Data
    df = yf.download(ticker, period="2y")
    
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail="No data found")

    # Fix MultiIndex (The code you added earlier)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    
    # 2. Apply Strategy
    processed_data = apply_sma_strategy(df, short_window, long_window)
    metrics = calculate_performance_metrics(processed_data['Strategy_Return'])
    # 3. Format for Frontend (Recharts needs a list of dicts)
    # We only send what we need to minimize bandwidth
    processed_data.reset_index(inplace=True)
    processed_data['Date'] = pd.to_datetime(processed_data['Date']).dt.strftime('%Y-%m-%d')
    processed_data.replace([np.inf, -np.inf], 0, inplace=True)
    # Handle NaN values (JSON cannot handle NaN)
    processed_data.fillna(0, inplace=True)
    
    result = processed_data[[
        'Date', 
        'Cumulative_Market', 
        'Cumulative_Strategy', 
        'Signal'
    ]].to_dict(orient='records')
    
    return {
        "metrics": metrics,
        "data": result
    }
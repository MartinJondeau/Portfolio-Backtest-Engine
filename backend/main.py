# Backend Main
# Import other files
from strategies import apply_sma_strategy, calculate_performance_metrics
from portfolio import calculate_correlation_matrix, calculate_portfolio_metrics, simulate_portfolio

# Import libraries
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np
from typing import List, Dict, Optional

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
    df = yf.download(ticker, period="1y")
    
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



# ========================================
# PORTFOLIO ENDPOINTS - QUANT B
# ========================================

@app.post("/api/portfolio/data")
def get_portfolio_data(tickers: List[str], period: str = "1y"):
    """
    Fetch data for multiple assets
    Args:
        tickers: List of ticker symbols
        period: Time period (1mo, 3mo, 6mo, 1y, 2y, 5y)
    """
    if not tickers or len(tickers) < 3:
        raise HTTPException(status_code=400, detail="Please provide at least 3 tickers")
    
    assets_data = {}
    
    for ticker in tickers:
        try:
            df = yf.download(ticker, period=period, progress=False)
            
            if df.empty:
                continue
            
            # Fix MultiIndex
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            
            assets_data[ticker] = df
        except Exception as e:
            print(f"Error fetching {ticker}: {e}")
            continue
    
    if len(assets_data) < 3:
        raise HTTPException(status_code=404, detail="Could not fetch data for at least 3 valid tickers")
    
    # Format data for frontend
    result = {}
    for ticker, df in assets_data.items():
        df_copy = df.copy()
        df_copy.reset_index(inplace=True)
        df_copy['Date'] = pd.to_datetime(df_copy['Date']).dt.strftime('%Y-%m-%d')
        result[ticker] = df_copy[['Date', 'Close']].to_dict(orient='records')
    
    return result


@app.post("/api/portfolio/correlation")
def get_correlation_matrix(tickers: List[str], period: str = "1y"):
    """
    Calculate correlation matrix between assets
    """
    if not tickers or len(tickers) < 3:
        raise HTTPException(status_code=400, detail="Please provide at least 3 tickers")
    
    # Fetch data
    assets_data = {}
    for ticker in tickers:
        try:
            df = yf.download(ticker, period=period, progress=False)
            if df.empty:
                continue
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            assets_data[ticker] = df
        except:
            continue
    
    if len(assets_data) < 3:
        raise HTTPException(status_code=404, detail="Could not fetch sufficient data")
    
    # Calculate correlation
    corr_matrix = calculate_correlation_matrix(assets_data)
    
    # Format for frontend (list of rows)
    corr_data = []
    for idx, row in corr_matrix.iterrows():
        row_data = {"asset": idx}
        for col in corr_matrix.columns:
            row_data[col] = round(row[col], 3)
        corr_data.append(row_data)
    
    return {
        "correlation_matrix": corr_data,
        "tickers": list(corr_matrix.columns)
    }


@app.post("/api/portfolio/backtest")
def backtest_portfolio(
    tickers: List[str],
    weights: Optional[Dict[str, float]] = None,
    rebalance_frequency: str = "never",
    period: str = "2y"
):
    """
    Backtest portfolio with given weights and rebalancing strategy
    """
    if not tickers or len(tickers) < 3:
        raise HTTPException(status_code=400, detail="Please provide at least 3 tickers")
    
    # Fetch data
    assets_data = {}
    for ticker in tickers:
        try:
            df = yf.download(ticker, period=period, progress=False)
            if df.empty:
                continue
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            assets_data[ticker] = df
        except:
            continue
    
    if len(assets_data) < 3:
        raise HTTPException(status_code=404, detail="Could not fetch sufficient data")
    
    # Simulate portfolio
    portfolio_df = simulate_portfolio(assets_data, weights, rebalance_frequency)
    
    # Calculate metrics
    metrics = calculate_portfolio_metrics(portfolio_df['Portfolio_Return'])
    
    # Calculate individual asset cumulative returns for comparison
    individual_assets = {}
    for ticker, df in assets_data.items():
        returns = df['Close'].pct_change().fillna(0)
        cumulative = (1 + returns).cumprod()
        individual_assets[ticker] = cumulative.values.tolist()
    
    # Format data for frontend
    portfolio_df['Date'] = pd.to_datetime(portfolio_df['Date']).dt.strftime('%Y-%m-%d')
    portfolio_df.replace([np.inf, -np.inf], 0, inplace=True)
    portfolio_df.fillna(0, inplace=True)
    
    return {
        "metrics": metrics,
        "portfolio_data": portfolio_df.to_dict(orient='records'),
        "individual_assets": individual_assets,
        "tickers": list(assets_data.keys())
    }

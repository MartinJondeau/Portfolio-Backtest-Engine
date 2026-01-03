import logging
import time
import random
import json
import os
import glob
from datetime import datetime
from typing import List, Dict, Optional
from pydantic import BaseModel

# Third-party libraries
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np

# Custom Modules
from strategies import apply_sma_strategy, apply_mean_reversion_strategy, calculate_performance_metrics
from portfolio import calculate_correlation_matrix, calculate_portfolio_metrics, simulate_portfolio
from report import generate_daily_report

# --- 1. LOGGING CONFIGURATION ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("app.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# --- 2. PYDANTIC MODELS ---
class PortfolioRequest(BaseModel):
    tickers: List[str]
    period: str = "1y"

class PortfolioBacktestRequest(BaseModel):
    tickers: List[str]
    weights: Optional[Dict[str, float]] = None
    rebalance_frequency: str = "never"
    period: str = "2y"

# --- 3. FASTAPI SETUP ---
app = FastAPI(title="Portfolio Backtest Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 4. GLOBAL ERROR HANDLER ---
@app.middleware("http")
async def global_exception_handler(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        logger.critical(f"CRITICAL SERVER ERROR: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error. Check logs for details."}
        )

# --- 5. ROBUST DATA FETCHING LOGIC ---
def fetch_data_with_retry(ticker, period="1y", interval="1d", retries=3):
    """
    Robust fetcher that distinguishes between INVALID TICKERS and NETWORK ERRORS.
    Combines Quant A and Quant B approaches.
    """
    delay = 1
    
    for attempt in range(retries):
        try:
            logger.info(f"Fetching {ticker} (Attempt {attempt+1}/{retries})")
            
            # Attempt download
            df = yf.download(ticker, period=period, interval=interval, progress=False)
            
            # CHECK 1: INVALID TICKER
            if df is None or df.empty:
                logger.error(f"Ticker '{ticker}' not found (Data Empty).")
                raise HTTPException(status_code=404, detail=f"Invalid Ticker: '{ticker}' not found.")
            
            # Fix MultiIndex
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
                
            logger.info(f"Successfully fetched {len(df)} rows for {ticker}")
            return df
            
        except HTTPException as e:
            raise e  # Re-raise 404 immediately
            
        except Exception as e:
            logger.warning(f"Network error on attempt {attempt+1}: {e}")
            if attempt < retries - 1:
                time.sleep(delay)
                delay *= 2 
            else:
                logger.error("Network failed after all retries.")
                raise HTTPException(status_code=503, detail="Network Error: Unable to connect to market data.")

    raise HTTPException(status_code=503, detail="Service Unavailable")

# --- 6. ENDPOINTS ---

@app.get("/")
def read_root():
    return {"status": "API is running", "version": "1.0.0"}

# --- Real-Time Data with Cache ---
quote_cache = {}
CACHE_DURATION = 60

@app.get("/api/asset/{ticker}/realtime")
def get_realtime_asset(ticker: str):
    ticker = ticker.upper()
    current_time = time.time()
    
    # Check Cache
    if ticker in quote_cache:
        cached_item = quote_cache[ticker]
        if current_time < cached_item['expiry']:
            return cached_item['data']

    # Fetch Fresh Data
    try:
        stock = yf.Ticker(ticker)
        
        try:
            price = stock.fast_info['last_price']
            prev_close = stock.fast_info['previous_close']
            
            if price is None:
                raise ValueError("Price is None")
                
        except (KeyError, TypeError, ValueError):
            raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found")
            
        change = price - prev_close
        pct_change = (change / prev_close) * 100
        
        data = {
            "symbol": ticker,
            "price": round(price, 2),
            "change": round(change, 2),
            "pct_change": round(pct_change, 2),
            "last_updated": datetime.now().strftime('%H:%M:%S')
        }
        
        quote_cache[ticker] = {
            "data": data,
            "expiry": current_time + CACHE_DURATION
        }
        return data

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Realtime fetch failed: {e}")
        raise HTTPException(status_code=503, detail="Network Error: External API Unavailable")
    
@app.get("/api/asset/{ticker}")
def get_asset_details(ticker: str, period: str = "1y"): # <--- Add period parameter
    ticker = ticker.upper()
    try:
        stock = yf.Ticker(ticker)
        # Use the period requested by frontend
        history = stock.history(period=period)
        
        if history.empty:
             raise HTTPException(status_code=404, detail="Ticker not found or no data")
        
        history.reset_index(inplace=True)
        
        data = []
        for index, row in history.iterrows():
            data.append({
                "Date": row['Date'].strftime('%Y-%m-%d'),
                "Close": round(row['Close'], 2),
                "Open": round(row['Open'], 2),
                "High": round(row['High'], 2),
                "Low": round(row['Low'], 2),
                "Volume": row['Volume']
            })
            
        return data

    except Exception as e:
        print(f"Error fetching asset data: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
# --- Strategy: SMA Crossover ---
@app.get("/api/backtest/sma/{ticker}")
def backtest_sma(
    ticker: str, 
    short_window: int = 20, 
    long_window: int = 50,
    period: str = "1y",
    timeframe: str = "daily"
):
    # Validation
    valid_periods = ["1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "max"]
    timeframe_mapping = {"daily": "1d", "weekly": "1wk", "monthly": "1mo"}
    
    if period not in valid_periods:
        raise HTTPException(status_code=400, detail=f"Invalid period. Allowed: {valid_periods}")
    if timeframe not in timeframe_mapping:
        raise HTTPException(status_code=400, detail="Invalid timeframe.")
    if short_window >= long_window:
        raise HTTPException(status_code=400, detail="Short window must be less than Long window")

    # Fetch Data
    df = fetch_data_with_retry(ticker, period=period, interval=timeframe_mapping[timeframe])

    # Apply Strategy
    processed_data = apply_sma_strategy(df, short_window, long_window)
    metrics = calculate_performance_metrics(processed_data['Strategy_Return'])

    # Format
    processed_data.reset_index(inplace=True)
    processed_data['Date'] = pd.to_datetime(processed_data['Date']).dt.strftime('%Y-%m-%d')
    processed_data.replace([np.inf, -np.inf], 0, inplace=True)
    processed_data.fillna(0, inplace=True)
    
    result = processed_data[[
        'Date', 'Cumulative_Market', 'Cumulative_Strategy', 'Signal'
    ]].to_dict(orient='records')
    
    return {"metrics": metrics, "data": result}

# --- Strategy: Mean Reversion (QUANT A) ---
@app.get("/api/backtest/mean-reversion/{ticker}")
def backtest_mean_reversion(
    ticker: str, 
    window: int = 20, 
    threshold: float = 2.0,
    period: str = "1y",
    timeframe: str = "daily"
):
    # Validation
    if window < 2:
         raise HTTPException(status_code=400, detail="Window must be at least 2")
    
    timeframe_mapping = {"daily": "1d", "weekly": "1wk", "monthly": "1mo"}
    
    # Fetch Data
    df = fetch_data_with_retry(ticker, period=period, interval=timeframe_mapping.get(timeframe, "1d"))

    # Apply Strategy
    processed_data = apply_mean_reversion_strategy(df, window, threshold)
    metrics = calculate_performance_metrics(processed_data['Strategy_Return'])

    # Format
    processed_data.reset_index(inplace=True)
    processed_data['Date'] = pd.to_datetime(processed_data['Date']).dt.strftime('%Y-%m-%d')
    processed_data.replace([np.inf, -np.inf], 0, inplace=True)
    processed_data.fillna(0, inplace=True)
    
    result = processed_data[[
        'Date', 'Cumulative_Market', 'Cumulative_Strategy', 'Signal', 'Z_Score'
    ]].to_dict(orient='records')
    
    return {"metrics": metrics, "data": result}

# ========================================
# PORTFOLIO ENDPOINTS - QUANT B
# ========================================

@app.post("/api/portfolio/data")
def get_portfolio_data(request: PortfolioRequest):
    tickers = request.tickers
    period = request.period
    
    if not tickers or len(tickers) < 3:
        raise HTTPException(status_code=400, detail="Please provide at least 3 tickers")
    
    assets_data = {}
    
    for ticker in tickers:
        try:
            df = fetch_data_with_retry(ticker, period)
            
            if df.empty:
                continue
            
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            
            assets_data[ticker] = df
        except Exception as e:
            logger.error(f"Error fetching {ticker}: {e}")
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
def get_correlation_matrix(request: PortfolioRequest):
    tickers = request.tickers
    period = request.period
    
    if not tickers or len(tickers) < 3:
        raise HTTPException(status_code=400, detail="Please provide at least 3 tickers")
    
    # Fetch data
    assets_data = {}
    for ticker in tickers:
        try:
            df = fetch_data_with_retry(ticker, period)
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
    
    # Format for frontend
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
def backtest_portfolio(request: PortfolioBacktestRequest):
    tickers = request.tickers
    weights = request.weights
    rebalance_frequency = request.rebalance_frequency
    period = request.period
    
    if not tickers or len(tickers) < 3:
        raise HTTPException(status_code=400, detail="Please provide at least 3 tickers")
    
    # Fetch data
    assets_data = {}
    for ticker in tickers:
        try:
            df = fetch_data_with_retry(ticker, period)
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
    
    # Calculate individual asset cumulative returns
    individual_assets = {}
    for ticker, df in assets_data.items():
        returns = df['Close'].pct_change().fillna(0)
        cumulative = (1 + returns).cumprod()
        individual_assets[ticker] = cumulative.values.tolist()
    
    # Format data
    portfolio_df['Date'] = pd.to_datetime(portfolio_df['Date']).dt.strftime('%Y-%m-%d')
    portfolio_df.replace([np.inf, -np.inf], 0, inplace=True)
    portfolio_df.fillna(0, inplace=True)
    
    return {
        "metrics": metrics,
        "portfolio_data": portfolio_df.to_dict(orient='records'),
        "individual_assets": individual_assets,
        "tickers": list(assets_data.keys())
    }

# --- Reporting (QUANT A) ---
@app.get("/api/reports/latest")
def get_latest_report():
    reports_dir = "reports"
    if not os.path.exists(reports_dir):
        raise HTTPException(status_code=404, detail="Reports directory not found.")
        
    list_of_files = glob.glob(f'{reports_dir}/*.json') 
    if not list_of_files:
        raise HTTPException(status_code=404, detail="No reports found. Run report.py first.")
        
    latest_file = max(list_of_files, key=os.path.getctime)
    
    with open(latest_file, 'r') as f:
        data = json.load(f)
    return data

@app.post("/api/reports/generate")
def trigger_daily_report(background_tasks: BackgroundTasks):
    background_tasks.add_task(generate_daily_report)
    return {"status": "Report generation started", "message": "Check back in 10-20 seconds"}

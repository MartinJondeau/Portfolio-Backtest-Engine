import logging
import time
import random
import json
import os
import glob
from datetime import datetime

# Third-party libraries
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np

# Custom Modules (Ensure these files exist in the same folder)
from strategies import apply_sma_strategy, apply_mean_reversion_strategy, calculate_performance_metrics
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

# --- 2. FASTAPI SETUP ---
app = FastAPI(title="Portfolio Backtest Engine")

# Allow React to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 3. GLOBAL ERROR HANDLER (Middleware) ---
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

# --- 4. ROBUST DATA FETCHING LOGIC (Retry + Fallback) ---

def generate_mock_data(ticker, period="1y"):
    """
    FALLBACK: Generates consistent fake data if API fails.
    Prevents the demo from crashing during network issues.
    """
    logger.warning(f"Using Mock Data for {ticker}")
    # Generate approx 252 trading days
    dates = pd.date_range(end=pd.Timestamp.now(), periods=252)
    
    # Random Walk
    prices = [100.0]
    for _ in range(len(dates)-1):
        change = random.uniform(-0.02, 0.02)
        prices.append(prices[-1] * (1 + change))
        
    df = pd.DataFrame({'Close': prices, 'Open': prices}, index=dates)
    return df

def fetch_data_with_retry(ticker, period="1y", interval="1d", retries=3):
    """
    Robust fetcher that distinguishes between INVALID TICKERS and NETWORK ERRORS.
    """
    delay = 1
    
    for attempt in range(retries):
        try:
            logger.info(f"Fetching {ticker} (Attempt {attempt+1}/{retries})")
            
            # Attempt download
            df = yf.download(ticker, period=period, interval=interval, progress=False)
            
            # CHECK 1: INVALID TICKER
            # If the API works but returns no data, the ticker does not exist.
            # We raise 404 immediately. Do NOT retry.
            if df is None or df.empty:
                logger.error(f"Ticker '{ticker}' not found (Data Empty).")
                raise HTTPException(status_code=404, detail=f"Invalid Ticker: '{ticker}' not found.")
            
            # Fix MultiIndex
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
                
            logger.info(f"Successfully fetched {len(df)} rows for {ticker}")
            return df
            
        except HTTPException as e:
            # Re-raise the 404 Invalid Ticker error immediately (break the loop)
            raise e
            
        except Exception as e:
            # CHECK 2: NETWORK / API ERROR
            # This is a connection issue. We SHOULD retry.
            logger.warning(f"Network error on attempt {attempt+1}: {e}")
            if attempt < retries - 1:
                time.sleep(delay)
                delay *= 2 
            else:
                logger.error("Network failed after all retries.")
                # We do not fallback to mock data anymore, we tell the truth.
                raise HTTPException(status_code=503, detail="Network Error: Unable to connect to market data.")

    # Should not be reached, but safety net
    raise HTTPException(status_code=503, detail="Service Unavailable")

# --- 5. ENDPOINTS ---

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
    
    # 1. Check Cache
    if ticker in quote_cache:
        cached_item = quote_cache[ticker]
        if current_time < cached_item['expiry']:
            return cached_item['data']

    # 2. Fetch Fresh Data
    try:
        stock = yf.Ticker(ticker)
        
        # yfinance logic: If ticker is invalid, accessing fast_info often causes a KeyError
        try:
            price = stock.fast_info['last_price']
            prev_close = stock.fast_info['previous_close']
            
            # Additional check: If yfinance returns None, it's invalid
            if price is None:
                raise ValueError("Price is None")
                
        except (KeyError, TypeError, ValueError):
            # CATCH THE BUG: Specific errors mean the ticker doesn't exist
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
        raise e  # Pass 404 through
    except Exception as e:
        logger.error(f"Realtime fetch failed: {e}")
        # Only generic crashes are 503
        raise HTTPException(status_code=503, detail="Network Error: External API Unavailable")
    
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

    # Fetch Data (Robust)
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

# --- Strategy: Mean Reversion ---
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
    
    # Fetch Data (Robust)
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

# --- Reporting ---
@app.get("/api/reports/latest")
def get_latest_report():
    reports_dir = "reports"
    if not os.path.exists(reports_dir):
        raise HTTPException(status_code=404, detail="Reports directory not found.")
        
    list_of_files = glob.glob(f'{reports_dir}/*.json') 
    if not list_of_files:
        raise HTTPException(status_code=404, detail="No reports found. Run daily_report.py first.")
        
    latest_file = max(list_of_files, key=os.path.getctime)
    
    with open(latest_file, 'r') as f:
        data = json.load(f)
    return data

@app.post("/api/reports/generate")
def trigger_daily_report(background_tasks: BackgroundTasks):
    # Runs the heavy script in the background
    background_tasks.add_task(generate_daily_report)
    return {"status": "Report generation started", "message": "Check back in 10-20 seconds"}
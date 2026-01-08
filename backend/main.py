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
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np

# --- NEW IMPORT FOR ML ---
from sklearn.ensemble import RandomForestClassifier 

# Custom Modules
from strategies import (
    apply_sma_strategy,
    apply_mean_reversion_strategy,
    apply_ml_strategy,
    predict_future_prices,
    calculate_performance_metrics,
)
from portfolio import (
    calculate_correlation_matrix,
    calculate_portfolio_metrics,
    simulate_portfolio,
)
from report import generate_daily_report

# --- 1. LOGGING CONFIGURATION ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler("app.log"), logging.StreamHandler()],
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
            content={"detail": "Internal Server Error. Check logs for details."},
        )


# --- 5. ROBUST DATA FETCHING LOGIC ---
def fetch_data_with_retry(ticker, period="1y", interval="1d", retries=3):
    delay = 1
    for attempt in range(retries):
        try:
            logger.info(f"Fetching {ticker} (Attempt {attempt+1}/{retries})")
            df = yf.download(ticker, period=period, interval=interval, progress=False)

            if df is None or df.empty:
                logger.error(f"Ticker '{ticker}' not found (Data Empty).")
                raise HTTPException(
                    status_code=404, detail=f"Invalid Ticker: '{ticker}' not found."
                )

            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)

            logger.info(f"Successfully fetched {len(df)} rows for {ticker}")
            return df

        except HTTPException as e:
            raise e
        except Exception as e:
            logger.warning(f"Network error on attempt {attempt+1}: {e}")
            if attempt < retries - 1:
                time.sleep(delay)
                delay *= 2
            else:
                logger.error("Network failed after all retries.")
                raise HTTPException(
                    status_code=503,
                    detail="Network Error: Unable to connect to market data.",
                )
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

    if ticker in quote_cache:
        cached_item = quote_cache[ticker]
        if current_time < cached_item["expiry"]:
            return cached_item["data"]

    try:
        stock = yf.Ticker(ticker)
        try:
            price = stock.fast_info["last_price"]
            prev_close = stock.fast_info["previous_close"]
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
            "last_updated": datetime.now().strftime("%H:%M:%S"),
        }
        quote_cache[ticker] = {"data": data, "expiry": current_time + CACHE_DURATION}
        return data
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Realtime fetch failed: {e}")
        raise HTTPException(status_code=503, detail="Network Error: External API Unavailable")


@app.get("/api/asset/{ticker}")
def get_asset_details(ticker: str, period: str = "1y"):
    ticker = ticker.upper()
    try:
        stock = yf.Ticker(ticker)
        history = stock.history(period=period)

        if history.empty:
            raise HTTPException(status_code=404, detail="Ticker not found or no data")

        history.reset_index(inplace=True)
        data = []
        for index, row in history.iterrows():
            data.append(
                {
                    "Date": row["Date"].strftime("%Y-%m-%d"),
                    "Close": round(row["Close"], 2),
                    "Open": round(row["Open"], 2),
                    "High": round(row["High"], 2),
                    "Low": round(row["Low"], 2),
                    "Volume": row["Volume"],
                }
            )
        return data
    except Exception as e:
        print(f"Error fetching asset data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/backtest/sma/{ticker}")
def backtest_sma(ticker: str, short_window: int = 20, long_window: int = 50, period: str = "1y", timeframe: str = "daily"):
    valid_periods = ["1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "max"]
    timeframe_mapping = {"daily": "1d", "weekly": "1wk", "monthly": "1mo"}

    if period not in valid_periods:
        raise HTTPException(status_code=400, detail=f"Invalid period. Allowed: {valid_periods}")
    
    df = fetch_data_with_retry(ticker, period=period, interval=timeframe_mapping.get(timeframe, "1d"))
    processed_data = apply_sma_strategy(df, short_window, long_window)
    metrics = calculate_performance_metrics(processed_data["Strategy_Return"])

    processed_data.reset_index(inplace=True)
    processed_data["Date"] = pd.to_datetime(processed_data["Date"]).dt.strftime("%Y-%m-%d")
    processed_data.replace([np.inf, -np.inf], 0, inplace=True)
    processed_data.fillna(0, inplace=True)

    result = processed_data[["Date", "Cumulative_Market", "Cumulative_Strategy", "Signal"]].to_dict(orient="records")
    return {"metrics": metrics, "data": result}


@app.get("/api/backtest/mean-reversion/{ticker}")
def backtest_mean_reversion(ticker: str, window: int = 20, threshold: float = 2.0, period: str = "1y", timeframe: str = "daily"):
    timeframe_mapping = {"daily": "1d", "weekly": "1wk", "monthly": "1mo"}
    df = fetch_data_with_retry(ticker, period=period, interval=timeframe_mapping.get(timeframe, "1d"))
    
    processed_data = apply_mean_reversion_strategy(df, window, threshold)
    metrics = calculate_performance_metrics(processed_data["Strategy_Return"])

    processed_data.reset_index(inplace=True)
    processed_data["Date"] = pd.to_datetime(processed_data["Date"]).dt.strftime("%Y-%m-%d")
    processed_data.replace([np.inf, -np.inf], 0, inplace=True)
    processed_data.fillna(0, inplace=True)

    result = processed_data[["Date", "Cumulative_Market", "Cumulative_Strategy", "Signal", "Z_Score"]].to_dict(orient="records")
    return {"metrics": metrics, "data": result}


@app.get("/api/backtest/ml/{ticker}")
def backtest_ml(ticker: str, period: str = "2y", timeframe: str = "daily"):
    timeframe_mapping = {"daily": "1d", "weekly": "1wk", "monthly": "1mo"}
    df = fetch_data_with_retry(ticker, period=period, interval=timeframe_mapping.get(timeframe, "1d"))

    if len(df) < 100:
        raise HTTPException(status_code=400, detail=f"Not enough data points ({len(df)}) to train.")

    try:
        # SINGLE VIEW: Strict OOS (use_hybrid=False default)
        processed_data = apply_ml_strategy(df)
        metrics = calculate_performance_metrics(processed_data["Strategy_Return"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML Model Training Failed: {str(e)}")

    processed_data.reset_index(inplace=True)
    if "Date" not in processed_data.columns:
        processed_data.rename(columns={"index": "Date"}, inplace=True)

    processed_data["Date"] = pd.to_datetime(processed_data["Date"]).dt.strftime("%Y-%m-%d")
    processed_data.replace([np.inf, -np.inf], 0, inplace=True)
    processed_data.fillna(0, inplace=True)

    result = processed_data[["Date", "Cumulative_Market", "Cumulative_Strategy", "Signal"]].to_dict(orient="records")
    return {"metrics": metrics, "data": result}


@app.get("/api/forecast/ml/{ticker}")
def get_ml_forecast(ticker: str, period: str = "2y"):
    df = fetch_data_with_retry(ticker, period=period, interval="1d")
    if len(df) < 100:
        raise HTTPException(status_code=400, detail="Not enough data for forecast")
    try:
        forecast_data = predict_future_prices(df, days=21)
        return {"ticker": ticker, "forecast": forecast_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
            if df.empty: continue
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            assets_data[ticker] = df
        except: continue

    if len(assets_data) < 3:
        raise HTTPException(status_code=404, detail="Could not fetch data for at least 3 valid tickers")

    result = {}
    for ticker, df in assets_data.items():
        df_copy = df.copy()
        df_copy.reset_index(inplace=True)
        df_copy["Date"] = pd.to_datetime(df_copy["Date"]).dt.strftime("%Y-%m-%d")
        result[ticker] = df_copy[["Date", "Close"]].to_dict(orient="records")
    return result


@app.post("/api/portfolio/correlation")
def get_correlation_matrix(request: PortfolioRequest):
    tickers = request.tickers
    period = request.period
    if not tickers or len(tickers) < 3:
        raise HTTPException(status_code=400, detail="Please provide at least 3 tickers")

    assets_data = {}
    for ticker in tickers:
        try:
            df = fetch_data_with_retry(ticker, period)
            if df.empty: continue
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            assets_data[ticker] = df
        except: continue

    if len(assets_data) < 3:
        raise HTTPException(status_code=404, detail="Could not fetch sufficient data")

    corr_matrix = calculate_correlation_matrix(assets_data)
    corr_data = []
    for idx, row in corr_matrix.iterrows():
        row_data = {"asset": idx}
        for col in corr_matrix.columns:
            row_data[col] = round(row[col], 3)
        corr_data.append(row_data)
    return {"correlation_matrix": corr_data, "tickers": list(corr_matrix.columns)}


@app.post("/api/portfolio/backtest")
def backtest_portfolio(request: PortfolioBacktestRequest):
    tickers = request.tickers
    weights = request.weights
    rebalance_frequency = request.rebalance_frequency
    period = request.period

    if not tickers or len(tickers) < 3:
        raise HTTPException(status_code=400, detail="Please provide at least 3 tickers")

    assets_data = {}
    for ticker in tickers:
        try:
            df = fetch_data_with_retry(ticker, period)
            if df.empty: continue
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            assets_data[ticker] = df
        except: continue

    if len(assets_data) < 3:
        raise HTTPException(status_code=404, detail="Could not fetch sufficient data")

    portfolio_df = simulate_portfolio(assets_data, weights, rebalance_frequency)
    metrics = calculate_portfolio_metrics(portfolio_df["Portfolio_Return"])

    individual_assets = {}
    for ticker, df in assets_data.items():
        returns = df["Close"].pct_change().fillna(0)
        cumulative = (1 + returns).cumprod()
        individual_assets[ticker] = cumulative.values.tolist()

    portfolio_df["Date"] = pd.to_datetime(portfolio_df["Date"]).dt.strftime("%Y-%m-%d")
    portfolio_df.replace([np.inf, -np.inf], 0, inplace=True)
    portfolio_df.fillna(0, inplace=True)

    return {
        "metrics": metrics,
        "portfolio_data": portfolio_df.to_dict(orient="records"),
        "individual_assets": individual_assets,
        "tickers": list(assets_data.keys()),
    }


@app.post("/api/portfolio/backtest-strategies")
def backtest_portfolio_with_strategies(request: dict):
    """
    Backtest portfolio where each asset can have its own strategy.
    Supports: SMA, Mean Reversion, and ML (Hybrid).
    """
    assets_config = request.get("assets", [])
    period = request.get("period", "2y")
    weights = request.get("weights", None)
    start_date = request.get("start_date", None)
    initial_amount = request.get("initial_amount", None)

    if len(assets_config) < 3:
        raise HTTPException(status_code=400, detail="Please provide at least 3 assets")

    assets_returns = {}
    tickers = []

    for asset in assets_config:
        ticker = asset["ticker"]
        strategy = asset["strategy"]
        params = asset.get("params", {})
        tickers.append(ticker)

        try:
            df = fetch_data_with_retry(ticker, period=period)
            if df.empty: continue
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)

            # --- STRATEGY LOGIC ---
            if strategy == "sma":
                short_window = params.get("short_window", 20)
                long_window = params.get("long_window", 50)
                processed = apply_sma_strategy(df, short_window, long_window)
                returns = processed["Strategy_Return"]
            
            elif strategy == "mean_reversion":
                window = params.get("window", 20)
                threshold = params.get("threshold", 2.0)
                processed = apply_mean_reversion_strategy(df, window, threshold)
                returns = processed["Strategy_Return"]
            
            elif strategy == "ML_RandomForest":
                # CALL HYBRID MODE: use_hybrid=True forces Buy & Hold during training
                processed = apply_ml_strategy(df, use_hybrid=True)
                returns = processed["Strategy_Return"]
            
            else:  # buy_hold
                returns = df["Close"].pct_change()

            assets_returns[ticker] = returns.fillna(0)

        except Exception as e:
            logger.error(f"Error processing {ticker}: {e}")
            continue

    if len(assets_returns) < 3:
        raise HTTPException(status_code=404, detail="Could not process at least 3 assets")

    returns_df = pd.DataFrame(assets_returns)

    if weights is None:
        weights_series = pd.Series({ticker: 1.0 / len(tickers) for ticker in tickers})
    else:
        weights_series = pd.Series(weights)

    portfolio_returns = (returns_df * weights_series).sum(axis=1)
    
    # Cleaning Portfolio Returns immediately
    portfolio_returns.fillna(0, inplace=True) 

    start_date_parsed = None

    if start_date:
        try:
            start_date_parsed = pd.to_datetime(start_date)
            returns_df = returns_df[returns_df.index >= start_date_parsed]
            portfolio_returns = (returns_df * weights_series).sum(axis=1)
        except Exception as e:
            logger.warning(f"Invalid start_date format: {e}. Using all data.")

    # Calculate Cumulative (Starting at 1.0)
    portfolio_cumulative = (1 + portfolio_returns).cumprod()

    individual_assets = {}
    for ticker in tickers:
        if ticker in assets_returns:
            asset_returns_filtered = assets_returns[ticker]
            if start_date:
                asset_returns_filtered = asset_returns_filtered[asset_returns_filtered.index >= start_date_parsed]
            cumulative = (1 + asset_returns_filtered).cumprod()
            individual_assets[ticker] = cumulative.values.tolist()

    metrics = calculate_portfolio_metrics(portfolio_returns)

    portfolio_value = None
    if initial_amount and initial_amount > 0:
        portfolio_value = portfolio_cumulative * initial_amount
        final_value = portfolio_value.iloc[-1]
        total_pnl = final_value - initial_amount
        total_pnl_pct = (total_pnl / initial_amount) * 100
        metrics["Initial Investment"] = f"€{initial_amount:,.2f}"
        metrics["Final Value"] = f"€{final_value:,.2f}"
        metrics["Total P&L"] = f"€{total_pnl:,.2f}"
        metrics["Total P&L %"] = f"{total_pnl_pct:.2f}%"

    result_df = pd.DataFrame({"Date": returns_df.index, "Cumulative_Portfolio": portfolio_cumulative.values})
    if portfolio_value is not None:
        result_df["Portfolio_Value"] = portfolio_value.values

    # --- CRITICAL FIXES FOR WHITE LINE DISAPPEARING ---
    result_df.replace([np.inf, -np.inf], 0, inplace=True)
    result_df.fillna(0, inplace=True) 
    # --------------------------------------------------

    result_df["Date"] = pd.to_datetime(result_df["Date"]).dt.strftime("%Y-%m-%d")

    return {
        "metrics": metrics,
        "portfolio_data": result_df.to_dict(orient="records"),
        "individual_assets": individual_assets,
        "tickers": tickers,
        "has_real_simulation": initial_amount is not None and initial_amount > 0,
    }


@app.get("/api/report/download")
async def download_report():
    try:
        file_path = generate_daily_report()
        if file_path is None:
            return {"error": "Report generation failed. Function returned None."}
        return FileResponse(path=file_path, filename=file_path.name, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/reports/generate")
def trigger_daily_report(background_tasks: BackgroundTasks):
    background_tasks.add_task(generate_daily_report)
    return {"status": "Report generation started", "message": "Check back in 10-20 seconds"}
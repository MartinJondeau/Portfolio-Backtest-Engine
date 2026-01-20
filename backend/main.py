import logging
import time
import json
import os
from datetime import datetime
from typing import List, Dict, Optional, Literal
from pydantic import BaseModel

# Third-party libraries
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np

# Custom Modules
from options import (
    calculate_black_scholes,
    calculate_crr_tree,
    simulate_delta_hedging,
    calculate_stress_scenarios
)

# --- 1. LOGGING CONFIGURATION ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler("app.log"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)


# --- 2. PYDANTIC MODELS ---
class OptionPricingRequest(BaseModel):
    S: float  # Spot Price
    K: float  # Strike Price
    T: float  # Time to Maturity (Years)
    r: float  # Risk Free Rate
    sigma: float  # Volatility
    option_type: Literal["Call", "Put"] = "Call"
    N: int = 50  # CRR Steps

class HedgingRequest(BaseModel):
    S: float
    K: float
    T: float
    r: float
    sigma: float
    option_type: Literal["Call", "Put"] = "Call"
    n_steps: int = 52
    n_paths: int = 100


# --- 3. FASTAPI SETUP ---
app = FastAPI(title="HADES Derivatives Engine")

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


# --- 5. ENDPOINTS ---

@app.get("/")
def read_root():
    return {"status": "Option Engine Running", "version": "2.0.0"}

@app.post("/api/options/pricing")
def get_option_pricing(request: OptionPricingRequest):
    """Calculate BS and CRR prices and Greeks"""
    try:
        bs_res = calculate_black_scholes(
            request.S, request.K, request.T, request.r, request.sigma, request.option_type
        )
        crr_res = calculate_crr_tree(
            request.S, request.K, request.T, request.r, request.sigma, request.N, request.option_type
        )
        return {
            "bs": bs_res,
            "crr": crr_res
        }
    except Exception as e:
        logger.error(f"Option pricing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/options/hedging")
def get_hedging_simulation(request: HedgingRequest):
    """Run Monte Carlo Delta Hedging Simulation"""
    try:
        result = simulate_delta_hedging(
            request.S, request.K, request.T, request.r, request.sigma,
            request.n_steps, request.n_paths, request.option_type
        )
        return result
    except Exception as e:
        logger.error(f"Hedging simulation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/options/stress")
def get_option_stress_test(request: OptionPricingRequest):
    """Calculate P&L under shock scenarios"""
    try:
        results = calculate_stress_scenarios(
            request.S, request.K, request.T, request.r, request.sigma, request.option_type
        )
        return results
    except Exception as e:
        logger.error(f"Stress test error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/options/chain/{ticker}")
def get_option_chain_data(ticker: str, spot: float, option_type: str = "Call"):
    """Fetch real option chain for Volatility Surface (simplified)"""
    try:
        tk = yf.Ticker(ticker)
        exps = tk.options[:6]  # First 6 expirations
        if not exps:
            raise HTTPException(status_code=404, detail="No options found")
        
        strikes = []
        maturities = []
        ivs = []
        
        for exp in exps:
            chain = tk.option_chain(exp)
            data = chain.calls if option_type == "Call" else chain.puts
            
            T_years = (pd.to_datetime(exp) - pd.Timestamp.now()).days / 365.0
            if T_years < 0.01: continue
            
            # Filter for liquidity and relevance around spot
            mask = (data['impliedVolatility'] > 0.001) & \
                   (data['strike'] > spot * 0.5) & \
                   (data['strike'] < spot * 1.5)
            
            filtered = data[mask]
            
            strikes.extend(filtered['strike'].tolist())
            maturities.extend([T_years] * len(filtered))
            ivs.extend(filtered['impliedVolatility'].tolist())
            
        return {"strikes": strikes, "maturities": maturities, "ivs": ivs}
        
    except Exception as e:
        logger.error(f"Option chain fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
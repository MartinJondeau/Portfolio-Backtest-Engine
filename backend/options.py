import numpy as np
import scipy.stats as si
import pandas as pd

# =============================================================================
# 1. ANALYTICAL MODELS (BLACK-SCHOLES)
# =============================================================================

def calculate_black_scholes(S, K, T, r, sigma, option_type="Call"):
    """
    Calculate Black-Scholes price and Greeks.
    
    Returns:
        dict: {Price, Delta, Gamma, Vega, Theta, Rho}
    """
    if T <= 0 or sigma <= 0:
        return {"Price": 0.0, "Delta": 0.0, "Gamma": 0.0, "Vega": 0.0, "Theta": 0.0, "Rho": 0.0}
    
    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    
    if option_type == "Call":
        price = S * si.norm.cdf(d1) - K * np.exp(-r * T) * si.norm.cdf(d2)
        delta = si.norm.cdf(d1)
        rho = K * T * np.exp(-r * T) * si.norm.cdf(d2)
        theta = (-(S * si.norm.pdf(d1) * sigma) / (2 * np.sqrt(T)) 
                 - r * K * np.exp(-r * T) * si.norm.cdf(d2))
    else:
        price = K * np.exp(-r * T) * si.norm.cdf(-d2) - S * si.norm.cdf(-d1)
        delta = -si.norm.cdf(-d1)
        rho = -K * T * np.exp(-r * T) * si.norm.cdf(-d2)
        theta = (-(S * si.norm.pdf(d1) * sigma) / (2 * np.sqrt(T)) 
                 + r * K * np.exp(-r * T) * si.norm.cdf(-d2))
    
    gamma = si.norm.pdf(d1) / (S * sigma * np.sqrt(T))
    vega = S * np.sqrt(T) * si.norm.pdf(d1)
    
    return {
        "Price": float(price),
        "Delta": float(delta),
        "Gamma": float(gamma),
        "Vega": float(vega / 100),  # Scaled for % change
        "Theta": float(theta / 365), # Daily Theta
        "Rho": float(rho / 100)     # Scaled for % change
    }

# =============================================================================
# 2. NUMERICAL MODELS (CRR BINOMIAL TREE)
# =============================================================================

def calculate_crr_tree(S, K, T, r, sigma, N, option_type="Call"):
    """
    Cox-Ross-Rubinstein binomial tree pricing.
    
    Returns:
        dict: {Price, u, d, p, tree_nodes (for visualization)}
    """
    if T <= 0 or sigma <= 0:
        return {"Price": 0.0, "u": 0, "d": 0, "p": 0}
    
    dt = T / N
    u = np.exp(sigma * np.sqrt(dt))
    d = 1 / u
    p = (np.exp(r * dt) - d) / (u - d)
    
    # Initialize Stock Tree (Forward)
    stock_tree = np.zeros((N + 1, N + 1))
    for i in range(N + 1):
        for j in range(i + 1):
            stock_tree[j, i] = S * (u ** (i - j)) * (d ** j)
    
    # Initialize Option Tree (Backward)
    option_tree = np.zeros((N + 1, N + 1))
    if option_type == "Call":
        option_tree[:, N] = np.maximum(stock_tree[:, N] - K, 0)
    else:
        option_tree[:, N] = np.maximum(K - stock_tree[:, N], 0)
    
    discount = np.exp(-r * dt)
    for i in range(N - 1, -1, -1):
        for j in range(i + 1):
            option_tree[j, i] = discount * (p * option_tree[j, i + 1] + (1 - p) * option_tree[j + 1, i + 1])
    
    return {
        "Price": float(option_tree[0, 0]),
        "u": float(u),
        "d": float(d),
        "p": float(p),
        # Flatten simple structure for JSON response if needed, 
        # or we can return just the price for now.
    }

def calculate_crr_delta(S, K, T, r, sigma, N, option_type="Call"):
    """Calculate CRR delta using a single step approximation."""
    if T <= 0 or sigma <= 0 or N < 1:
        return 0.0
    
    dt = T / N
    u = np.exp(sigma * np.sqrt(dt))
    d = 1 / u
    
    Su = S * u
    Sd = S * d
    
    Cu = calculate_crr_tree(Su, K, T - dt, r, sigma, N - 1, option_type)["Price"]
    Cd = calculate_crr_tree(Sd, K, T - dt, r, sigma, N - 1, option_type)["Price"]
    
    return float((Cu - Cd) / (Su - Sd))

# =============================================================================
# 3. MONTE CARLO SIMULATION
# =============================================================================

def simulate_gbm_paths(S0, r, sigma, T, n_steps, n_paths):
    """
    Simulate Geometric Brownian Motion price paths.
    """
    dt = T / n_steps
    paths = np.zeros((n_paths, n_steps + 1))
    paths[:, 0] = S0
    dW = np.random.standard_normal((n_paths, n_steps))
    
    for t in range(1, n_steps + 1):
        paths[:, t] = paths[:, t-1] * np.exp((r - 0.5 * sigma**2) * dt + sigma * np.sqrt(dt) * dW[:, t-1])
        
    return paths

def simulate_delta_hedging(S0, K, T, r, sigma, n_steps, n_paths, option_type="Call"):
    """
    Simulate delta hedging strategy and return paths for visualization.
    """
    dt = T / n_steps
    paths = simulate_gbm_paths(S0, r, sigma, T, n_steps, n_paths)
    
    # Initial Setup
    bs_initial = calculate_black_scholes(S0, K, T, r, sigma, option_type)
    initial_price = bs_initial["Price"]
    
    portfolio_values = np.zeros((n_paths, n_steps + 1))
    deltas = np.zeros((n_paths, n_steps + 1))
    cash_accounts = np.zeros((n_paths, n_steps + 1))
    
    # Step 0
    for i in range(n_paths):
        S = paths[i, 0]
        delta = calculate_black_scholes(S, K, T, r, sigma, option_type)["Delta"]
        deltas[i, 0] = delta
        cash_accounts[i, 0] = initial_price - delta * S
        portfolio_values[i, 0] = delta * S + cash_accounts[i, 0]
    
    # Steps 1 to N
    for t in range(1, n_steps + 1):
        ttm = T - t * dt
        for i in range(n_paths):
            S = paths[i, t]
            
            # Update Delta
            if ttm > 0.001:
                new_delta = calculate_black_scholes(S, K, ttm, r, sigma, option_type)["Delta"]
            else:
                # Expiry logic
                if option_type == "Call":
                    new_delta = 1.0 if S > K else 0.0
                else:
                    new_delta = -1.0 if S < K else 0.0
            
            old_delta = deltas[i, t - 1]
            
            # Rebalance Cash: Grow previous cash with interest, pay/receive diff in stock
            cash_accounts[i, t] = cash_accounts[i, t - 1] * np.exp(r * dt) - (new_delta - old_delta) * S
            deltas[i, t] = new_delta
            portfolio_values[i, t] = new_delta * S + cash_accounts[i, t]
            
    # Final Payoffs
    if option_type == "Call":
        final_payoffs = np.maximum(paths[:, -1] - K, 0)
    else:
        final_payoffs = np.maximum(K - paths[:, -1], 0)
        
    hedging_errors = portfolio_values[:, -1] - final_payoffs
    
    # Prepare data for charts (downsample to max 100 paths for JSON payload size)
    display_limit = min(n_paths, 50) 
    
    return {
        "initial_price": initial_price,
        "mean_error": float(np.mean(hedging_errors)),
        "std_error": float(np.std(hedging_errors)),
        "var_95": float(np.percentile(hedging_errors, 5)),
        # Helper arrays for charting (converted to list for JSON serialization)
        "paths": paths[:display_limit].tolist(),
        "portfolio_values": portfolio_values[:display_limit].tolist(),
        "hedging_errors": hedging_errors.tolist(), # Full list for histogram
        "time_steps": list(np.linspace(0, T, n_steps + 1))
    }

# =============================================================================
# 4. SCENARIO ANALYSIS
# =============================================================================

def calculate_stress_scenarios(S, K, T, r, sigma, option_type="Call"):
    """
    Calculate P&L under various shock scenarios.
    """
    scenarios = [
        {"name": "Crash -20%", "spot_chg": -0.20, "vol_chg": 0.50},
        {"name": "Bear -10%", "spot_chg": -0.10, "vol_chg": 0.25},
        {"name": "Base Case", "spot_chg": 0.00, "vol_chg": 0.00},
        {"name": "Bull +10%", "spot_chg": 0.10, "vol_chg": -0.10},
        {"name": "Rally +20%", "spot_chg": 0.20, "vol_chg": -0.20},
    ]
    
    base_price = calculate_black_scholes(S, K, T, r, sigma, option_type)["Price"]
    results = []
    
    for scen in scenarios:
        new_S = S * (1 + scen["spot_chg"])
        new_sigma = max(0.05, sigma * (1 + scen["vol_chg"]))
        new_price = calculate_black_scholes(new_S, K, T, r, new_sigma, option_type)["Price"]
        pnl = new_price - base_price
        
        results.append({
            "name": scen["name"],
            "spot": float(new_S),
            "vol": float(new_sigma),
            "price": float(new_price),
            "pnl": float(pnl)
        })
        
    return results
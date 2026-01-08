import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor

# --- HELPER FUNCTIONS ---
def calculate_rsi(series, period=14):
    """Calculates the Relative Strength Index (RSI)"""
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

# --- STRATEGIES ---

def apply_sma_strategy(df, short_window=20, long_window=50):
    # (Unchanged)
    data = df.copy()
    data = data[data["Close"] > 0] 
    data["SMA_Short"] = data["Close"].rolling(window=short_window).mean()
    data["SMA_Long"] = data["Close"].rolling(window=long_window).mean()
    data["Signal"] = 0
    data.loc[data["SMA_Short"] > data["SMA_Long"], "Signal"] = 1
    data["Market_Return"] = data["Close"].pct_change()
    data.replace([np.inf, -np.inf], 0, inplace=True)
    data["Market_Return"].fillna(0, inplace=True)
    data["Strategy_Return"] = data["Signal"].shift(1) * data["Market_Return"]
    data["Cumulative_Market"] = (1 + data["Market_Return"]).cumprod()
    data["Cumulative_Strategy"] = (1 + data["Strategy_Return"].fillna(0)).cumprod()
    return data

def apply_mean_reversion_strategy(df, window=20, threshold=2.0):
    # (Unchanged)
    data = df.copy()
    data["Moving_Avg"] = data["Close"].rolling(window=window).mean()
    data["Std_Dev"] = data["Close"].rolling(window=window).std()
    data["Z_Score"] = (data["Close"] - data["Moving_Avg"]) / data["Std_Dev"]
    data["Signal"] = 0
    data.loc[data["Z_Score"] < -threshold, "Signal"] = 1
    data.loc[data["Z_Score"] > threshold, "Signal"] = -1
    data["Market_Return"] = data["Close"].pct_change()
    data.replace([np.inf, -np.inf], 0, inplace=True)
    data["Market_Return"].fillna(0, inplace=True)
    data["Strategy_Return"] = data["Signal"].shift(1) * data["Market_Return"]
    data["Cumulative_Market"] = (1 + data["Market_Return"]).cumprod()
    data["Cumulative_Strategy"] = (1 + data["Strategy_Return"].fillna(0)).cumprod()
    return data

def apply_ml_strategy(df, use_hybrid=False):
    """
    Random Forest Trend Follower (Alignment Fixed)
    """
    # 1. CAPTURE ORIGINAL INDEX
    original_index = df.index
    data = df.copy()

    # 2. Feature Engineering
    data["RSI"] = calculate_rsi(data["Close"], 14)
    data["Return_1d"] = data["Close"].pct_change()
    data["Return_5d"] = data["Close"].pct_change(5)
    data["Vol_20"] = data["Close"].rolling(20).std()
    data["SMA_20"] = data["Close"].rolling(20).mean()
    data["Dist_SMA"] = (data["Close"] - data["SMA_20"]) / data["SMA_20"]

    # Drop NaNs for features, BUT separate X/y first so we don't lose the last row
    feature_cols = ["RSI", "Return_1d", "Return_5d", "Vol_20", "Dist_SMA"]
    
    # We only drop rows that are missing FEATURES (the first 20 days)
    # This preserves the last row (today) which has features but no future target
    data_clean = data.dropna(subset=feature_cols).copy()

    if len(data_clean) < 50:
        # Fallback if data is too short
        return pd.DataFrame(index=original_index, data={"Strategy_Return": 0.0})

    X = data_clean[feature_cols]
    
    # Target: 1 if NEXT day return > 0 (Shift -1)
    y = (data_clean["Return_1d"].shift(-1) > 0).astype(int)

    # 3. Create Training Set (Drop last row where Target is Unknown)
    X_train_full = X.iloc[:-1]
    y_train_full = y.iloc[:-1]

    split_idx = int(len(X_train_full) * 0.70)
    
    # Training Data
    X_train = X_train_full.iloc[:split_idx]
    y_train = y_train_full.iloc[:split_idx]

    # 4. Train Model
    model = RandomForestClassifier(n_estimators=100, min_samples_leaf=5, random_state=42)
    model.fit(X_train, y_train)

    # 5. Generate Signals
    if use_hybrid:
        # Hybrid Mode: Train = 1 (Buy & Hold), Test = Model
        signals_train = pd.Series(1, index=X_train.index)
        
        # Predict on everything after split (including Today)
        X_test_all = X.iloc[split_idx:]
        preds_test = pd.Series(model.predict(X_test_all), index=X_test_all.index)
        
        full_signals = pd.concat([signals_train, preds_test])
    else:
        # Strict Mode: Test Only
        X_test_all = X.iloc[split_idx:]
        full_signals = pd.Series(model.predict(X_test_all), index=X_test_all.index)

    # 6. Align Signals (Shift 1 to apply to Returns)
    # Signal T -> Position T+1
    # This alignment is currently on the 'data_clean' index (shortened)
    aligned_signals = full_signals.shift(1)

    # 7. CRITICAL FIX: Re-index to ORIGINAL DF to restore full timeline
    # Fill Start Gaps (Training period missing features) -> 1 (Buy/Hold) if Hybrid
    # Fill End Gaps (Shouldn't exist now, but safe to fill with prev value)
    fill_val = 1 if use_hybrid else 0
    final_signals = aligned_signals.reindex(original_index).fillna(fill_val)

    # 8. Calculate Returns on the FULL original timeline
    final_df = pd.DataFrame(index=original_index)
    final_df["Market_Return"] = df["Close"].pct_change().fillna(0)
    final_df["Signal"] = final_signals
    final_df["Strategy_Return"] = final_df["Signal"] * final_df["Market_Return"]

    # 9. Normalize
    final_df["Cumulative_Market"] = (1 + final_df["Market_Return"]).cumprod()
    final_df["Cumulative_Strategy"] = (1 + final_df["Strategy_Return"]).cumprod()

    return final_df

def predict_future_prices(df, days=21):
    # (Unchanged)
    data = df.copy()
    data["RSI"] = calculate_rsi(data["Close"], 14)
    data["Return_1d"] = data["Close"].pct_change()
    data["Return_5d"] = data["Close"].pct_change(5)
    data["Vol_20"] = data["Close"].rolling(20).std()
    data["SMA_20"] = data["Close"].rolling(20).mean()
    data["Dist_SMA"] = (data["Close"] - data["SMA_20"]) / data["SMA_20"]
    data.dropna(inplace=True)

    data["Target_Return"] = data["Return_1d"].shift(-1)
    train_data = data.dropna()

    X = train_data[["RSI", "Return_1d", "Return_5d", "Vol_20", "Dist_SMA"]]
    y = train_data["Target_Return"]

    model = RandomForestRegressor(n_estimators=100, min_samples_leaf=5, random_state=42)
    model.fit(X, y)
    residuals = y - model.predict(X)
    uncertainty_std = residuals.std()

    future_dates = pd.date_range(start=data.index[-1] + pd.Timedelta(days=1), periods=days, freq="B")
    current_row = data.iloc[[-1]].copy()
    last_price = current_row["Close"].values[0]
    forecast_results = []
    base_price = data["Close"].iloc[-1]

    for i, date in enumerate(future_dates):
        features = current_row[["RSI", "Return_1d", "Return_5d", "Vol_20", "Dist_SMA"]]
        pred_return = model.predict(features)[0]
        next_price = last_price * (1 + pred_return)
        vol_scaling = np.sqrt(i + 1)
        upper_band = next_price * (1 + (1.96 * uncertainty_std * vol_scaling))
        lower_band = next_price * (1 - (1.96 * uncertainty_std * vol_scaling))

        forecast_results.append({
            "Date": date.strftime("%Y-%m-%d"),
            "Forecast_Ratio": next_price / base_price,
            "Upper_Ratio": upper_band / base_price,
            "Lower_Ratio": lower_band / base_price,
        })
        last_price = next_price
        current_row["Return_1d"] = pred_return 

    return forecast_results

def calculate_performance_metrics(series):
    if len(series) == 0: return {"Error": "No data"}
    cumulative = (1 + series).cumprod()
    total_return = cumulative.iloc[-1] - 1
    volatility = series.std() * np.sqrt(252)
    sharpe = (series.mean() / series.std()) * np.sqrt(252) if volatility != 0 else 0
    running_max = cumulative.cummax()
    drawdown = (cumulative - running_max) / running_max
    max_drawdown = drawdown.min()
    return {
        "Total Return": f"{total_return * 100:.2f}%",
        "Volatility": f"{volatility * 100:.2f}%",
        "Sharpe Ratio": f"{sharpe:.2f}",
        "Max Drawdown": f"{max_drawdown * 100:.2f}%",
    }
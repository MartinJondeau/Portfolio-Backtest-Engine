# Strategies
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
    """
    Classic SMA Crossover:
    - Long (1) when Short SMA > Long SMA
    - Cash (0) otherwise
    """
    data = df.copy()
    data = data[data['Close'] > 0] # Safety filter

    data['SMA_Short'] = data['Close'].rolling(window=short_window).mean()
    data['SMA_Long'] = data['Close'].rolling(window=long_window).mean()
    
    data['Signal'] = 0
    data.loc[data['SMA_Short'] > data['SMA_Long'], 'Signal'] = 1
    
    # Calculate Returns
    data['Market_Return'] = data['Close'].pct_change()
    data.replace([np.inf, -np.inf], 0, inplace=True)
    data['Market_Return'].fillna(0, inplace=True)
    
    data['Strategy_Return'] = data['Signal'].shift(1) * data['Market_Return']
    
    data['Cumulative_Market'] = (1 + data['Market_Return']).cumprod()
    data['Cumulative_Strategy'] = (1 + data['Strategy_Return'].fillna(0)).cumprod()
    
    return data

def apply_mean_reversion_strategy(df, window=20, threshold=2.0):
    """
    Bollinger Band / Z-Score Reversion:
    - Buy (1) when Price is cheap (Z < -2)
    - Short (-1) when Price is expensive (Z > 2)
    """
    data = df.copy()
    
    data['Moving_Avg'] = data['Close'].rolling(window=window).mean()
    data['Std_Dev'] = data['Close'].rolling(window=window).std()
    data['Z_Score'] = (data['Close'] - data['Moving_Avg']) / data['Std_Dev']
    
    data['Signal'] = 0
    data.loc[data['Z_Score'] < -threshold, 'Signal'] = 1
    data.loc[data['Z_Score'] > threshold, 'Signal'] = -1
    
    data['Market_Return'] = data['Close'].pct_change()
    data.replace([np.inf, -np.inf], 0, inplace=True)
    data['Market_Return'].fillna(0, inplace=True)

    data['Strategy_Return'] = data['Signal'].shift(1) * data['Market_Return']
    
    data['Cumulative_Market'] = (1 + data['Market_Return']).cumprod()
    data['Cumulative_Strategy'] = (1 + data['Strategy_Return'].fillna(0)).cumprod()
    
    return data

def apply_ml_strategy(df):
    """
    Random Forest Trend Follower (Corrected):
    - Align signals correctly (Signal T acts on Return T+1)
    - Fixes NaN issues in metrics
    - Normalizes start value to 1.00
    """
    data = df.copy()
    
    # --- 1. Feature Engineering ---
    data['RSI'] = calculate_rsi(data['Close'], 14)
    data['Return_1d'] = data['Close'].pct_change()
    data['Return_5d'] = data['Close'].pct_change(5)
    data['Vol_20'] = data['Close'].rolling(20).std()
    data['SMA_20'] = data['Close'].rolling(20).mean()
    data['Dist_SMA'] = (data['Close'] - data['SMA_20']) / data['SMA_20']
    
    data.dropna(inplace=True)

    # --- 2. Target: predict if Tomorrow's Return is > 0 ---
    data['Target'] = (data['Return_1d'].shift(-1) > 0).astype(int)

    # --- 3. Time Series Split (70% Train / 30% Test) ---
    split_idx = int(len(data) * 0.70)
    
    feature_cols = ['RSI', 'Return_1d', 'Return_5d', 'Vol_20', 'Dist_SMA']
    X = data[feature_cols]
    y = data['Target']
    
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
    
    # --- 4. Train Model ---
    model = RandomForestClassifier(n_estimators=100, min_samples_leaf=5, random_state=42)
    model.fit(X_train, y_train)
    
    # --- 5. Predict (Out-of-Sample) ---
    # Prediction at index T is for the movement at T+1
    predictions = model.predict(X_test)
    
    # Create Test Data slice
    test_data = data.iloc[split_idx:].copy()
    test_data['Signal'] = predictions
    
    # --- 6. Calculate Returns (The Fix) ---
    # Shift Signal by 1: We decide 'Yesterday' to trade 'Today'
    test_data['Position'] = test_data['Signal'].shift(1)
    
    # Calculate Strategy Returns
    test_data['Strategy_Return'] = test_data['Position'] * test_data['Return_1d']
    test_data['Market_Return'] = test_data['Return_1d']
    
    # Drop the first row (NaN due to shift) and last row (Target was NaN)
    test_data.dropna(subset=['Strategy_Return', 'Target'], inplace=True)

    # --- 7. Normalize Cumulative Curves (Start at 1.00) ---
    # We calculate cumprod, then divide by the first value to force start at 1.0
    test_data['Cumulative_Market'] = (1 + test_data['Market_Return']).cumprod()
    test_data['Cumulative_Strategy'] = (1 + test_data['Strategy_Return']).cumprod()
    
    # Normalization: Ensure chart starts at 1.0 for valid comparison
    test_data['Cumulative_Market'] = test_data['Cumulative_Market'] / test_data['Cumulative_Market'].iloc[0]
    test_data['Cumulative_Strategy'] = test_data['Cumulative_Strategy'] / test_data['Cumulative_Strategy'].iloc[0]
    
    return test_data

def predict_future_prices(df, days=21):
    """
    Forecasting Engine:
    1. Trains Random Forest on historical returns.
    2. Recursively predicts next 21 days.
    3. Simulates Confidence Intervals using historical volatility.
    """
    data = df.copy()
    
    # --- 1. Feature Engineering ---
    data['RSI'] = calculate_rsi(data['Close'], 14)
    data['Return_1d'] = data['Close'].pct_change()
    data['Return_5d'] = data['Close'].pct_change(5)
    data['Vol_20'] = data['Close'].rolling(20).std()
    data['SMA_20'] = data['Close'].rolling(20).mean()
    data['Dist_SMA'] = (data['Close'] - data['SMA_20']) / data['SMA_20']
    
    data.dropna(inplace=True)

    # --- 2. Train Regressor ---
    # Target: The Magnitude of tomorrow's return
    data['Target_Return'] = data['Return_1d'].shift(-1)
    train_data = data.dropna()
    
    X = train_data[['RSI', 'Return_1d', 'Return_5d', 'Vol_20', 'Dist_SMA']]
    y = train_data['Target_Return']
    
    model = RandomForestRegressor(n_estimators=100, min_samples_leaf=5, random_state=42)
    model.fit(X, y)
    
    # Calculate error for Confidence Intervals
    residuals = y - model.predict(X)
    uncertainty_std = residuals.std()

    # --- 3. Recursive Forecasting ---
    future_dates = pd.date_range(start=data.index[-1] + pd.Timedelta(days=1), periods=days, freq='B')
    current_row = data.iloc[[-1]].copy()
    last_price = current_row['Close'].values[0]
    
    forecast_results = []
    
    # Calculate the Base Price (Last known close) to normalize everything
    base_price = data['Close'].iloc[-1]

    for i, date in enumerate(future_dates):
        features = current_row[['RSI', 'Return_1d', 'Return_5d', 'Vol_20', 'Dist_SMA']]
        pred_return = model.predict(features)[0]
        
        # Calculate Future Price
        next_price = last_price * (1 + pred_return)
        
        # Confidence Intervals (expanding over time)
        vol_scaling = np.sqrt(i + 1)
        upper_band = next_price * (1 + (1.96 * uncertainty_std * vol_scaling))
        lower_band = next_price * (1 - (1.96 * uncertainty_std * vol_scaling))
        
        # Save as RATIOS (relative to the last known price) so we can plot it on the cumulative chart
        forecast_results.append({
            "Date": date.strftime("%Y-%m-%d"),
            "Forecast_Ratio": next_price / base_price,
            "Upper_Ratio": upper_band / base_price,
            "Lower_Ratio": lower_band / base_price
        })
        
        last_price = next_price
        current_row['Return_1d'] = pred_return # Update state for next step
        
    return forecast_results

def calculate_performance_metrics(series):
    """Computes key financial metrics"""
    if len(series) == 0:
        return {"Error": "No data"}

    cumulative = (1 + series).cumprod()
    total_return = cumulative.iloc[-1] - 1
    volatility = series.std() * np.sqrt(252)
    
    if volatility == 0:
        sharpe = 0
    else:
        sharpe = (series.mean() / series.std()) * np.sqrt(252)
        
    running_max = cumulative.cummax()
    drawdown = (cumulative - running_max) / running_max
    max_drawdown = drawdown.min()
    
    return {
        "Total Return": f"{total_return * 100:.2f}%",
        "Volatility": f"{volatility * 100:.2f}%",
        "Sharpe Ratio": f"{sharpe:.2f}",
        "Max Drawdown": f"{max_drawdown * 100:.2f}%"
    }
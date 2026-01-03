# Strategies
# Import libraries
import pandas as pd
import numpy as np

def apply_sma_strategy(df, short_window=20, long_window=50):
    """
    Applies the classic Simple Moving Average Crossover strategy on a single asset
    When the 20-day average goes over the 50-day average we buy, when it goes under we sell
    Returns the dataframe with 'Strategy' (cumulative returns) and 'Signal' columns
    """
    data = df.copy()

    # In case you want to test us on WTI crude
    data = data[data['Close'] > 0]

    # Calculate Moving Averages
    data['SMA_Short'] = data['Close'].rolling(window=short_window).mean()
    data['SMA_Long'] = data['Close'].rolling(window=long_window).mean()
    
    # Encode Signals (1 = Buy, 0 = Neutral)
    # If Short > Long, we are long, otherwise we are out (Cash)
    data['Signal'] = 0
    data.loc[data['SMA_Short'] > data['SMA_Long'], 'Signal'] = 1
    
    # Calculate Returns
    # We use pct_change() to get daily returns
    data['Market_Return'] = data['Close'].pct_change()
    data.replace([np.inf, -np.inf], 0, inplace=True)
    data['Market_Return'].fillna(0, inplace=True)
    # Return = Yesterday's Signal * Today's Market Return
    # Signal shifted by 1 because the decision is based on yesterday's close
    data['Strategy_Return'] = data['Signal'].shift(1) * data['Market_Return']
    
    # Cumulative Performance (Growth of €1 invested)
    # We fill NaN with 0 for the initial calculation
    data['Cumulative_Market'] = (1 + data['Market_Return']).cumprod()
    data['Cumulative_Strategy'] = (1 + data['Strategy_Return'].fillna(0)).cumprod()
    
    return data

def apply_mean_reversion_strategy(df, window=20, threshold=2.0):
    """
    Mean Reversion Strategy based on Z-Score (Bollinger Band logic).
    """
    data = df.copy()
    
    # 1. Calculate Statistics
    data['Moving_Avg'] = data['Close'].rolling(window=window).mean()
    data['Std_Dev'] = data['Close'].rolling(window=window).std()
    
    # 2. Calculate Z-Score
    # (Price - Mean) / Std_Dev
    data['Z_Score'] = (data['Close'] - data['Moving_Avg']) / data['Std_Dev']
    
    # 3. Generate Signals
    # If Z-Score < -Threshold (e.g. -2) -> Price is too cheap -> BUY (1)
    # If Z-Score > Threshold (e.g. 2) -> Price is too expensive -> SHORT (-1)
    # Otherwise -> Neutral (0)
    data['Signal'] = 0
    data.loc[data['Z_Score'] < -threshold, 'Signal'] = 1
    data.loc[data['Z_Score'] > threshold, 'Signal'] = -1
    
    # 4. Calculate Returns
    data['Market_Return'] = data['Close'].pct_change()
    
    # Clean Data (Sanitize)
    data['Market_Return'].replace([np.inf, -np.inf], 0, inplace=True)
    data['Market_Return'].fillna(0, inplace=True)
    data.loc[data['Market_Return'] > 1.0, 'Market_Return'] = 0
    data.loc[data['Market_Return'] < -0.99, 'Market_Return'] = 0

    # Strategy Return: 
    # Logic: We hold the position from the previous day
    data['Strategy_Return'] = data['Signal'].shift(1) * data['Market_Return']
    
    # 5. Cumulative Returns
    data['Cumulative_Market'] = (1 + data['Market_Return']).cumprod()
    data['Cumulative_Strategy'] = (1 + data['Strategy_Return'].fillna(0)).cumprod()
    
    return data

def calculate_performance_metrics(series):
    """
    Computes key financial metrics for a series of DAILY returns.
    Input: pandas Series (Daily Returns)
    Output: Dictionary of metrics
    """
    # 1. Total Return
    # We reconstruct the cumulative path to get the final total return
    cumulative = (1 + series).cumprod()
    total_return = cumulative.iloc[-1] - 1
    
    # 2. Annualized Volatility
    # Standard deviation of daily returns * sqrt(252 trading days)
    volatility = series.std() * np.sqrt(252)
    
    # 3. Sharpe Ratio (Assuming Risk-Free Rate = 0 for simplicity)
    # (Mean Daily Return / Std Daily Return) * sqrt(252)
    if volatility == 0:
        sharpe = 0
    else:
        sharpe = (series.mean() / series.std()) * np.sqrt(252)
        
    # 4. Max Drawdown
    # Calculate the running maximum
    running_max = cumulative.cummax()
    # Calculate drawdown relative to running max
    drawdown = (cumulative - running_max) / running_max
    max_drawdown = drawdown.min()
    
    return {
        "Total Return": f"{total_return * 100:.2f}%",
        "Volatility": f"{volatility * 100:.2f}%",
        "Sharpe Ratio": f"{sharpe:.2f}",
        "Max Drawdown": f"{max_drawdown * 100:.2f}%"
    }
# Portfolio Module - Quant B
# Import libraries
import pandas as pd
import numpy as np
from typing import List, Dict, Optional

def calculate_correlation_matrix(assets_data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    """
    Calculate correlation matrix between multiple assets
    
    Args:
        assets_data: Dictionary where keys are tickers and values are DataFrames with 'Close' prices
    
    Returns:
        DataFrame: Correlation matrix
    """
    # Combine all close prices into one DataFrame
    prices = pd.DataFrame()
    
    for ticker, df in assets_data.items():
        if 'Close' in df.columns:
            prices[ticker] = df['Close']
    
    # Calculate returns
    returns = prices.pct_change().dropna()
    
    # Calculate correlation matrix
    correlation_matrix = returns.corr()
    
    return correlation_matrix


def calculate_portfolio_metrics(portfolio_returns: pd.Series) -> Dict[str, str]:
    """
    Calculate portfolio performance metrics
    
    Args:
        portfolio_returns: Series of daily portfolio returns
    
    Returns:
        Dictionary with metrics
    """
    # Total Return
    cumulative = (1 + portfolio_returns).cumprod()
    total_return = cumulative.iloc[-1] - 1
    
    # Annualized Volatility
    volatility = portfolio_returns.std() * np.sqrt(252)
    
    # Sharpe Ratio (assuming risk-free rate = 0)
    if volatility == 0:
        sharpe = 0
    else:
        sharpe = (portfolio_returns.mean() / portfolio_returns.std()) * np.sqrt(252)
    
    # Max Drawdown
    running_max = cumulative.cummax()
    drawdown = (cumulative - running_max) / running_max
    max_drawdown = drawdown.min()
    
    return {
        "Total Return": f"{total_return * 100:.2f}%",
        "Volatility": f"{volatility * 100:.2f}%",
        "Sharpe Ratio": f"{sharpe:.2f}",
        "Max Drawdown": f"{max_drawdown * 100:.2f}%"
    }


def simulate_portfolio(
    assets_data: Dict[str, pd.DataFrame],
    weights: Optional[Dict[str, float]] = None,
    rebalance_frequency: str = "never"
) -> pd.DataFrame:
    """
    Simulate portfolio performance with given weights and rebalancing frequency
    
    Args:
        assets_data: Dictionary of ticker -> DataFrame with prices
        weights: Dictionary of ticker -> weight (if None, use equal weights)
        rebalance_frequency: 'never', 'monthly', 'quarterly', 'yearly'
    
    Returns:
        DataFrame with portfolio cumulative returns
    """
    # Combine all close prices
    prices = pd.DataFrame()
    for ticker, df in assets_data.items():
        if 'Close' in df.columns:
            prices[ticker] = df['Close']
    
    # Calculate returns
    returns = prices.pct_change().dropna()
    
    # Set weights (equal weight if not specified)
    if weights is None:
        n_assets = len(returns.columns)
        weights = {ticker: 1/n_assets for ticker in returns.columns}
    
    # Convert weights to array aligned with returns columns
    weights_array = np.array([weights.get(col, 0) for col in returns.columns])
    
    # Normalize weights to sum to 1
    weights_array = weights_array / weights_array.sum()
    
    # Calculate portfolio returns
    if rebalance_frequency == "never":
        # Simple weighted sum of returns
        portfolio_returns = (returns * weights_array).sum(axis=1)
    else:
        # Implement rebalancing logic
        portfolio_returns = rebalance_portfolio(returns, weights_array, rebalance_frequency)
    
    # Calculate cumulative returns
    portfolio_cumulative = (1 + portfolio_returns).cumprod()
    
    result = pd.DataFrame({
        'Date': portfolio_cumulative.index,
        'Portfolio_Return': portfolio_returns.values,
        'Portfolio_Cumulative': portfolio_cumulative.values
    })
    
    return result


def rebalance_portfolio(returns: pd.DataFrame, initial_weights: np.ndarray, frequency: str) -> pd.Series:
    """
    Calculate portfolio returns with periodic rebalancing
    
    Args:
        returns: DataFrame of asset returns
        initial_weights: Initial portfolio weights
        frequency: 'monthly', 'quarterly', 'yearly'
    
    Returns:
        Series of portfolio returns
    """
    portfolio_returns = pd.Series(index=returns.index, dtype=float)
    
    # Determine rebalancing period
    if frequency == "monthly":
        rebalance_offset = pd.DateOffset(months=1)
    elif frequency == "quarterly":
        rebalance_offset = pd.DateOffset(months=3)
    elif frequency == "yearly":
        rebalance_offset = pd.DateOffset(years=1)
    else:
        # No rebalancing
        return (returns * initial_weights).sum(axis=1)
    
    # Track portfolio weights over time
    current_weights = initial_weights.copy()
    last_rebalance_date = returns.index[0]
    
    for date in returns.index:
        # Check if it's time to rebalance
        if date >= last_rebalance_date + rebalance_offset:
            current_weights = initial_weights.copy()
            last_rebalance_date = date
        
        # Calculate portfolio return for this day
        daily_return = (returns.loc[date] * current_weights).sum()
        portfolio_returns[date] = daily_return
        
        # Update weights based on returns (weights drift with performance)
        if daily_return != -1:  # Avoid division by zero
            current_weights = current_weights * (1 + returns.loc[date]) / (1 + daily_return)
    
    return portfolio_returns

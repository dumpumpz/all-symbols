# -*- coding: utf-8 -*-
import pandas as pd
import requests
from datetime import datetime
import time
import os
import logging
import sys
from typing import Dict, List, Optional, Set, Tuple
import json
import math

# --- Configuration for Historical Analysis ---
SYMBOLS: List[str] = []

ANALYSIS_CANDLE_COUNTS: Dict[str, int] = {
    '5m': 500,
    '15m': 500,
    '30m': 500,
    '1h': 500,
    '2h': 500,
    '4h': 500,
    '1d': 100
}
DEFAULT_ANALYSIS_CANDLE_COUNT = 2000

TIMEFRAMES = ['5m', '15m', '30m', '1h', '2h', '4h', '1d']

# Data fetching settings
HISTORICAL_DATA_CHUNK_LIMIT = 1000
API_RETRY_ATTEMPTS = 3
API_RETRY_DELAY = 5
REQUEST_TIMEOUT = 20

# Strategy Indicator Settings
EMA_SHORT_PERIOD = 13
EMA_LONG_PERIOD = 49
SMA_SHORT_PERIOD = 13
SMA_LONG_PERIOD = 49
MIN_CANDLES_FOR_INDICATORS = max(EMA_LONG_PERIOD, SMA_LONG_PERIOD)

# --- Output File Configuration ---
JSON_FILENAME_PREFIX = "signals_report"

_temp_map_tf_for_gui_slots = {
    "1m": "1min", "3m": "3min", "5m": "5min", "15m": "15min", "30m": "30min",
    "1h": "1hour", "2h": "2hour", "4h": "4hour", "6h": "6hour", "8h": "8hour",
    "12h": "12hour", "1d": "1day", "3d": "3day", "1w": "1week", "1M": "1month"
}

# --- Logging Setup ---
logging.getLogger().handlers.clear()
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logging.getLogger("requests").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)


# --- Helper Functions ---
def make_request(url: str, params: Optional[Dict] = None, headers: Optional[Dict] = None,
                 timeout: int = REQUEST_TIMEOUT) -> Optional[any]:
    for attempt in range(API_RETRY_ATTEMPTS):
        try:
            response = requests.get(url, params=params, headers=headers, timeout=timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logging.error(f"Request exception (attempt {attempt + 1}/{API_RETRY_ATTEMPTS}): {url} - {e}")
        time.sleep(API_RETRY_DELAY * (attempt + 1))
    logging.error(f"Request failed after {API_RETRY_ATTEMPTS} attempts: {url}")
    return None


def get_top_volume_usdt_pairs(limit: int = 20) -> List[str]:
    url = "https://api.binance.com/api/v3/ticker/24hr"
    logging.info(f"Fetching 24h ticker data to find top {limit} USDT pairs...")
    response_data = make_request(url)
    if not response_data or not isinstance(response_data, list):
        logging.error("Failed to fetch or parse ticker data from Binance.")
        return []
    try:
        usdt_pairs = [p for p in response_data if
                      p.get('symbol', '').endswith('USDT') and float(p.get('quoteVolume', 0)) > 0]
        usdt_pairs = [p for p in usdt_pairs if
                      not any(x in p['symbol'] for x in ['UPUSDT', 'DOWNUSDT', 'BEARUSDT', 'BULLUSDT'])]
        sorted_pairs = sorted(usdt_pairs, key=lambda p: float(p['quoteVolume']), reverse=True)
        top_symbols = [p['symbol'] for p in sorted_pairs[:limit]]
        logging.info(f"Found {len(top_symbols)} top USDT pairs by volume.")
        return top_symbols
    except (TypeError, KeyError, ValueError) as e:
        logging.error(f"Error processing ticker data: {e}", exc_info=True)
        return []


class BinanceAPI:
    BASE_URL = "https://api.binance.com/api/v3"
    HEADERS = {'Content-Type': 'application/json', 'Accept': 'application/json'}

    @staticmethod
    def _process_raw_klines_to_df(klines_raw: List[List[any]], symbol: str, interval: str) -> Optional[pd.DataFrame]:
        if not klines_raw: return pd.DataFrame()
        columns = ['open_time', 'open', 'high', 'low', 'close', 'volume', 'close_time', 'quote_asset_volume',
                   'number_of_trades', 'taker_buy_base_asset_volume', 'taker_buy_quote_asset_volume', 'ignore']
        try:
            df = pd.DataFrame(klines_raw, columns=columns)
            numeric_cols = ['open', 'high', 'low', 'close', 'volume']
            for col in numeric_cols: df[col] = pd.to_numeric(df[col], errors='coerce')
            df['open_time'] = pd.to_datetime(df['open_time'], unit='ms', utc=True)
            df = df.set_index('open_time')
            df = df[['open', 'high', 'low', 'close', 'volume']].dropna()
            return df
        except Exception as e:
            logging.error(f"[{symbol}/{interval}] Error processing klines to DataFrame: {e}.")
            return None

    @staticmethod
    def _clean_historical_df(df: pd.DataFrame) -> pd.DataFrame:
        if df.empty: return df
        df_cleaned = df[(df[['open', 'high', 'low', 'close']] > 0).all(axis=1)]
        if not df_cleaned.index.is_unique:
            df_cleaned = df_cleaned[~df_cleaned.index.duplicated(keep='first')]
        df_cleaned = df_cleaned.sort_index()
        return df_cleaned

    @staticmethod
    def fetch_recent_klines(symbol: str, interval: str, num_candles: int) -> Optional[pd.DataFrame]:
        logging.info(f"[{symbol}/{interval}] Fetching the most recent {num_candles} candles...")
        all_klines_list = []
        end_time_ms = None
        calls_needed = math.ceil(num_candles / HISTORICAL_DATA_CHUNK_LIMIT)
        for i in range(calls_needed):
            limit = min(num_candles - len(all_klines_list), HISTORICAL_DATA_CHUNK_LIMIT)
            params = {"symbol": symbol.upper(), "interval": interval, "limit": limit}
            if end_time_ms:
                params["endTime"] = end_time_ms
            url = f"{BinanceAPI.BASE_URL}/klines"
            klines_chunk_raw = make_request(url, params=params, headers=BinanceAPI.HEADERS)
            if klines_chunk_raw is None: return None
            if not klines_chunk_raw: break
            all_klines_list = klines_chunk_raw + all_klines_list
            end_time_ms = klines_chunk_raw[0][0] - 1
            if len(all_klines_list) >= num_candles:
                break
            time.sleep(0.3)
        if not all_klines_list:
            logging.warning(f"[{symbol}/{interval}] No data fetched.")
            return pd.DataFrame()
        df_fetched = BinanceAPI._process_raw_klines_to_df(all_klines_list, symbol, interval)
        df_cleaned = BinanceAPI._clean_historical_df(df_fetched)
        return df_cleaned.tail(num_candles)


# --- Logic Functions ---
def calculate_indicators(df: pd.DataFrame) -> Optional[pd.DataFrame]:
    if df is None or df.empty or len(df) < MIN_CANDLES_FOR_INDICATORS:
        return None
    df_res = df.copy()
    for period in [SMA_SHORT_PERIOD, SMA_LONG_PERIOD]:
        df_res[f'SMA_{period}'] = df_res['close'].rolling(window=period).mean()
    for period in [EMA_SHORT_PERIOD, EMA_LONG_PERIOD]:
        df_res[f'EMA_{period}'] = df_res['close'].ewm(span=period, adjust=False).mean()
    ema_s, ema_l = f'EMA_{EMA_SHORT_PERIOD}', f'EMA_{EMA_LONG_PERIOD}'
    sma_s, sma_l = f'SMA_{SMA_SHORT_PERIOD}', f'SMA_{SMA_LONG_PERIOD}'
    df_res['market_state'] = "Grey"
    long_cond = (df_res[ema_s] > df_res[ema_l]) & (df_res[sma_s] > df_res[sma_l]) & (df_res[ema_s] > df_res[sma_l]) & (
            df_res[sma_s] > df_res[ema_l])
    short_cond = (df_res[ema_s] < df_res[ema_l]) & (df_res[sma_s] < df_res[sma_l]) & (df_res[ema_s] < df_res[sma_l]) & (
            df_res[sma_s] < df_res[ema_l])
    df_res.loc[long_cond, 'market_state'] = "Green"
    df_res.loc[short_cond, 'market_state'] = "Red"
    return df_res


def calculate_levels_at_transition(df: pd.DataFrame, idx: int, setup_type: str) -> Optional[Dict[str, float]]:
    if not (0 <= idx < len(df)): return None
    start_slice_idx = idx - 1
    while start_slice_idx >= 0 and df['market_state'].iloc[start_slice_idx] == 'Grey':
        start_slice_idx -= 1
    start_slice_idx = max(0, start_slice_idx + 1)
    relevant_slice = df.iloc[start_slice_idx: idx + 1]
    if relevant_slice.empty: return None
    min_low = relevant_slice['low'].min()
    max_high = relevant_slice['high'].max()
    if setup_type == 'Green':
        return {'resistance': min_low, 'stoploss': max_high}
    elif setup_type == 'Red':
        return {'resistance': max_high, 'stoploss': min_low}
    return None


def check_and_update_setups_for_candle(symbol: str, timeframe: str, df: pd.DataFrame, idx: int, green_setup: Dict,
                                       red_setup: Dict) -> List[Dict]:
    signals = []
    if idx < 1: return signals
    current, prev = df.iloc[idx], df.iloc[idx - 1]
    cc_time, cc_open, cc_close, cc_state = current.name, current['open'], current['close'], current['market_state']
    pc_state = prev['market_state']
    if pd.isna(cc_state) or pd.isna(pc_state): return signals
    if (pc_state == 'Grey' or pc_state == 'Red') and cc_state == 'Green':
        levels = calculate_levels_at_transition(df, idx, 'Green')
        if levels:
            green_setup.update({'active': True, 'transition_time': cc_time, 'original_level': levels['resistance'],
                                'running_level': levels['resistance'], 'json_resistance_level': levels['resistance'],
                                'json_stoploss_level': levels['stoploss']})
    if (pc_state == 'Grey' or pc_state == 'Green') and cc_state == 'Red':
        levels = calculate_levels_at_transition(df, idx, 'Red')
        if levels:
            red_setup.update({'active': True, 'transition_time': cc_time, 'original_level': levels['resistance'],
                              'running_level': levels['resistance'], 'json_resistance_level': levels['resistance'],
                              'json_stoploss_level': levels['stoploss']})
    if green_setup.get('active') and green_setup.get('transition_time') != cc_time:
        if cc_open < green_setup['original_level'] and cc_close < green_setup['running_level']:
            signals.append({'symbol': symbol, 'timeframe': timeframe, 'type': 'Green', 'reason': 'Triggered',
                            'transition_time': green_setup['transition_time'], 'alert_time': cc_time,
                            'alert_candle_close': cc_close, 'json_resistance_val': green_setup['json_resistance_level'],
                            'json_stoploss_val': green_setup['json_stoploss_level']})
            green_setup['active'] = False
        elif current['low'] < green_setup['running_level']:
            green_setup['running_level'] = current['low']
    if red_setup.get('active') and red_setup.get('transition_time') != cc_time:
        if cc_open > red_setup['original_level'] and cc_close > red_setup['running_level']:
            signals.append({'symbol': symbol, 'timeframe': timeframe, 'type': 'Red', 'reason': 'Triggered',
                            'transition_time': red_setup['transition_time'], 'alert_time': cc_time,
                            'alert_candle_close': cc_close, 'json_resistance_val': red_setup['json_resistance_level'],
                            'json_stoploss_val': red_setup['json_stoploss_level']})
            red_setup['active'] = False
        elif current['high'] > red_setup['running_level']:
            red_setup['running_level'] = current['high']
    return signals


# --- NEW: Function to load existing signals from JSON files ---
def load_existing_signals() -> Tuple[Set[Tuple[str, str, str]], Dict[str, List[Dict]]]:
    """
    Loads all previously found signals from the JSON report files.

    Returns:
        A tuple containing:
        - A set of unique signal identifiers for fast checking.
        - A dictionary with lists of the full signal data, keyed by timeframe.
    """
    logging.info("Loading existing signals from previous runs...")
    existing_signals_set = set()
    existing_signals_by_tf = {tf: [] for tf in TIMEFRAMES}

    # Reverse map to convert GUI timeframe names back to script-compatible names
    script_tf_map = {v: k for k, v in _temp_map_tf_for_gui_slots.items()}

    for timeframe in TIMEFRAMES:
        filename = f"{JSON_FILENAME_PREFIX}_{timeframe}.json"
        if os.path.exists(filename):
            try:
                with open(filename, 'r') as f:
                    data = json.load(f)
                    if data and isinstance(data, list) and 'sections' in data[0]:
                        # --- MODIFIED: Store the full signal dict to be re-saved later ---
                        existing_signals_by_tf[timeframe] = data[0]['sections']
                        for signal in data[0]['sections']:
                            # Get script-compatible timeframe name for the unique ID
                            gui_tf = signal.get('timeframe_name', '')
                            script_tf = script_tf_map.get(gui_tf, gui_tf)
                            # Create a unique identifier for the signal
                            signal_id = (signal.get('symbol'), script_tf, signal.get('entry_date'))
                            if all(signal_id):  # Ensure no None values
                                existing_signals_set.add(signal_id)

            except (json.JSONDecodeError, IOError, IndexError) as e:
                logging.warning(
                    f"Could not read or parse existing report {filename}. It will be overwritten. Error: {e}")

    logging.info(f"Loaded {len(existing_signals_set)} unique signals from previous runs.")
    return existing_signals_set, existing_signals_by_tf


def generate_timeframe_json_report(signals_list: List[Dict], filename: str):
    # This function now takes a list of signal dictionaries directly
    def map_tf_to_gui_name(tf: str) -> str:
        return _temp_map_tf_for_gui_slots.get(tf, tf)

    def fmt_val(v, p=4):
        return f"{v:.{p}f}" if isinstance(v, (int, float)) and pd.notna(v) else ""

    # --- CORRECTED: Helper function for sorting ---
    def get_sort_key(signal_dict):
        """Ensures the date is a datetime object for sorting."""
        date_val = signal_dict.get('alert_time', signal_dict.get('entry_date'))
        if isinstance(date_val, str):
            # Convert the string to a datetime object AND make it timezone-aware (UTC)
            return pd.to_datetime(date_val, utc=True)
        return date_val

    if not signals_list:
        # Handle case where there are no signals at all
        final_output = [{"sections": [], "master_section_index": -1}]
        try:
            with open(filename, 'w') as f:
                json.dump(final_output, f, indent=4)
            logging.info(f"Successfully saved empty report to {filename}")
        except Exception as e:
            logging.error(f"Error saving empty JSON report to {filename}: {e}")
        return

    sections = []
    # --- MODIFIED: Use the helper function as the key for sorting ---
    sorted_signals = sorted(signals_list, key=get_sort_key)

    for row in sorted_signals:
        # Handle both new dict format and old JSON format
        symbol = row.get('symbol')
        # The 'timeframe' key might not exist in old signals, so we derive it
        gui_tf_name = row.get('timeframe_name', '')
        # Reverse lookup to get script timeframe
        script_tf_map = {v: k for k, v in _temp_map_tf_for_gui_slots.items()}
        timeframe = row.get('timeframe') or script_tf_map.get(gui_tf_name, gui_tf_name)

        # Get the alert_time using the same logic as the sort key
        alert_time = get_sort_key(row)

        signal_type = row.get('type')
        # 'direction' exists in old signals, 'type' in new ones. Need to reconcile.
        if not signal_type:
            signal_type = "Green" if row.get('direction') == "Short" else "Red"

        alert_close = row.get('alert_candle_close') or row.get('entry')
        resistance = row.get('json_resistance_val') or row.get('resistance')
        stoploss = row.get('json_stoploss_val') or row.get('stoploss')

        # Convert numeric strings from old format back to float for formatting
        try:
            alert_close = float(alert_close)
        except (ValueError, TypeError):
            pass
        try:
            resistance = float(resistance)
        except (ValueError, TypeError):
            pass
        try:
            stoploss = float(stoploss)
        except (ValueError, TypeError):
            pass

        gui_tf = map_tf_to_gui_name(timeframe)
        direction = "Short" if signal_type == 'Green' else "Long"

        signal_dict = {
            "type": "section", "timeframe_name": gui_tf, "color_state_index": 3, "is_closed": False,
            "direction": direction, "entry": fmt_val(alert_close),
            "resistance": fmt_val(resistance),
            "stoploss": fmt_val(stoploss), "target": "", "candle_num": "",
            "entry_date": alert_time.strftime('%Y-%m-%d %H:%M'), "symbol": symbol
        }
        sections.append(signal_dict)

    master_idx = 0 if sections else -1
    final_output = [{"sections": sections, "master_section_index": master_idx}]
    try:
        with open(filename, 'w') as f:
            json.dump(final_output, f, indent=4)
        logging.info(f"Successfully saved updated report to {filename}")
    except Exception as e:
        logging.error(f"Error saving JSON report to {filename}: {e}")

# --- Main Execution Logic ---
def run_analysis_loop():
    # --- MODIFIED: Load previously reported signals to create a "memory" ---
    previously_reported_signals_set, existing_signals_by_tf = load_existing_signals()

    # This dictionary will only hold NEW signals found in this run
    new_signals_by_timeframe = {tf: [] for tf in TIMEFRAMES}
    total_new_signals_found = 0

    for symbol in SYMBOLS:
        for timeframe in TIMEFRAMES:
            analysis_candle_count = ANALYSIS_CANDLE_COUNTS.get(timeframe, DEFAULT_ANALYSIS_CANDLE_COUNT)
            logging.info(f"--- Processing {symbol} on {timeframe} timeframe ({analysis_candle_count} candles) ---")

            total_candles_to_fetch = analysis_candle_count + MIN_CANDLES_FOR_INDICATORS
            df_raw = BinanceAPI.fetch_recent_klines(symbol, timeframe, total_candles_to_fetch)
            if df_raw is None or len(df_raw) < total_candles_to_fetch:
                logging.warning(f"Could not fetch enough data for {symbol}/{timeframe}. Skipping.")
                continue

            df_processed = calculate_indicators(df_raw)
            if df_processed is None or df_processed.empty:
                logging.warning(f"Could not calculate indicators for {symbol}/{timeframe}. Skipping.")
                continue

            analysis_df = df_processed.tail(analysis_candle_count).copy()
            active_green_setup = {'active': False}
            active_red_setup = {'active': False}

            for i in range(1, len(analysis_df)):
                signals_this_candle = check_and_update_setups_for_candle(symbol, timeframe, analysis_df, i,
                                                                         active_green_setup, active_red_setup)

                # --- MODIFIED: Check against memory before reporting a signal ---
                for new_signal in signals_this_candle:
                    # Create the unique identifier for this signal
                    alert_time_str = new_signal['alert_time'].strftime('%Y-%m-%d %H:%M')
                    signal_id = (new_signal['symbol'], new_signal['timeframe'], alert_time_str)

                    if signal_id not in previously_reported_signals_set:
                        logging.info(f"★★★★★ NEW SIGNAL FOUND ★★★★★ [{symbol}/{timeframe}] on {alert_time_str}")
                        new_signals_by_timeframe[timeframe].append(new_signal)
                        # Add to set to avoid duplicates within the same run
                        previously_reported_signals_set.add(signal_id)
                        total_new_signals_found += 1

            time.sleep(0.5)

    logging.info("\n--- Analysis Complete ---")
    if total_new_signals_found == 0:
        logging.info("No new signals found in this run. Reports will be re-saved with existing data.")
    else:
        logging.info(f"Found a total of {total_new_signals_found} new signals. Updating reports...")

    # --- MODIFIED: Combine old and new signals before saving the final reports ---
    for timeframe in TIMEFRAMES:
        old_signals_list = existing_signals_by_tf.get(timeframe, [])
        new_signals_list = new_signals_by_timeframe.get(timeframe, [])
        combined_signals = old_signals_list + new_signals_list

        filename = f"{JSON_FILENAME_PREFIX}_{timeframe}.json"

        # Generate report even if it's just to re-save old signals or create an empty file
        generate_timeframe_json_report(combined_signals, filename)


if __name__ == "__main__":
    SYMBOLS = get_top_volume_usdt_pairs(limit=50)
    if not SYMBOLS:
        logging.critical("Could not fetch top symbols from Binance. Exiting.")
        sys.exit(1)

    logging.info("Analysis will be performed on a rolling window of recent candles for each timeframe.")
    logging.info(f"Starting analysis for {len(SYMBOLS)} symbols: {str(SYMBOLS)[:200]}...")

    try:
        run_analysis_loop()
    except Exception as e:
        logging.critical("--- Analysis CRASHED! ---", exc_info=True)
    finally:
        logging.info("--- Script Finished ---")

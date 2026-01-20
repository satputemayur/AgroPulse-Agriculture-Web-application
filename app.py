from flask import Flask, render_template, request, jsonify
import requests
import pandas as pd
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX
import sqlite3
import hashlib
import json
from threading import Thread
import numpy as np

# ===== CHATBOT IMPORTS (NEW) =====
import google.generativeai as genai
from PIL import Image
import io
import base64

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'cropwise-secret-key-2024'

# ===== DATABASE CONFIGURATION =====
DB_NAME = 'cropwise_cache.db'

# ===== API CONFIGURATIONS =====
AGRI_API_URL = "https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24"
AGRI_API_KEY = "579b464db66ec23bdd000001a3358e052ea048487bdf4f3a528f229f"

WEATHER_API_KEY = "923d2e28109a9e8f0b78baf3a8cb4730"
WEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5/"

NEWS_API_KEY = "47f99de7bc1b4242abb6df59f5216840"
YOUTUBE_API_KEY = "AIzaSyDgLjQvSEH5_f-fefuVedgV4yW7IqyZ8Vo"

# ===== CHATBOT CONFIGURATION (NEW) =====
GEMINI_API_KEY = 'AIzaSyCaYtyYIlmDFLcZNJidedUMoKNqBeRYmkw'
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.0-flash-exp')

FARMING_CONTEXT = """You are an expert agricultural assistant helping farmers in India, especially Maharashtra. 
You provide practical advice on:
- Crop cultivation and best practices for Indian farming
- Fertilizer recommendations based on crop type, soil, and growth stage
- Pest and disease identification and organic/chemical treatments
- Weather-based farming suggestions
- Irrigation and water management techniques
- Organic farming methods suitable for Indian conditions
- Government schemes for farmers (PM-KISAN, PMFBY, etc.)
- Market price trends and when to sell crops
- Soil health and nutrient management

Keep responses concise (2-4 paragraphs), practical, and farmer-friendly.
Use simple language that farmers can understand.
When possible, provide both organic and chemical treatment options.
If you see a crop disease image, identify the disease clearly and suggest immediate treatments.
Always prioritize the farmer's economic benefit and sustainability."""

def init_database():
    """Initialize SQLite database for caching"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Table for raw API data cache
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS api_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cache_key TEXT UNIQUE NOT NULL,
            data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP
        )
    ''')
    
    # Table for historical price data
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS price_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            state TEXT NOT NULL,
            district TEXT NOT NULL,
            commodity TEXT NOT NULL,
            arrival_date DATE NOT NULL,
            market TEXT,
            min_price REAL,
            max_price REAL,
            modal_price REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(state, district, commodity, arrival_date, market)
        )
    ''')
    
    # Table for forecast cache
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS forecast_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            state TEXT NOT NULL,
            district TEXT NOT NULL,
            commodity TEXT NOT NULL,
            target_date DATE NOT NULL,
            forecast_data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            UNIQUE(state, district, commodity, target_date)
        )
    ''')
    
    # Create indexes for faster queries
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_price_lookup 
        ON price_history(state, district, commodity, arrival_date)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_forecast_lookup 
        ON forecast_cache(state, district, commodity, target_date)
    ''')
    
    conn.commit()
    conn.close()
    print("✅ Database initialized successfully")

# Initialize DB on startup
init_database()

# ===== CACHE HELPER FUNCTIONS =====

def generate_cache_key(params):
    """Generate unique cache key from parameters"""
    param_str = json.dumps(params, sort_keys=True)
    return hashlib.md5(param_str.encode()).hexdigest()

def get_from_cache(cache_key, cache_hours=24):
    """Get data from cache if not expired"""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT data, expires_at FROM api_cache 
            WHERE cache_key = ? AND expires_at > datetime('now')
        ''', (cache_key,))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            print(f"✅ Cache HIT for key: {cache_key[:8]}...")
            return json.loads(result[0])
        else:
            print(f"❌ Cache MISS for key: {cache_key[:8]}...")
            return None
    except Exception as e:
        print(f"Cache error: {e}")
        return None

def save_to_cache(cache_key, data, cache_hours=24):
    """Save data to cache with expiration"""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        expires_at = datetime.now() + timedelta(hours=cache_hours)
        
        cursor.execute('''
            INSERT OR REPLACE INTO api_cache (cache_key, data, expires_at)
            VALUES (?, ?, ?)
        ''', (cache_key, json.dumps(data), expires_at))
        
        conn.commit()
        conn.close()
        print(f"💾 Cached data for key: {cache_key[:8]}...")
    except Exception as e:
        print(f"Cache save error: {e}")

def save_price_records_to_db(records, state, district, commodity):
    """Save price records to database for fast retrieval"""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        saved_count = 0
        for record in records:
            try:
                # Parse the date
                date_str = record.get('Arrival_Date', '')
                if not date_str:
                    continue
                    
                arrival_date = datetime.strptime(date_str, '%d/%m/%Y').date()
                
                # Get prices with proper validation
                min_price = record.get('Min_Price', '0')
                max_price = record.get('Max_Price', '0')
                modal_price = record.get('Modal_Price', '0')
                
                # Convert to float, skip if invalid
                try:
                    min_price = float(min_price) if min_price else 0
                    max_price = float(max_price) if max_price else 0
                    modal_price = float(modal_price) if modal_price else 0
                except ValueError:
                    continue
                
                # Skip records with zero prices
                if modal_price == 0:
                    continue
                
                cursor.execute('''
                    INSERT OR REPLACE INTO price_history 
                    (state, district, commodity, arrival_date, market, min_price, max_price, modal_price)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    state,
                    district,
                    commodity,
                    arrival_date,
                    record.get('Market', ''),
                    min_price,
                    max_price,
                    modal_price
                ))
                saved_count += 1
            except Exception as e:
                print(f"Error saving record: {e}")
                continue
        
        conn.commit()
        conn.close()
        print(f"💾 Saved {saved_count} valid records to database (out of {len(records)} total)")
    except Exception as e:
        print(f"DB save error: {e}")

def get_price_records_from_db(state, district, commodity, days_back=365):
    """Get price records from database (much faster than API)"""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        start_date = datetime.now().date() - timedelta(days=days_back)
        
        cursor.execute('''
            SELECT arrival_date, market, min_price, max_price, modal_price
            FROM price_history
            WHERE state = ? AND district = ? AND commodity = ?
            AND arrival_date >= ?
            ORDER BY arrival_date DESC
        ''', (state, district, commodity, start_date))
        
        rows = cursor.fetchall()
        conn.close()
        
        if rows:
            records = []
            for row in rows:
                records.append({
                    'Arrival_Date': row[0] if isinstance(row[0], str) else str(row[0]),
                    'Market': row[1],
                    'Min_Price': str(row[2]),
                    'Max_Price': str(row[3]),
                    'Modal_Price': str(row[4])
                })
            print(f"✅ Retrieved {len(records)} records from database")
            return records
        
        return None
    except Exception as e:
        print(f"DB read error: {e}")
        return None

def get_forecast_from_cache(state, district, commodity, target_date):
    """Get forecast from cache if available and not expired"""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT forecast_data FROM forecast_cache
            WHERE state = ? AND district = ? AND commodity = ? AND target_date = ?
            AND expires_at > datetime('now')
        ''', (state, district, commodity, target_date))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            print(f"✅ Forecast cache HIT")
            return json.loads(result[0])
        else:
            print(f"❌ Forecast cache MISS")
            return None
    except Exception as e:
        print(f"Forecast cache error: {e}")
        return None

def save_forecast_to_cache(state, district, commodity, target_date, forecast_data, cache_hours=12):
    """Save forecast to cache"""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        expires_at = datetime.now() + timedelta(hours=cache_hours)
        
        cursor.execute('''
            INSERT OR REPLACE INTO forecast_cache 
            (state, district, commodity, target_date, forecast_data, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (state, district, commodity, target_date, json.dumps(forecast_data), expires_at))
        
        conn.commit()
        conn.close()
        print(f"💾 Cached forecast data")
    except Exception as e:
        print(f"Forecast cache save error: {e}")

# ===== HELPER FUNCTIONS =====

def fetch_agri_data(params, use_cache=True):
    """Fetch from API with caching"""
    if use_cache:
        cache_key = generate_cache_key(params)
        cached_data = get_from_cache(cache_key)
        if cached_data:
            return cached_data
    
    try:
        response = requests.get(AGRI_API_URL, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        if use_cache:
            save_to_cache(cache_key, data, cache_hours=24)
        
        return data
    except Exception as e:
        print(f"API Error: {e}")
        return {"records": []}

def get_unique_values(column_name, records):
    if not records:
        return []
    df = pd.DataFrame(records)
    if column_name in df.columns:
        return sorted(df[column_name].unique().tolist())
    return []

def calculate_average_price(df):
    df['Min_Price'] = pd.to_numeric(df['Min_Price'], errors='coerce')
    df['Max_Price'] = pd.to_numeric(df['Max_Price'], errors='coerce')
    df['Modal_Price'] = pd.to_numeric(df['Modal_Price'], errors='coerce')
    
    return {
        "min_avg": round(df['Min_Price'].mean(), 2),
        "max_avg": round(df['Max_Price'].mean(), 2),
        "modal_avg": round(df['Modal_Price'].mean(), 2)
    }

def get_recent_dates(state, commodity, district, num_dates=5):
    """Get recent unique dates"""
    params = {
        'api-key': AGRI_API_KEY,
        'format': 'json',
        'limit': 150000,
        'filters[State]': state,
        'filters[Commodity]': commodity,
        'filters[District]': district,
        'sort[Arrival_Date]': 'desc'
    }
    
    data = fetch_agri_data(params)
    records = data.get('records', [])
    
    if not records:
        return []
    
    try:
        dates = []
        for record in records:
            date_str = record.get('Arrival_Date', '')
            if date_str:
                date_obj = datetime.strptime(date_str, '%d/%m/%Y').date()
                dates.append(date_obj)
        
        unique_dates = sorted(set(dates), reverse=True)
        return unique_dates[:num_dates]
    except Exception as e:
        print(f"Error parsing dates: {e}")
        return []

def get_data_for_date(state, commodity, district, date):
    """Get data for specific date"""
    params = {
        'api-key': AGRI_API_KEY,
        'format': 'json',
        'limit': 150000,
        'filters[Arrival_Date]': date.strftime('%d/%m/%Y'),
        'filters[State]': state,
        'filters[Commodity]': commodity,
        'filters[District]': district
    }
    return fetch_agri_data(params)

def get_combined_data_for_last_10_days(state, commodity, district, num_days=10):
    """Get combined data for last 10 days"""
    recent_dates = [datetime.today().date() - timedelta(days=i) for i in range(num_days)]
    combined_records = []

    for date in recent_dates:
        data = get_data_for_date(state, commodity, district, date)
        if 'records' in data:
            combined_records.extend(data['records'])

    return combined_records

def get_combined_data_for_all_districts(state, commodity, num_days=10):
    """Get data for all districts"""
    recent_dates = [datetime.today().date() - timedelta(days=i) for i in range(num_days)]
    combined_records = []

    for date in recent_dates:
        params = {
            'api-key': AGRI_API_KEY,
            'format': 'json',
            'limit': 150000,
            'filters[Arrival_Date]': date.strftime('%d/%m/%Y'),
            'filters[State]': state,
            'filters[Commodity]': commodity
        }
        data = fetch_agri_data(params)
        if 'records' in data:
            combined_records.extend(data['records'])

    return combined_records

def prepare_forecast_data(records):
    """Prepare data for ARIMA forecasting"""
    if not records:
        return None
    
    df = pd.DataFrame(records)
    
    df['Arrival_Date'] = pd.to_datetime(df['Arrival_Date'], errors='coerce', dayfirst=True)
    df = df.dropna(subset=['Arrival_Date'])
    df.set_index('Arrival_Date', inplace=True)
    df.sort_index(inplace=True)
    
    df['Modal_Price'] = pd.to_numeric(df['Modal_Price'], errors='coerce')
    df = df.dropna(subset=['Modal_Price'])
    
    # Filter last 10 years
    last_10_years = datetime.now() - timedelta(days=365 * 10)
    df = df[df.index >= last_10_years]
    
    if len(df) < 30:
        return None
    
    return df

def forecast_to_specific_date(df, target_date):
    """
    🚀 IMPROVED FORECAST - Creates predictions with natural variations (ups and downs)
    Uses enhanced ARIMA/SARIMA with realistic price movements
    """
    try:
        last_date = df.index[-1]
        days_to_forecast = (target_date - last_date.date()).days
        
        if days_to_forecast <= 0:
            return None
        
        print(f"\n📊 ========== FORECASTING ANALYSIS ==========")
        print(f"📅 Forecasting from {last_date.date()} to {target_date}")
        print(f"📈 Days to forecast: {days_to_forecast}")
        print(f"📉 Historical data points: {len(df)}")
        
        # Calculate historical statistics for realistic variations
        price_changes = df['Modal_Price'].pct_change().dropna()
        historical_volatility = price_changes.std()
        last_price = df['Modal_Price'].iloc[-1]
        recent_trend = (df['Modal_Price'].iloc[-1] - df['Modal_Price'].iloc[-30]) / 30
        
        print(f"💰 Last recorded price: ₹{last_price:.2f}")
        print(f"📊 Historical volatility: {historical_volatility:.4f}")
        print(f"📈 Recent trend: ₹{recent_trend:.2f}/day")
        
        # Try SARIMA first for seasonal patterns (better predictions)
        try:
            print("🔄 Attempting SARIMA model (with seasonal patterns)...")
            model = SARIMAX(
                df['Modal_Price'], 
                order=(5, 1, 2),              # ARIMA parameters
                seasonal_order=(1, 0, 1, 7),  # Weekly seasonality
                enforce_stationarity=False,
                enforce_invertibility=False
            )
            model_fit = model.fit(disp=False, maxiter=200)
            print("✅ SARIMA model fitted successfully!")
            model_type = "SARIMA"
        except Exception as e:
            print(f"⚠️ SARIMA failed: {e}")
            print("🔄 Falling back to ARIMA model...")
            model = ARIMA(df['Modal_Price'], order=(5, 1, 2))
            model_fit = model.fit()
            print("✅ ARIMA model fitted successfully!")
            model_type = "ARIMA"
        
        # Get base forecast
        base_forecast = model_fit.forecast(steps=days_to_forecast)
        
        # 🎨 ADD REALISTIC VARIATIONS - This creates ups and downs!
        print("🎨 Adding realistic price variations...")
        
        # Method 1: Random walk based on historical volatility
        random_variations = np.random.normal(0, historical_volatility * 0.4, days_to_forecast)
        cumulative_variation = np.cumsum(random_variations)
        
        # Method 2: Seasonal patterns (weekly and monthly cycles)
        seasonal_pattern = np.array([
            historical_volatility * 0.3 * np.sin(2 * np.pi * i / 7) +      # Weekly cycle
            historical_volatility * 0.2 * np.sin(2 * np.pi * i / 30)       # Monthly cycle
            for i in range(days_to_forecast)
        ])
        
        # Method 3: Trend continuation
        trend_component = np.array([recent_trend * i for i in range(days_to_forecast)])
        
        # Combine all components for realistic forecast
        varied_forecast = base_forecast.values * (1 + cumulative_variation) + seasonal_pattern + trend_component
        
        # Ensure predictions stay within reasonable bounds (70% to 130% of last price)
        min_bound = last_price * 0.7
        max_bound = last_price * 1.3
        varied_forecast = np.clip(varied_forecast, min_bound, max_bound)
        
        # Smooth out extreme jumps (keep realistic but not too volatile)
        varied_forecast = np.array(varied_forecast)
        for i in range(1, len(varied_forecast)):
            max_change = last_price * 0.05  # Max 5% change per day
            if abs(varied_forecast[i] - varied_forecast[i-1]) > max_change:
                if varied_forecast[i] > varied_forecast[i-1]:
                    varied_forecast[i] = varied_forecast[i-1] + max_change
                else:
                    varied_forecast[i] = varied_forecast[i-1] - max_change
        
        # Create date range
        forecast_dates = pd.date_range(
            start=last_date + timedelta(days=1), 
            periods=days_to_forecast, 
            freq='D'
        )
        
        # Create forecast dataframe
        forecast_df = pd.DataFrame({
            'date': forecast_dates.strftime('%Y-%m-%d').tolist(),
            'predicted_price': varied_forecast.tolist()
        })
        
        # Get specific date prediction
        target_date_str = target_date.strftime('%Y-%m-%d')
        specific_prediction = None
        
        for record in forecast_df.to_dict('records'):
            if record['date'] == target_date_str:
                specific_prediction = record['predicted_price']
                break
        
        print(f"\n🎯 ========== FORECAST RESULTS ==========")
        print(f"🤖 Model used: {model_type}")
        print(f"📅 Target date: {target_date_str}")
        print(f"💰 Predicted price: ₹{specific_prediction:.2f}")
        print(f"📈 Forecast range: ₹{varied_forecast.min():.2f} - ₹{varied_forecast.max():.2f}")
        print(f"📊 Mean forecast: ₹{varied_forecast.mean():.2f}")
        print(f"🔄 Price variation: ₹{varied_forecast.std():.2f} (std dev)")
        print(f"✅ Forecast includes natural ups and downs!")
        print(f"==========================================\n")
        
        return {
            'all_forecasts': forecast_df.to_dict('records'),
            'target_date': target_date_str,
            'predicted_price': specific_prediction
        }
        
    except Exception as e:
        print(f"❌ Forecasting error: {e}")
        import traceback
        traceback.print_exc()
        return None

# ===== ROUTES =====

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/market')
def market():
    state = "Maharashtra"
    params = {
        'api-key': AGRI_API_KEY,
        'format': 'json',
        'limit': 150000,
        'filters[State]': state
    }
    
    data = fetch_agri_data(params)
    records = data.get('records', [])
    
    commodities = get_unique_values('Commodity', records)
    districts = get_unique_values('District', records)
    
    return render_template('market.html', 
                         commodities=commodities, 
                         districts=districts)

@app.route('/api/market/recent-dates-data', methods=['POST'])
def get_recent_dates_data():
    """Get data for multiple recent dates"""
    try:
        data = request.get_json()
        commodity = data.get('commodity')
        district = data.get('district')
        state = 'Maharashtra'
        
        recent_dates = get_recent_dates(state, commodity, district, 5)
        
        if not recent_dates:
            return jsonify({
                'success': False,
                'message': 'No recent dates found'
            })
        
        dates_data = []
        for date in recent_dates:
            date_data = get_data_for_date(state, commodity, district, date)
            records = date_data.get('records', [])
            
            if records:
                df = pd.DataFrame(records)
                avg_prices = calculate_average_price(df)
                dates_data.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'date_formatted': date.strftime('%d/%m/%Y'),
                    'prices': avg_prices,
                    'records': records[:20]
                })
        
        return jsonify({
            'success': True,
            'dates_data': dates_data
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        })

@app.route('/api/market/last-10-days', methods=['POST'])
def get_last_10_days():
    """Get last 10 days data for selected district"""
    try:
        data = request.get_json()
        commodity = data.get('commodity')
        district = data.get('district')
        state = 'Maharashtra'
        
        records = get_combined_data_for_last_10_days(state, commodity, district, 10)
        
        if not records:
            params = {
                'api-key': AGRI_API_KEY,
                'format': 'json',
                'limit': 10,
                'filters[State]': state,
                'filters[Commodity]': commodity,
                'filters[District]': district,
                'sort[Arrival_Date]': 'desc'
            }
            last_10_data = fetch_agri_data(params)
            records = last_10_data.get('records', [])
        
        return jsonify({
            'success': True,
            'records': records
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        })

@app.route('/api/market/all-districts', methods=['POST'])
def get_all_districts_data():
    """Get data for all districts in state"""
    try:
        data = request.get_json()
        commodity = data.get('commodity')
        state = 'Maharashtra'
        
        records = get_combined_data_for_all_districts(state, commodity, 10)
        
        return jsonify({
            'success': True,
            'records': records
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        })

@app.route('/forecasting')
def forecasting():
    state = "Maharashtra"
    params = {
        'api-key': AGRI_API_KEY,
        'format': 'json',
        'limit': 150000,
        'filters[State]': state
    }
    
    data = fetch_agri_data(params)
    records = data.get('records', [])
    
    commodities = get_unique_values('Commodity', records)
    districts = get_unique_values('District', records)
    
    return render_template('forecasting.html', 
                         commodities=commodities, 
                         districts=districts,
                         today=datetime.now().strftime('%Y-%m-%d'))

@app.route('/api/forecasting/predict-specific-date', methods=['POST'])
def predict_specific_date():
    """Forecast to specific date with realistic variations"""
    try:
        data = request.get_json()
        commodity = data.get('commodity')
        district = data.get('district')
        target_date_str = data.get('target_date', '2025-11-01')
        
        target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
        state = 'Maharashtra'
        
        print(f"\n🔍 Forecast request: {commodity} in {district} for {target_date_str}")
        
        # Check forecast cache first
        cached_forecast = get_forecast_from_cache(state, district, commodity, target_date)
        if cached_forecast:
            print("✅ Returning cached forecast")
            return jsonify(cached_forecast)
        
        # ALWAYS fetch from API first (don't rely on potentially empty DB)
        print("📡 Fetching fresh data from API...")
        params = {
            'api-key': AGRI_API_KEY,
            'format': 'json',
            'limit': 150000,
            'filters[State]': state,
            'filters[Commodity]': commodity,
            'filters[District]': district,
            'sort[Arrival_Date]': 'desc'
        }
        
        result = fetch_agri_data(params, use_cache=True)
        records = result.get('records', [])
        
        print(f"📊 Got {len(records)} records from API")
        
        # Save to database in background
        if records and len(records) > 0:
            Thread(target=save_price_records_to_db, args=(records, state, district, commodity)).start()
        
        # Check if we have enough data
        if not records or len(records) < 30:
            print(f"❌ Insufficient data: only {len(records)} records found")
            return jsonify({
                'success': False,
                'message': f'Insufficient historical data for forecasting. Found only {len(records)} records. Need at least 30 records.'
            })
        
        # Prepare data
        print("🔄 Preparing forecast data...")
        df = prepare_forecast_data(records)
        
        if df is None or len(df) < 30:
            print(f"❌ Data preparation failed: {len(df) if df is not None else 0} valid records")
            return jsonify({
                'success': False,
                'message': f'Unable to prepare data for forecasting. Valid records: {len(df) if df is not None else 0}. Need at least 30.'
            })
        
        print(f"✅ Prepared {len(df)} records for forecasting")
        
        # Generate forecast with variations
        print("🔮 Generating forecast...")
        forecast_result = forecast_to_specific_date(df, target_date)
        
        if forecast_result is None:
            print("❌ Forecasting model failed")
            return jsonify({
                'success': False,
                'message': 'Forecasting model failed to generate predictions'
            })
        
        # Prepare historical data
        historical_data = []
        for date, row in df.iterrows():
            historical_data.append({
                'date': date.strftime('%Y-%m-%d'),
                'price': float(row['Modal_Price'])
            })
        
        result_data = {
            'success': True,
            'historical': historical_data,
            'forecast': forecast_result['all_forecasts'],
            'target_date': forecast_result['target_date'],
            'predicted_price': forecast_result['predicted_price'],
            'current_price': float(df['Modal_Price'].iloc[-1])
        }
        
        # Cache the forecast
        save_forecast_to_cache(state, district, commodity, target_date, result_data, cache_hours=12)
        
        print("✅ Forecast generated successfully!")
        return jsonify(result_data)
        
    except Exception as e:
        print(f"❌ Prediction error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Error: {str(e)}'
        })

@app.route('/weather')
def weather():
    return render_template('weather.html')

@app.route('/api/weather/current', methods=['POST'])
def get_current_weather():
    try:
        data = request.get_json()
        location_type = data.get('type')
        location = data.get('location')
        
        if location_type == 'city':
            url = f"{WEATHER_BASE_URL}weather?q={location}&appid={WEATHER_API_KEY}&units=metric"
        else:
            url = f"{WEATHER_BASE_URL}weather?zip={location},IN&appid={WEATHER_API_KEY}&units=metric"
        
        response = requests.get(url, timeout=10)
        weather_data = response.json()
        
        if response.status_code == 200:
            return jsonify({'success': True, 'data': weather_data})
        else:
            return jsonify({'success': False, 'message': 'Location not found'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/weather/forecast', methods=['POST'])
def get_weather_forecast():
    try:
        data = request.get_json()
        location_type = data.get('type')
        location = data.get('location')
        
        if location_type == 'city':
            url = f"{WEATHER_BASE_URL}forecast?q={location}&appid={WEATHER_API_KEY}&units=metric"
        else:
            url = f"{WEATHER_BASE_URL}forecast?zip={location},IN&appid={WEATHER_API_KEY}&units=metric"
        
        response = requests.get(url, timeout=10)
        forecast_data = response.json()
        
        if response.status_code == 200:
            daily_data = {}
            for entry in forecast_data['list']:
                date = datetime.fromtimestamp(entry['dt']).strftime('%Y-%m-%d')
                if date not in daily_data:
                    daily_data[date] = {
                        'temps': [], 'humidity': [], 'wind': [], 'rain': [],
                        'condition': entry['weather'][0]['description']
                    }
                
                daily_data[date]['temps'].append(entry['main']['temp'])
                daily_data[date]['humidity'].append(entry['main']['humidity'])
                daily_data[date]['wind'].append(entry['wind']['speed'])
                daily_data[date]['rain'].append(entry.get('pop', 0) * 100)
            
            forecast_list = []
            for date, values in list(daily_data.items())[:5]:
                forecast_list.append({
                    'date': date,
                    'min_temp': round(min(values['temps']), 1),
                    'max_temp': round(max(values['temps']), 1),
                    'humidity': round(sum(values['humidity']) / len(values['humidity']), 1),
                    'wind': round(sum(values['wind']) / len(values['wind']) * 3.6, 1),
                    'rain_chance': round(sum(values['rain']) / len(values['rain']), 1),
                    'condition': values['condition']
                })
            
            return jsonify({'success': True, 'forecast': forecast_list})
        else:
            return jsonify({'success': False, 'message': 'Location not found'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/videos')
def videos():
    crops = [
        "भात (Rice)", "गहू (Wheat)", "ज्वारी (Sorghum)", "मका (Maize)",
        "कापूस (Cotton)", "सोयाबीन (Soybean)", "ऊस (Sugarcane)",
        "तूर (Pigeon Pea)", "कांदा (Onion)", "बटाटा (Potato)",
        "टोमॅटो (Tomato)", "धनिया (Coriander)", "मिरची (Chilli)",
        "भेंडी (Okra)", "वांगी (Brinjal)", "कोबी (Cabbage)",
        "फुलकोबी (Cauliflower)", "गाजर (Carrot)", "मूळा (Radish)",
        "पालक (Spinach)", "मेथी (Fenugreek)", "कोथिंबीर (Coriander Leaves)"
    ]
    return render_template('videos.html', crops=crops)

@app.route('/api/videos/search', methods=['POST'])
def search_videos():
    try:
        data = request.get_json()
        crop_name = data.get('crop')
        
        queries = [
            f"{crop_name} पिकाची लागवड",
            f"{crop_name} शेती",
            f"{crop_name} कृषी"
        ]
        
        all_videos = []
        for query in queries:
            url = "https://www.googleapis.com/youtube/v3/search"
            params = {
                'part': 'snippet',
                'q': query,
                'key': YOUTUBE_API_KEY,
                'maxResults': 5,
                'type': 'video'
            }
            
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                videos = response.json().get('items', [])
                all_videos.extend(videos)
        
        unique_videos = []
        seen_ids = set()
        for video in all_videos:
            video_id = video['id'].get('videoId')
            if video_id and video_id not in seen_ids:
                seen_ids.add(video_id)
                unique_videos.append(video)
        
        return jsonify({'success': True, 'videos': unique_videos[:10]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/news')
def news():
    return render_template('news.html')

@app.route('/api/news/fetch', methods=['GET'])
def fetch_news():
    try:
        url = 'https://newsapi.org/v2/everything'
        params = {
            'q': 'Agriculture AND Maharashtra',
            'language': 'en',
            'sortBy': 'publishedAt',
            'apiKey': NEWS_API_KEY,
            'pageSize': 20
        }
        
        response = requests.get(url, params=params, timeout=10)
        news_data = response.json()
        
        if news_data.get('status') == 'ok':
            return jsonify({'success': True, 'articles': news_data.get('articles', [])})
        else:
            return jsonify({'success': False, 'message': 'Failed to fetch news'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/schemes')
def schemes():
    return render_template('schemes.html')

# ===== CHATBOT ROUTES (NEW) =====

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle text-based chat messages"""
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        
        if not user_message:
            return jsonify({
                'success': False,
                'error': 'No message provided'
            }), 400
        
        print(f"💬 Chat message: {user_message[:50]}...")
        
        # Create prompt with farming context
        full_prompt = f"{FARMING_CONTEXT}\n\nUser: {user_message}\n\nAssistant:"
        
        # Generate response using Gemini
        response = model.generate_content(full_prompt)
        
        return jsonify({
            'success': True,
            'response': response.text
        })
    
    except Exception as e:
        print(f"Chat error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/chat/image', methods=['POST'])
def chat_with_image():
    """Handle chat with image upload for disease detection"""
    try:
        data = request.get_json()
        user_message = data.get('message', 'What disease does this crop have? Suggest treatment.')
        image_data = data.get('image', '')
        
        if not image_data:
            return jsonify({
                'success': False,
                'error': 'No image provided'
            }), 400
        
        print(f"📷 Image analysis request: {user_message[:50]}...")
        
        # Decode base64 image
        try:
            image_bytes = base64.b64decode(image_data.split(',')[1])
            image = Image.open(io.BytesIO(image_bytes))
        except Exception as e:
            return jsonify({
                'success': False,
                'error': f'Invalid image format: {str(e)}'
            }), 400
        
        # Create prompt for disease detection
        disease_prompt = f"""{FARMING_CONTEXT}

The farmer has uploaded a crop image. Please analyze it carefully and provide:
1. Crop identification (if possible)
2. Any diseases, pests, or nutrient deficiencies visible
3. Organic treatment recommendations (homemade solutions)
4. Chemical treatment options (if organic fails)
5. Prevention tips for future
6. Estimated time to recovery

User's specific question: {user_message}

Be specific, practical, and farmer-friendly in your response. Include costs where applicable.
"""
        
        # Generate response with image
        response = model.generate_content([disease_prompt, image])
        
        return jsonify({
            'success': True,
            'response': response.text
        })
    
    except Exception as e:
        print(f"Image chat error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/fertilizer', methods=['POST'])
def fertilizer_recommendation():
    """Get fertilizer recommendations"""
    try:
        data = request.get_json()
        crop = data.get('crop', '')
        soil_type = data.get('soil_type', 'loamy')
        growth_stage = data.get('growth_stage', 'vegetative')
        
        if not crop:
            return jsonify({
                'success': False,
                'error': 'Crop name is required'
            }), 400
        
        print(f"💊 Fertilizer recommendation for: {crop} ({soil_type}, {growth_stage})")
        
        prompt = f"""{FARMING_CONTEXT}

Provide detailed fertilizer recommendations for Indian farmers:
- Crop: {crop}
- Soil Type: {soil_type}
- Growth Stage: {growth_stage}

Include:
1. Recommended NPK ratio with quantities per acre
2. Organic fertilizer options (compost, vermicompost, FYM) with quantities
3. Chemical fertilizer options with brand examples available in India
4. Application timing and method (broadcast, drip, foliar)
5. Approximate cost per acre for each option
6. Additional micronutrients if needed (Zinc, Boron, etc.)
7. Common mistakes to avoid

Keep it practical for Maharashtra farmers with specific quantities and costs in Indian Rupees.
"""
        
        response = model.generate_content(prompt)
        
        return jsonify({
            'success': True,
            'response': response.text
        })
    
    except Exception as e:
        print(f"Fertilizer recommendation error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/quick-tips', methods=['GET'])
def quick_tips():
    """Get quick farming tips based on current season"""
    try:
        current_month = datetime.now().strftime('%B')
        
        print(f"💡 Generating quick tips for {current_month}")
        
        prompt = f"""{FARMING_CONTEXT}

Provide 5 quick, actionable farming tips for Maharashtra farmers for the month of {current_month}.
Focus on:
- Which crops to plant/harvest now
- Irrigation practices for this season
- Pest control measures (mention specific pests common in this month)
- Soil preparation tips
- Weather-specific advice for Maharashtra

Keep each tip to 2-3 sentences and number them. Make them specific to Maharashtra agriculture.
"""
        
        response = model.generate_content(prompt)
        
        return jsonify({
            'success': True,
            'response': response.text,
            'month': current_month
        })
    
    except Exception as e:
        print(f"Quick tips error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Admin endpoints
@app.route('/api/admin/clear-cache', methods=['POST'])
def clear_cache():
    """Clear all cached data"""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM api_cache')
        cursor.execute('DELETE FROM forecast_cache')
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Cache cleared'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/admin/cache-stats')
def cache_stats():
    """Get cache statistics"""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM api_cache')
        api_cache_count = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM price_history')
        price_records_count = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM forecast_cache')
        forecast_cache_count = cursor.fetchone()[0]
        
        conn.close()
        
        return jsonify({
            'api_cache_count': api_cache_count,
            'price_records_count': price_records_count,
            'forecast_cache_count': forecast_cache_count
        })
    except Exception as e:
        return jsonify({'error': str(e)})

if __name__ == '__main__':
    print("=" * 60)
    print("🌾 CropWise - Smart Agriculture Platform")
    print("=" * 60)
    print("✅ Server Starting...")
    print("💾 Database: SQLite (cropwise_cache.db)")
    print("🔮 Forecasting: SARIMA/ARIMA with realistic variations")
    print("📈 Predictions: Include natural ups and downs!")
    print("🤖 AI Chatbot: Gemini-powered farming assistant")
    print("📷 Disease Detection: Image analysis enabled")
    print("🔗 URL: http://localhost:5000")
    print("📊 Market: http://localhost:5000/market")
    print("🔮 Forecasting: http://localhost:5000/forecasting")
    print("🌦️ Weather: http://localhost:5000/weather")
    print("🎥 Videos: http://localhost:5000/videos")
    print("📰 News: http://localhost:5000/news")
    print("🏛️ Schemes: http://localhost:5000/schemes")
    print("📈 Cache Stats: http://localhost:5000/api/admin/cache-stats")
    print("\n🤖 Chatbot API Endpoints:")
    print("   POST /api/chat - Text chat")
    print("   POST /api/chat/image - Image analysis")
    print("   POST /api/fertilizer - Fertilizer recommendations")
    print("   GET /api/quick-tips - Seasonal farming tips")
    print("=" * 60)
    print("Press CTRL+C to stop\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
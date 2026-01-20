// Weather Page - Complete with API Integration

async function getWeather() {
    const locationType = document.querySelector('input[name="locationType"]:checked').value;
    const locationInput = document.getElementById('locationInput').value.trim();
    
    if (!locationInput) {
        showToast('⚠️ Please enter a location!', 'error');
        return;
    }
    
    document.getElementById('loading').style.display = 'block';
    document.getElementById('weatherResults').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    
    try {
        const currentResponse = await fetch('/api/weather/current', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: locationType,
                location: locationInput
            })
        });
        
        const currentData = await currentResponse.json();
        
        if (!currentData.success) {
            throw new Error(currentData.message);
        }
        
        const forecastResponse = await fetch('/api/weather/forecast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: locationType,
                location: locationInput
            })
        });
        
        const forecastData = await forecastResponse.json();
        
        document.getElementById('loading').style.display = 'none';
        
        if (currentData.success) {
            displayCurrentWeather(currentData.data);
            if (forecastData.success) {
                displayForecast(forecastData.forecast);
            }
            document.getElementById('weatherResults').style.display = 'block';
            showToast('✅ Weather data loaded!', 'success');
        }
        
    } catch (error) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').innerHTML = '<div class="error-card"><div class="error-icon">❌</div><h3>Location Not Found</h3><p>' + (error.message || 'Please check the location and try again') + '</p></div>';
        showToast('❌ Location not found', 'error');
    }
}

function displayCurrentWeather(data) {
    const locationName = data.name;
    const temp = Math.round(data.main.temp);
    const feelsLike = Math.round(data.main.feels_like);
    const humidity = data.main.humidity;
    const windSpeed = Math.round(data.wind.speed * 3.6);
    const pressure = data.main.pressure;
    const description = data.weather[0].description;
    const icon = getWeatherIcon(description);
    
    let html = '<div style="text-align: center; margin-bottom: 30px;">';
    html += '<h2 style="color: #2e7d32; margin-bottom: 10px;">' + icon + ' ' + locationName + '</h2>';
    html += '<p style="color: #666; text-transform: capitalize;">' + description + '</p></div>';
    html += '<div class="weather-grid">';
    html += '<div class="weather-card" style="background: linear-gradient(135deg, #fff9c4 0%, #fff59d 100%);"><div class="weather-icon">🌡️</div><h3>' + temp + '°C</h3><p>Temperature</p></div>';
    html += '<div class="weather-card" style="background: linear-gradient(135deg, #e1f5fe 0%, #b3e5fc 100%);"><div class="weather-icon">💧</div><h3>' + humidity + '%</h3><p>Humidity</p></div>';
    html += '<div class="weather-card" style="background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%);"><div class="weather-icon">🌬️</div><h3>' + windSpeed + ' km/h</h3><p>Wind Speed</p></div>';
    html += '<div class="weather-card" style="background: linear-gradient(135deg, #e8eaf6 0%, #c5cae9 100%);"><div class="weather-icon">🌍</div><h3>' + pressure + ' hPa</h3><p>Pressure</p></div></div>';
    html += '<div class="info-box" style="margin-top: 20px; text-align: center;"><p><strong>Feels Like:</strong> ' + feelsLike + '°C</p></div>';
    
    document.getElementById('currentWeather').innerHTML = html;
}

function displayForecast(forecast) {
    let html = '<h3 style="color: #2e7d32; margin-bottom: 20px;">📅 5-Day Forecast</h3><div class="forecast-grid">';
    
    for (let i = 0; i < forecast.length; i++) {
        const day = forecast[i];
        const date = new Date(day.date);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const icon = getWeatherIcon(day.condition);
        
        html += '<div class="forecast-card"><h4>' + dayName + '</h4>';
        html += '<div style="font-size: 32px; margin: 10px 0;">' + icon + '</div>';
        html += '<p style="text-transform: capitalize; color: #666; font-size: 14px;">' + day.condition + '</p>';
        html += '<div style="margin: 10px 0;"><strong style="color: #d32f2f;">' + day.max_temp + '°</strong>';
        html += '<span style="color: #999;"> / </span><strong style="color: #1976d2;">' + day.min_temp + '°</strong></div>';
        html += '<div style="font-size: 13px; color: #666;">';
        html += '<p>💧 ' + day.humidity + '% humidity</p>';
        html += '<p>🌬️ ' + day.wind + ' km/h wind</p>';
        html += '<p>🌧️ ' + day.rain_chance + '% rain</p></div></div>';
    }
    
    html += '</div>';
    document.getElementById('forecast').innerHTML = html;
}

function getWeatherIcon(condition) {
    const cond = condition.toLowerCase();
    if (cond.includes('clear')) return '☀️';
    if (cond.includes('cloud')) return '☁️';
    if (cond.includes('rain') || cond.includes('drizzle')) return '🌧️';
    if (cond.includes('thunder')) return '⛈️';
    if (cond.includes('snow')) return '❄️';
    if (cond.includes('mist') || cond.includes('fog')) return '🌫️';
    return '🌤️';
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        getWeather();
    }
});
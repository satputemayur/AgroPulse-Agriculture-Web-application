// ENHANCED FORECASTING.JS - Professional Chart Visualization
// Improved Price Prediction Charts with Clear Historical/Forecast Distinction

let loadingDiv, resultsDiv, errorDiv;
let historicalChart = null;
let combinedChart = null;
let currentForecastData = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔮 Forecasting page initialized');
    
    loadingDiv = document.getElementById('loading');
    resultsDiv = document.getElementById('results');
    errorDiv = document.getElementById('error');
    
    const targetDateInput = document.getElementById('target-date');
    if (targetDateInput) {
        targetDateInput.value = '2026-11-01';
        console.log('✅ Default date set to 2026-11-01');
    }
    
    setTimeout(() => {
        if (window.commodityComboBox && window.districtComboBox) {
            console.log('✅ Combo boxes detected and ready');
        }
    }, 500);
});

async function generateForecast() {
    let commodity, district;
    
    if (window.commodityComboBox && window.districtComboBox) {
        commodity = window.commodityComboBox.getValue();
        district = window.districtComboBox.getValue();
    } else {
        commodity = document.getElementById('commodity-input')?.value || '';
        district = document.getElementById('district-input')?.value || '';
    }
    
    const targetDate = document.getElementById('target-date')?.value || '2026-11-01';
    
    if (!commodity || !district) {
        showToast('⚠️ कृपया पीक आणि जिल्हा निवडा! Please select crop and district!', 'error');
        return;
    }
    
    if (loadingDiv) loadingDiv.style.display = 'block';
    if (resultsDiv) resultsDiv.style.display = 'none';
    if (errorDiv) errorDiv.style.display = 'none';
    
    try {
        const response = await fetch('/api/forecasting/predict-specific-date', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                commodity: commodity,
                district: district,
                target_date: targetDate
            })
        });
        
        const data = await response.json();
        
        if (loadingDiv) loadingDiv.style.display = 'none';
        
        if (data.success) {
            currentForecastData = data;
            displayForecastResults(data, commodity, district, targetDate);
            showToast('✅ Forecast generated successfully!', 'success');
        } else {
            showError(data.message || 'Failed to generate forecast');
        }
        
    } catch (error) {
        console.error('❌ Network error:', error);
        if (loadingDiv) loadingDiv.style.display = 'none';
        showError('Network error. Please check your connection and try again.');
    }
}

function displayForecastResults(data, commodity, district, targetDate) {
    if (!data || !data.forecast) return;
    
    if (resultsDiv) {
        resultsDiv.innerHTML = '';
        resultsDiv.style.display = 'block';
    }
    
    displayMainPrediction(data.predicted_price, commodity, district, targetDate);
    displayProfessionalCombinedChart(data.historical, data.forecast, commodity, district, data.current_price, targetDate, data.predicted_price);
    displayForecastSummary(data);
}

function displayMainPrediction(predictedPrice, commodity, district, targetDate) {
    const formattedDate = new Date(targetDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const predictionHTML = `
        <div class="card prediction-highlight" style="
            margin-bottom: 40px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 40px; 
            border-radius: 20px; 
            text-align: center;
            box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
        ">
            <div style="font-size: 4rem; margin-bottom: 15px;">🔮</div>
            <h2 style="margin-bottom: 15px; font-size: 1.8rem; font-weight: 700;">Predicted Modal Price</h2>
            <p style="margin-bottom: 25px; opacity: 0.95; font-size: 1.15rem;">
                on <strong>${formattedDate}</strong> for <strong>${commodity}</strong> in <strong>${district}</strong>
            </p>
            <div style="font-size: 3.5rem; font-weight: 900; margin: 25px 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">
                ₹${predictedPrice.toFixed(2)}
            </div>
            <p style="opacity: 0.9; font-size: 1rem; font-weight: 600;">per quintal</p>
        </div>
    `;
    
    if (resultsDiv) resultsDiv.innerHTML += predictionHTML;
}

function displayProfessionalCombinedChart(historicalData, forecastData, commodity, district, currentPrice, targetDate, targetPrice) {
    if (!historicalData || !forecastData) return;
    
    const chartHTML = `
        <div class="card" style="margin-bottom: 30px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                <h3 style="color: #2e7d32; font-size: 1.5rem; margin: 0;">
                    📈 Price Forecast Model - Historical & Predicted Analysis
                </h3>
                <select id="chartTypeSelector" onchange="changeChartType()" style="
                    padding: 10px 15px;
                    border: 2px solid #4caf50;
                    border-radius: 8px;
                    font-size: 0.95rem;
                    color: #2e7d32;
                    font-weight: 600;
                    cursor: pointer;
                    background: white;
                ">
                    <option value="area">📊 Area Chart</option>
                    <option value="line">📈 Line Chart</option>
                    <option value="bar">📊 Bar Chart</option>
                    <option value="smooth">〰️ Smooth Curve</option>
                </select>
            </div>
            <div class="chart-container" style="position: relative; height: 550px; padding: 20px;">
                <canvas id="professional-chart"></canvas>
            </div>
            <div class="chart-info" style="margin-top: 20px; padding: 20px; background: #f5f5f5; border-radius: 12px;">
                <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 20px;">
                    <div style="text-align: center;">
                        <div style="width: 60px; height: 4px; background: #2196F3; margin: 0 auto 10px; border-radius: 2px;"></div>
                        <strong style="color: #2196F3; font-size: 1.1rem;">Historical Data</strong>
                        <p style="color: #666; font-size: 0.9rem; margin-top: 5px;">Last 10 years actual prices</p>
                    </div>
                    <div style="text-align: center;">
                        <div style="width: 60px; height: 4px; background: #FF6B35; margin: 0 auto 10px; border-radius: 2px; border-top: 3px dashed #FF6B35;"></div>
                        <strong style="color: #FF6B35; font-size: 1.1rem;">AI Prediction</strong>
                        <p style="color: #666; font-size: 0.9rem; margin-top: 5px;">ARIMA model forecast</p>
                    </div>
                    <div style="text-align: center;">
                        <div style="width: 20px; height: 20px; background: #4CAF50; margin: 0 auto 10px; border-radius: 50%;"></div>
                        <strong style="color: #4CAF50; font-size: 1.1rem;">Target Price</strong>
                        <p style="color: #666; font-size: 0.9rem; margin-top: 5px;">Selected date prediction</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    if (resultsDiv) resultsDiv.innerHTML += chartHTML;
    
    // Store data globally for chart type changes
    window.chartData = {
        historicalData,
        forecastData,
        commodity,
        district,
        currentPrice,
        targetDate,
        targetPrice
    };
    
    createChart('area');
}

function createChart(chartType = 'area') {
    setTimeout(() => {
        const ctx = document.getElementById('professional-chart');
        if (!ctx) return;
        
        if (combinedChart) combinedChart.destroy();
        
        const { historicalData, forecastData, commodity, district, targetDate, targetPrice } = window.chartData;
        
        const historicalDates = historicalData.map(item => item.date);
        const historicalPrices = historicalData.map(item => item.price);
        
        const forecastDates = forecastData.map(item => item.date);
        const forecastPrices = forecastData.map(item => item.predicted_price);
        
        const lastHistoricalDate = historicalDates[historicalDates.length - 1];
        const lastHistoricalPrice = historicalPrices[historicalPrices.length - 1];
        
        // Create continuous data with smooth transition
        const allDates = [...historicalDates, ...forecastDates];
        
        // Historical line goes up to last point, then null
        const historicalLine = [...historicalPrices, ...Array(forecastDates.length).fill(null)];
        
        // Forecast line starts from last historical point for smooth connection
        const forecastLine = [...Array(historicalDates.length - 1).fill(null), lastHistoricalPrice, ...forecastPrices];
        
        // Create target point marker
        const targetDateIndex = allDates.findIndex(date => date === targetDate);
        const targetPointData = Array(allDates.length).fill(null);
        if (targetDateIndex !== -1 && targetPrice) {
            targetPointData[targetDateIndex] = targetPrice;
        }
        
        // Chart configuration based on type
        const configs = {
            area: {
                tension: 0.4,
                fill: true,
                borderWidth: 3,
                pointRadius: 0,
                historicalBg: 'rgba(33, 150, 243, 0.15)',
                forecastBg: 'rgba(255, 107, 53, 0.15)'
            },
            line: {
                tension: 0.2,
                fill: false,
                borderWidth: 3,
                pointRadius: 0,
                historicalBg: 'transparent',
                forecastBg: 'transparent'
            },
            bar: {
                tension: 0,
                fill: false,
                borderWidth: 0,
                pointRadius: 0,
                historicalBg: 'rgba(33, 150, 243, 0.7)',
                forecastBg: 'rgba(255, 107, 53, 0.7)'
            },
            smooth: {
                tension: 0.5,
                fill: true,
                borderWidth: 3,
                pointRadius: 0,
                historicalBg: 'rgba(33, 150, 243, 0.2)',
                forecastBg: 'rgba(255, 107, 53, 0.2)'
            }
        };
        
        const config = configs[chartType] || configs.area;
        
        combinedChart = new Chart(ctx.getContext('2d'), {
            type: chartType === 'bar' ? 'bar' : 'line',
            data: {
                labels: allDates,
                datasets: [
                    {
                        label: 'Historical Prices',
                        data: historicalLine,
                        borderColor: '#2196F3',
                        backgroundColor: config.historicalBg,
                        borderWidth: config.borderWidth,
                        pointRadius: config.pointRadius,
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: '#2196F3',
                        pointHoverBorderColor: '#fff',
                        pointHoverBorderWidth: 2,
                        tension: config.tension,
                        fill: config.fill,
                        barPercentage: 0.9,
                        categoryPercentage: 0.95,
                        spanGaps: false
                    },
                    {
                        label: 'AI Predicted Prices',
                        data: forecastLine,
                        borderColor: '#FF6B35',
                        backgroundColor: config.forecastBg,
                        borderWidth: config.borderWidth,
                        borderDash: chartType === 'bar' ? [] : [8, 4],
                        pointRadius: config.pointRadius,
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: '#FF6B35',
                        pointHoverBorderColor: '#fff',
                        pointHoverBorderWidth: 2,
                        tension: config.tension,
                        fill: config.fill,
                        barPercentage: 0.9,
                        categoryPercentage: 0.95,
                        spanGaps: false,
                        segment: {
                            borderDash: ctx => chartType === 'bar' ? [] : [8, 4]
                        }
                    },
                    {
                        label: 'Target Date Prediction',
                        data: targetPointData,
                        borderColor: '#4CAF50',
                        backgroundColor: '#4CAF50',
                        pointRadius: 8,
                        pointHoverRadius: 12,
                        pointHoverBackgroundColor: '#4CAF50',
                        pointHoverBorderColor: '#fff',
                        pointHoverBorderWidth: 3,
                        pointStyle: 'circle',
                        showLine: false,
                        order: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    title: {
                        display: true,
                        text: `Price Trend Analysis: ${commodity} in ${district}`,
                        font: { size: 18, weight: 'bold', family: "'Segoe UI', sans-serif" },
                        color: '#1b5e20',
                        padding: { top: 10, bottom: 30 }
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            color: '#333',
                            font: { size: 13, family: "'Segoe UI', sans-serif" }
                        }
                    },
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#4CAF50',
                        borderWidth: 2,
                        padding: 15,
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        displayColors: true,
                        callbacks: {
                            title: function(context) {
                                return '📅 ' + context[0].label;
                            },
                            label: function(context) {
                                if (context.parsed.y !== null) {
                                    const label = context.dataset.label || '';
                                    const value = '₹' + context.parsed.y.toFixed(2) + ' per quintal';
                                    return label + ': ' + value;
                                }
                                return null;
                            },
                            afterBody: function(context) {
                                const dataIndex = context[0].dataIndex;
                                if (dataIndex === historicalDates.length) {
                                    return '\n💡 Transition Point: Historical → Predicted';
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Timeline (Date)',
                            font: { size: 14, weight: 'bold', family: "'Segoe UI', sans-serif" },
                            color: '#555'
                        },
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.05)',
                            drawBorder: true,
                            borderColor: '#ddd'
                        },
                        ticks: {
                            maxTicksLimit: chartType === 'bar' ? 10 : 15,
                            color: '#666',
                            font: { size: 11 },
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Modal Price (₹ per Quintal)',
                            font: { size: 14, weight: 'bold', family: "'Segoe UI', sans-serif" },
                            color: '#555'
                        },
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.08)',
                            drawBorder: true,
                            borderColor: '#ddd'
                        },
                        ticks: {
                            color: '#666',
                            font: { size: 12 },
                            callback: function(value) {
                                return '₹' + value.toFixed(0);
                            }
                        },
                        beginAtZero: false
                    }
                }
            }
        });
        
        console.log(`✅ ${chartType} chart created`);
    }, 200);
}

function changeChartType() {
    const selector = document.getElementById('chartTypeSelector');
    const chartType = selector ? selector.value : 'area';
    createChart(chartType);
    showToast(`📊 Chart changed to ${chartType} view`, 'info');
}

function displayForecastSummary(data) {
    if (!data.forecast) return;
    
    const forecastPrices = data.forecast.map(f => f.predicted_price);
    const avgPrice = forecastPrices.reduce((a, b) => a + b, 0) / forecastPrices.length;
    const minPrice = Math.min(...forecastPrices);
    const maxPrice = Math.max(...forecastPrices);
    
    const currentPrice = data.current_price || avgPrice;
    const priceChange = ((avgPrice - currentPrice) / currentPrice * 100);
    const trend = priceChange > 2 ? 'Increasing' : priceChange < -2 ? 'Decreasing' : 'Stable';
    
    const summaryHTML = `
        <div class="card" style="margin-bottom: 30px;">
            <h3 style="color: #2e7d32; margin-bottom: 25px; font-size: 1.5rem;">📊 Forecast Summary & Statistics</h3>
            <div class="summary-cards">
                <div class="summary-card" style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);">
                    <div class="card-header">Current Price</div>
                    <div class="card-value" style="color: #1976d2;">₹${currentPrice.toFixed(2)}</div>
                    <div class="card-label">last recorded</div>
                </div>
                
                <div class="summary-card" style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);">
                    <div class="card-header">Predicted Average</div>
                    <div class="card-value" style="color: #2e7d32;">₹${avgPrice.toFixed(2)}</div>
                    <div class="card-label">forecast period</div>
                </div>
                
                <div class="summary-card" style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);">
                    <div class="card-header">Price Range</div>
                    <div class="card-value" style="color: #ef6c00; font-size: 1.5rem;">₹${minPrice.toFixed(0)} - ₹${maxPrice.toFixed(0)}</div>
                    <div class="card-label">min to max</div>
                </div>

                <div class="summary-card trend-card" style="background: linear-gradient(135deg, ${priceChange >= 0 ? '#e8f5e9' : '#ffebee'} 0%, ${priceChange >= 0 ? '#c8e6c9' : '#ffcdd2'} 100%);">
                    <div class="card-header">Price Trend</div>
                    <div class="card-value trend ${trend.toLowerCase()}" style="color: ${priceChange >= 0 ? '#2e7d32' : '#c62828'};">${trend}</div>
                    <div class="card-label change ${priceChange >= 0 ? 'positive' : 'negative'}" style="color: ${priceChange >= 0 ? '#2e7d32' : '#c62828'}; font-size: 1.2rem; font-weight: 700;">
                        ${priceChange > 0 ? '↑' : priceChange < 0 ? '↓' : '→'} ${Math.abs(priceChange).toFixed(1)}%
                    </div>
                </div>
            </div>
        </div>
    `;
    
    if (resultsDiv) resultsDiv.innerHTML += summaryHTML;
}

function showError(message) {
    if (errorDiv) {
        errorDiv.innerHTML = `
            <div class="error-card">
                <div class="error-icon">⚠️</div>
                <h3>Unable to Generate Forecast</h3>
                <p style="font-size: 1.1rem; margin: 15px 0;">${message}</p>
                <p style="margin-top: 20px; font-size: 0.95rem; color: #666;">
                    कृपया दुसरे पीक किंवा जिल्हा निवडा<br>
                    Please try a different crop or district combination
                </p>
            </div>
        `;
        errorDiv.style.display = 'block';
    }
    showToast(message, 'error');
}

function showToast(message, type = 'info') {
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const colors = { success: '#4CAF50', error: '#f44336', warning: '#ff9800', info: '#2196F3' };
    
    toast.innerHTML = `
        <div class="toast-content">
            <span style="font-size: 1.3rem; margin-right: 10px;">${icons[type]}</span>
            <span style="flex: 1;">${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                font-size: 1.3rem;
                cursor: pointer;
                border-radius: 50%;
                width: 25px;
                height: 25px;
            ">×</button>
        </div>
    `;
    
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type]};
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        min-width: 300px;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

function exportForecastData() {
    if (!currentForecastData || !currentForecastData.forecast) {
        showToast('No data to export', 'warning');
        return;
    }
    
    const headers = ['Date', 'Predicted Price'];
    const csvContent = [
        headers.join(','),
        ...currentForecastData.forecast.map(record => 
            [record.date, record.predicted_price.toFixed(2)].join(',')
        )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forecast_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    showToast('📊 Forecast data exported successfully!', 'success');
}

function clearForm() {
    if (window.commodityComboBox) window.commodityComboBox.clear();
    if (window.districtComboBox) window.districtComboBox.clear();
    
    const targetDateInput = document.getElementById('target-date');
    if (targetDateInput) targetDateInput.value = '2026-11-01';
    
    if (resultsDiv) resultsDiv.style.display = 'none';
    if (errorDiv) errorDiv.style.display = 'none';
    
    if (historicalChart) {
        historicalChart.destroy();
        historicalChart = null;
    }
    if (combinedChart) {
        combinedChart.destroy();
        combinedChart = null;
    }
    
    currentForecastData = null;
    window.chartData = null;
    showToast('🔄 Form cleared', 'info');
}

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.key === 'Enter') {
        generateForecast();
    }
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        exportForecastData();
    }
});

// Add required CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .summary-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 25px;
        margin-top: 20px;
    }
    
    .summary-card {
        padding: 30px 25px;
        border-radius: 18px;
        text-align: center;
        box-shadow: 0 6px 20px rgba(0,0,0,0.12);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: 2px solid rgba(0,0,0,0.08);
    }
    
    .summary-card:hover {
        transform: translateY(-10px) scale(1.02);
        box-shadow: 0 12px 35px rgba(0,0,0,0.18);
        border-color: #4caf50;
    }
    
    .card-header {
        font-size: 0.9rem;
        color: #666;
        margin-bottom: 15px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    
    .card-value {
        font-size: 2.2rem;
        font-weight: 900;
        margin-bottom: 10px;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
    }
    
    .card-label {
        font-size: 0.85rem;
        color: #999;
        font-weight: 500;
    }
    
    .prediction-highlight {
        animation: highlightPulse 2s ease-in-out infinite;
    }
    
    @keyframes highlightPulse {
        0%, 100% {
            transform: scale(1);
            box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
        }
        50% {
            transform: scale(1.01);
            box-shadow: 0 15px 50px rgba(102, 126, 234, 0.6);
        }
    }
    
    .error-card {
        background: linear-gradient(135deg, #fff9c4 0%, #fff59d 100%);
        padding: 50px;
        border-radius: 20px;
        text-align: center;
        margin: 40px 0;
        box-shadow: 0 8px 25px rgba(245, 127, 23, 0.2);
        border: 2px solid #ffb74d;
    }
    
    .error-icon {
        font-size: 5rem;
        margin-bottom: 25px;
        animation: bounce 1s infinite;
    }
    
    @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-15px); }
    }
    
    .chart-container canvas {
        max-height: 550px;
    }
    
    #chartTypeSelector {
        transition: all 0.3s ease;
    }
    
    #chartTypeSelector:hover {
        border-color: #2e7d32;
        box-shadow: 0 2px 8px rgba(46, 125, 50, 0.2);
        transform: translateY(-2px);
    }
    
    #chartTypeSelector:focus {
        outline: none;
        border-color: #2e7d32;
        box-shadow: 0 0 0 3px rgba(46, 125, 50, 0.1);
    }
`;
document.head.appendChild(style);

console.log('✅ Enhanced Forecasting.js with multiple chart types loaded!');
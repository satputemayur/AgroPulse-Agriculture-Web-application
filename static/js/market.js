// FILE: static/js/market.js
// Enhanced Market Page - Works with Combo Boxes

let loadingDiv, resultsDiv, errorDiv;
let currentRecords = [];

document.addEventListener('DOMContentLoaded', function() {
    loadingDiv = document.getElementById('loading');
    resultsDiv = document.getElementById('results');
    errorDiv = document.getElementById('error');
});

async function fetchPrices() {
    const commodity = getComboBoxValue(window.commodityComboBox);
    const district = getComboBoxValue(window.districtComboBox);
    
    if (!commodity || !district) {
        showToast('⚠️ Please select both crop and district!', 'error');
        return;
    }
    
    console.log('📊 Fetching market prices for:', commodity, district);
    
    if (loadingDiv) loadingDiv.style.display = 'block';
    if (resultsDiv) resultsDiv.style.display = 'none';
    if (errorDiv) errorDiv.style.display = 'none';
    
    try {
        // Fetch recent dates data
        const recentDatesResponse = await fetch('/api/market/recent-dates-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commodity, district })
        });
        
        const recentDatesData = await recentDatesResponse.json();
        
        if (loadingDiv) loadingDiv.style.display = 'none';
        
        if (recentDatesData.success && recentDatesData.dates_data.length > 0) {
            displayEnhancedPrices(recentDatesData.dates_data, commodity, district);
            
            // Fetch additional data in background
            fetchLast10Days(commodity, district);
            fetchAllDistrictsData(commodity);
            
            if (resultsDiv) resultsDiv.style.display = 'block';
            showToast('✅ Market prices loaded successfully!', 'success');
        } else {
            showErrorMessage(recentDatesData.message || 'No data available for this selection');
        }
        
    } catch (error) {
        console.error('Error:', error);
        if (loadingDiv) loadingDiv.style.display = 'none';
        showErrorMessage('Network error. Unable to fetch market data.');
        showToast('❌ Network error. Please try again.', 'error');
    }
}

function displayEnhancedPrices(datesData, commodity, district) {
    let html = `
        <!-- Latest Price Highlight -->
        <div class="card" style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            border-radius: 25px;
            text-align: center;
            box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
            margin-bottom: 40px;
        ">
            <div style="font-size: 3rem; margin-bottom: 15px;">💰</div>
            <h2 style="margin-bottom: 15px; font-size: 1.8rem;">Latest Market Prices</h2>
            <p style="margin-bottom: 25px; opacity: 0.95; font-size: 1.1rem;">
                <strong>${commodity}</strong> in <strong>${district}</strong> • ${datesData[0].date_formatted}
            </p>
            
            <!-- Price Summary Cards -->
            <div style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 20px;
                margin-top: 30px;
            ">
                <div style="
                    background: rgba(255,255,255,0.15);
                    padding: 20px;
                    border-radius: 15px;
                    backdrop-filter: blur(10px);
                ">
                    <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 8px;">Minimum</div>
                    <div style="font-size: 2rem; font-weight: 800;">₹${datesData[0].prices.min_avg.toFixed(2)}</div>
                    <div style="font-size: 0.85rem; opacity: 0.8; margin-top: 5px;">per quintal</div>
                </div>
                
                <div style="
                    background: rgba(255,255,255,0.15);
                    padding: 20px;
                    border-radius: 15px;
                    backdrop-filter: blur(10px);
                ">
                    <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 8px;">Modal</div>
                    <div style="font-size: 2rem; font-weight: 800;">₹${datesData[0].prices.modal_avg.toFixed(2)}</div>
                    <div style="font-size: 0.85rem; opacity: 0.8; margin-top: 5px;">per quintal</div>
                </div>
                
                <div style="
                    background: rgba(255,255,255,0.15);
                    padding: 20px;
                    border-radius: 15px;
                    backdrop-filter: blur(10px);
                ">
                    <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 8px;">Maximum</div>
                    <div style="font-size: 2rem; font-weight: 800;">₹${datesData[0].prices.max_avg.toFixed(2)}</div>
                    <div style="font-size: 0.85rem; opacity: 0.8; margin-top: 5px;">per quintal</div>
                </div>
            </div>
        </div>
        
        <!-- Recent Dates Tabs -->
        <div class="card">
            <h3 style="color: #2e7d32; margin-bottom: 25px; font-size: 1.5rem;">
                📅 Price History (Recent Dates)
            </h3>
            <div class="tabs-container">
                <div class="tabs-header">
    `;
    
    // Create tab buttons
    datesData.forEach((dateData, index) => {
        const active = index === 0 ? 'active' : '';
        html += `
            <button class="tab-button ${active}" onclick="showTab(${index})">
                ${dateData.date_formatted}
            </button>
        `;
    });
    
    html += '</div><div class="tabs-content">';
    
    // Create tab content
    datesData.forEach((dateData, index) => {
        const display = index === 0 ? 'block' : 'none';
        html += `
            <div id="tab-${index}" class="tab-pane" style="display: ${display};">
                <h4 style="color: #2e7d32; margin-bottom: 20px; font-size: 1.2rem;">
                    📊 Market Data - ${dateData.date_formatted}
                </h4>
                
                <!-- Average Prices Display -->
                <div class="price-cards">
                    <div class="price-card" style="background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);">
                        <div style="font-size: 2.5rem; margin-bottom: 10px;">💵</div>
                        <h4>Minimum Price</h4>
                        <p>₹${dateData.prices.min_avg.toFixed(2)}</p>
                        <small>Average across markets</small>
                    </div>
                    
                    <div class="price-card" style="background: linear-gradient(135deg, #c8e6c9 0%, #a5d6a7 100%);">
                        <div style="font-size: 2.5rem; margin-bottom: 10px;">💰</div>
                        <h4>Modal Price</h4>
                        <p>₹${dateData.prices.modal_avg.toFixed(2)}</p>
                        <small>Most common price</small>
                    </div>
                    
                    <div class="price-card" style="background: linear-gradient(135deg, #a5d6a7 0%, #81c784 100%);">
                        <div style="font-size: 2.5rem; margin-bottom: 10px;">💎</div>
                        <h4>Maximum Price</h4>
                        <p>₹${dateData.prices.max_avg.toFixed(2)}</p>
                        <small>Highest recorded</small>
                    </div>
                </div>
                
                <!-- Market Records Table -->
                <div style="margin-top: 30px;">
                    <h5 style="color: #2e7d32; margin-bottom: 15px; font-size: 1.1rem;">
                        🏪 Individual Market Records
                    </h5>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>📅 Date</th>
                                    <th>🏪 Market Name</th>
                                    <th>💵 Min Price</th>
                                    <th>💰 Modal Price</th>
                                    <th>💎 Max Price</th>
                                </tr>
                            </thead>
                            <tbody>
        `;
        
        dateData.records.forEach(record => {
            html += `
                <tr>
                    <td style="font-weight: 600;">${record.Arrival_Date || 'N/A'}</td>
                    <td>${record.Market || 'N/A'}</td>
                    <td style="color: #1976d2; font-weight: 600;">₹${record.Min_Price || '0'}</td>
                    <td style="color: #2e7d32; font-weight: 700;">₹${record.Modal_Price || '0'}</td>
                    <td style="color: #d32f2f; font-weight: 600;">₹${record.Max_Price || '0'}</td>
                </tr>
            `;
        });
        
        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div></div></div>';
    
    // Create comparative table
    html += `
        <div class="card">
            <h3 style="color: #2e7d32; margin-bottom: 25px; font-size: 1.5rem;">
                📈 Price Comparison Across Dates
            </h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>📅 Date</th>
                            <th>💵 Min Avg</th>
                            <th>💰 Modal Avg</th>
                            <th>💎 Max Avg</th>
                            <th>📊 Trend</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    datesData.forEach((dateData, index) => {
        let trendIcon = '➡️';
        let trendColor = '#666';
        
        if (index < datesData.length - 1) {
            const prevModal = datesData[index + 1].prices.modal_avg;
            const currModal = dateData.prices.modal_avg;
            
            if (currModal > prevModal) {
                trendIcon = '📈 Up';
                trendColor = '#2e7d32';
            } else if (currModal < prevModal) {
                trendIcon = '📉 Down';
                trendColor = '#d32f2f';
            } else {
                trendIcon = '➡️ Stable';
            }
        } else {
            trendIcon = '➡️ —';
        }
        
        html += `
            <tr>
                <td style="font-weight: 700;">${dateData.date}</td>
                <td style="color: #1976d2; font-weight: 600;">₹${dateData.prices.min_avg.toFixed(2)}</td>
                <td style="color: #2e7d32; font-weight: 700; font-size: 1.05rem;">₹${dateData.prices.modal_avg.toFixed(2)}</td>
                <td style="color: #d32f2f; font-weight: 600;">₹${dateData.prices.max_avg.toFixed(2)}</td>
                <td style="color: ${trendColor}; font-weight: 700;">${trendIcon}</td>
            </tr>
        `;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    resultsDiv.innerHTML = html;
}

function showTab(index) {
    const allTabs = document.querySelectorAll('.tab-pane');
    allTabs.forEach(tab => tab.style.display = 'none');
    
    const allButtons = document.querySelectorAll('.tab-button');
    allButtons.forEach(btn => btn.classList.remove('active'));
    
    const selectedTab = document.getElementById(`tab-${index}`);
    if (selectedTab) selectedTab.style.display = 'block';
    
    const selectedButton = document.querySelectorAll('.tab-button')[index];
    if (selectedButton) selectedButton.classList.add('active');
}

async function fetchLast10Days(commodity, district) {
    try {
        const response = await fetch('/api/market/last-10-days', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commodity, district })
        });
        
        const data = await response.json();
        
        if (data.success && data.records.length > 0) {
            displayLast10DaysData(data.records, commodity, district);
        }
    } catch (error) {
        console.error('Error fetching last 10 days data:', error);
    }
}

function displayLast10DaysData(records, commodity, district) {
    let html = `
        <div class="card">
            <h3 style="color: #2e7d32; margin-bottom: 25px; font-size: 1.5rem;">
                📆 Last 10 Days Data - ${district}
            </h3>
    `;
    
    if (records.length === 0) {
        html += `<p style="text-align: center; color: #666; padding: 40px;">No data available for the last 10 days.</p>`;
    } else {
        html += `
            <p style="margin-bottom: 20px; color: #666; font-size: 1.05rem;">
                Showing <strong>${records.length} records</strong> for <strong>${commodity}</strong> in <strong>${district}</strong>
            </p>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>📅 Date</th>
                            <th>🏪 Market</th>
                            <th>🌾 Commodity</th>
                            <th>💵 Min</th>
                            <th>💰 Modal</th>
                            <th>💎 Max</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        records.forEach(record => {
            html += `
                <tr>
                    <td style="font-weight: 600;">${record.Arrival_Date || 'N/A'}</td>
                    <td>${record.Market || 'N/A'}</td>
                    <td>${record.Commodity || 'N/A'}</td>
                    <td style="color: #1976d2; font-weight: 600;">₹${record.Min_Price || '0'}</td>
                    <td style="color: #2e7d32; font-weight: 700;">₹${record.Modal_Price || '0'}</td>
                    <td style="color: #d32f2f; font-weight: 600;">₹${record.Max_Price || '0'}</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
    }
    
    html += '</div>';
    
    resultsDiv.innerHTML += html;
}

async function fetchAllDistrictsData(commodity) {
    try {
        const response = await fetch('/api/market/all-districts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commodity })
        });
        
        const data = await response.json();
        
        if (data.success && data.records.length > 0) {
            displayAllDistrictsData(data.records, commodity);
        }
    } catch (error) {
        console.error('Error fetching all districts data:', error);
    }
}

function displayAllDistrictsData(records, commodity) {
    let html = `
        <div class="card">
            <h3 style="color: #2e7d32; margin-bottom: 25px; font-size: 1.5rem;">
                🗺️ State-Wide Data - All Districts
            </h3>
            <p style="margin-bottom: 20px; color: #666; font-size: 1.05rem;">
                Showing <strong>${records.length} records</strong> for <strong>${commodity}</strong> across <strong>Maharashtra</strong>
            </p>
            <div class="table-container" style="max-height: 500px;">
                <table>
                    <thead>
                        <tr>
                            <th>📅 Date</th>
                            <th>📍 District</th>
                            <th>🏪 Market</th>
                            <th>💵 Min</th>
                            <th>💰 Modal</th>
                            <th>💎 Max</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    records.forEach(record => {
        html += `
            <tr>
                <td style="font-weight: 600;">${record.Arrival_Date || 'N/A'}</td>
                <td style="font-weight: 600;">${record.District || 'N/A'}</td>
                <td>${record.Market || 'N/A'}</td>
                <td style="color: #1976d2; font-weight: 600;">₹${record.Min_Price || '0'}</td>
                <td style="color: #2e7d32; font-weight: 700;">₹${record.Modal_Price || '0'}</td>
                <td style="color: #d32f2f; font-weight: 600;">₹${record.Max_Price || '0'}</td>
            </tr>
        `;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    resultsDiv.innerHTML += html;
}

function showErrorMessage(message) {
    if (errorDiv) {
        errorDiv.style.display = 'block';
        errorDiv.innerHTML = `
            <div class="error-card">
                <div class="error-icon">⚠️</div>
                <h3>No Market Data Found</h3>
                <p>${message}</p>
                <p style="margin-top: 15px; font-size: 0.95rem;">
                    Please try a different crop or district combination.
                </p>
            </div>
        `;
    }
}

function exportToCSV() {
    if (!currentRecords || currentRecords.length === 0) {
        showToast('⚠️ No data to export', 'error');
        return;
    }
    
    let csv = 'Date,Market,Commodity,District,Min Price,Modal Price,Max Price\n';
    
    currentRecords.forEach(record => {
        csv += `${record.date},"${record.market}","${record.commodity}","${record.district}",${record.min_price},${record.modal_price},${record.max_price}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `market_prices_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    showToast('✅ Data exported successfully!', 'success');
}
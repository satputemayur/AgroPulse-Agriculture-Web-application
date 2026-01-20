// FILE: static/js/combo-box.js
// Universal Combo Box Component for CropWise
// Provides autocomplete dropdown functionality with manual input

class ComboBox {
    constructor(inputId, dropdownId, options) {
        this.input = document.getElementById(inputId);
        this.dropdown = document.getElementById(dropdownId);
        this.options = options || [];
        this.filteredOptions = [...this.options];
        this.selectedValue = '';
        this.isOpen = false;
        
        if (!this.input || !this.dropdown) {
            console.error('ComboBox elements not found');
            return;
        }
        
        this.init();
    }
    
    init() {
        // Input events
        this.input.addEventListener('focus', () => this.open());
        this.input.addEventListener('input', (e) => this.handleInput(e));
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
        
        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!this.input.contains(e.target) && !this.dropdown.contains(e.target)) {
                this.close();
            }
        });
        
        // Arrow click
        const arrow = this.input.nextElementSibling;
        if (arrow && arrow.classList.contains('combo-box-arrow')) {
            arrow.parentElement.addEventListener('click', (e) => {
                if (e.target === arrow || e.target === arrow.parentElement) {
                    e.stopPropagation();
                    if (this.isOpen) {
                        this.close();
                    } else {
                        this.input.focus();
                        this.open();
                    }
                }
            });
        }
    }
    
    handleInput(e) {
        const value = e.target.value.toLowerCase();
        this.filteredOptions = this.options.filter(opt => 
            opt.toLowerCase().includes(value)
        );
        this.render();
        if (!this.isOpen) this.open();
    }
    
    handleKeydown(e) {
        if (e.key === 'Escape') {
            this.close();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const firstOption = this.dropdown.querySelector('.combo-box-option');
            if (firstOption) {
                this.select(firstOption.textContent);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.navigateOptions(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.navigateOptions(-1);
        }
    }
    
    navigateOptions(direction) {
        const options = this.dropdown.querySelectorAll('.combo-box-option');
        const currentIndex = Array.from(options).findIndex(opt => 
            opt.classList.contains('selected')
        );
        
        let newIndex = currentIndex + direction;
        if (newIndex < 0) newIndex = options.length - 1;
        if (newIndex >= options.length) newIndex = 0;
        
        options.forEach((opt, idx) => {
            opt.classList.toggle('selected', idx === newIndex);
        });
        
        if (options[newIndex]) {
            options[newIndex].scrollIntoView({ block: 'nearest' });
        }
    }
    
    open() {
        this.isOpen = true;
        this.dropdown.classList.add('active');
        this.render();
    }
    
    close() {
        this.isOpen = false;
        this.dropdown.classList.remove('active');
    }
    
    render() {
        if (this.filteredOptions.length === 0) {
            this.dropdown.innerHTML = '<div class="combo-box-option" style="color: #999; cursor: default;">No matches found</div>';
            return;
        }
        
        this.dropdown.innerHTML = this.filteredOptions
            .map((option, index) => `
                <div class="combo-box-option ${index === 0 ? 'selected' : ''}" data-value="${option}">
                    ${this.highlightMatch(option, this.input.value)}
                </div>
            `)
            .join('');
        
        // Add click handlers
        this.dropdown.querySelectorAll('.combo-box-option').forEach(opt => {
            opt.addEventListener('click', () => {
                const value = opt.getAttribute('data-value');
                if (value) this.select(value);
            });
        });
    }
    
    highlightMatch(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<strong style="color: #2e7d32;">$1</strong>');
    }
    
    select(value) {
        this.selectedValue = value;
        this.input.value = value;
        this.close();
        
        // Trigger change event
        this.input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    getValue() {
        return this.input.value || this.selectedValue;
    }
    
    setValue(value) {
        this.input.value = value;
        this.selectedValue = value;
    }
    
    clear() {
        this.input.value = '';
        this.selectedValue = '';
        this.filteredOptions = [...this.options];
    }
}

// Initialize combo boxes when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for data to be loaded
    setTimeout(() => {
        if (typeof commodities !== 'undefined' && typeof districts !== 'undefined') {
            window.commodityComboBox = new ComboBox('commodity-input', 'commodity-dropdown', commodities);
            window.districtComboBox = new ComboBox('district-input', 'district-dropdown', districts);
            
            console.log('✅ Combo boxes initialized');
        }
        
        // For crops (videos page)
        if (typeof crops !== 'undefined') {
            window.cropComboBox = new ComboBox('crop-input', 'crop-dropdown', crops);
            console.log('✅ Crop combo box initialized');
        }
    }, 100);
});

// Helper function to get combo box value
function getComboBoxValue(comboBoxInstance) {
    return comboBoxInstance ? comboBoxInstance.getValue() : '';
}

// Clear form function
function clearForm() {
    if (window.commodityComboBox) window.commodityComboBox.clear();
    if (window.districtComboBox) window.districtComboBox.clear();
    
    const targetDateInput = document.getElementById('target-date');
    if (targetDateInput) targetDateInput.value = '2026-11-01';
    
    // Clear results
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) resultsDiv.style.display = 'none';
    
    showToast('🔄 Form cleared', 'info');
}
document.addEventListener('DOMContentLoaded', () => {
    
    // --- TAB SWITCHING LOGIC (UNCHANGED) ---
    const signalsBtn = document.getElementById('show-signals-btn');
    const calcBtn = document.getElementById('show-calc-btn');
    const signalsContainer = document.getElementById('signals-container');
    const compoundContainer = document.getElementById('compound-container');
    signalsBtn.addEventListener('click', () => {
        compoundContainer.style.display = 'none';
        signalsContainer.style.display = 'grid';
        signalsBtn.classList.add('active');
        calcBtn.classList.remove('active');
    });
    calcBtn.addEventListener('click', () => {
        signalsContainer.style.display = 'none';
        compoundContainer.style.display = 'block';
        calcBtn.classList.add('active');
        signalsBtn.classList.remove('active');
    });

    // --- SIGNAL FETCHING CODE (UNCHANGED) ---
    const lastUpdatedElem = document.getElementById('last-updated');
    const TIMEFRAMES = ['5m', '15m', '30m', '1h', '2h', '4h', '1d'];
    const fetchAndDisplaySignals = async () => { /* ... your entire function is unchanged ... */ };
    fetchAndDisplaySignals();


    // --- COMPOUND CALCULATOR LOGIC (UPDATED) ---
    const startBankrollInput = document.getElementById('start-bankroll');
    const targetBankrollInput = document.getElementById('target-bankroll');
    const tableBody = document.querySelector('#compound-table tbody');
    const resetButton = document.getElementById('reset-calculator');
    const RISK_PERCENT = 0.01;
    const RR_RATIO = 1;
    
    // State will now store numbers (the P/L) instead of "win" or "loss"
    let tradeResults = [];

    const saveState = () => {
        const state = { 
            start: startBankrollInput.value, 
            target: targetBankrollInput.value, 
            // Filter out empty values before saving for cleaner data
            results: tradeResults.filter(r => r !== null && r !== undefined)
        };
        localStorage.setItem('compoundChallengeState', JSON.stringify(state));
    };

    const loadState = () => {
        const savedState = localStorage.getItem('compoundChallengeState');
        if (savedState) {
            const state = JSON.parse(savedState);
            startBankrollInput.value = state.start || '5500';
            targetBankrollInput.value = state.target || '20000';
            tradeResults = state.results || [];
        }
    };

    const calculateAndRender = () => {
        tableBody.innerHTML = '';
        let currentBankroll = parseFloat(startBankrollInput.value);
        const targetBankroll = parseFloat(targetBankrollInput.value);
        let level = 1;
        let previousResultExists = true; // Used to disable future inputs

        while (currentBankroll < targetBankroll && currentBankroll > 0 && level < 200) {
            const startOfLevelBankroll = currentBankroll;
            const riskAmount = startOfLevelBankroll * RISK_PERCENT;
            const profitTarget = riskAmount * RR_RATIO;
            
            // Get the actual P/L from our results array for this level
            const actualPL = tradeResults[level - 1]; 
            let endOfLevelBankroll = startOfLevelBankroll;
            let rowClass = '';

            // Check if actualPL is a valid number
            if (typeof actualPL === 'number' && !isNaN(actualPL)) {
                endOfLevelBankroll += actualPL;
                rowClass = actualPL >= 0 ? 'win' : 'loss';
            } else {
                // This is a pending trade
                previousResultExists = false;
            }

            const row = document.createElement('tr');
            if (rowClass) row.className = rowClass;
            
            // The input field replaces the old <select> dropdown
            const resultCellHTML = `
                <td>
                    <input 
                        type="number" 
                        data-level="${level}" 
                        placeholder="P/L $" 
                        value="${typeof actualPL === 'number' ? actualPL.toFixed(2) : ''}"
                        ${!previousResultExists ? 'disabled' : ''}
                    >
                </td>
            `;

            row.innerHTML = `
                <td>${level}</td>
                <td>$${startOfLevelBankroll.toFixed(2)}</td>
                <td>$${riskAmount.toFixed(2)}</td>
                <td>$${profitTarget.toFixed(2)}</td>
                ${resultCellHTML}
                <td>$${endOfLevelBankroll.toFixed(2)}</td>
            `;
            tableBody.appendChild(row);
            
            currentBankroll = endOfLevelBankroll;
            level++;
        }
        
        // Add event listeners to the new input fields
        document.querySelectorAll('#compound-table input[type="number"]').forEach(input => {
            input.addEventListener('change', handlePLChange);
        });
        
        saveState();
    };

    const handlePLChange = (event) => {
        const level = parseInt(event.target.dataset.level);
        const value = event.target.value;

        // If the input is empty, treat it as a pending trade (null)
        // Otherwise, convert it to a number
        const newPL = value === '' ? null : parseFloat(value);

        tradeResults[level - 1] = newPL;

        // If a user clears an input, we should also clear all future results
        if (newPL === null) {
            tradeResults.splice(level - 1);
        }

        calculateAndRender(); // Re-calculate and re-draw everything
    };

    const resetCalculator = () => {
        if (confirm('Are you sure you want to reset all progress?')) {
            localStorage.removeItem('compoundChallengeState');
            tradeResults = [];
            startBankrollInput.value = '5500';
            targetBankrollInput.value = '20000';
            calculateAndRender();
        }
    };

    startBankrollInput.addEventListener('change', calculateAndRender);
    targetBankrollInput.addEventListener('change', calculateAndRender);
    resetButton.addEventListener('click', resetCalculator);

    loadState();
    calculateAndRender();
});

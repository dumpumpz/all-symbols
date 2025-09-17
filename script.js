document.addEventListener('DOMContentLoaded', () => {
    
    // --- BULLETPROOF TAB SWITCHING LOGIC (Correct and Unchanged) ---
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

    // --- SIGNAL FETCHING CODE (Correct and Unchanged) ---
    const lastUpdatedElem = document.getElementById('last-updated');
    const TIMEFRAMES = ['5m', '15m', '30m', '1h', '2h', '4h', '1d'];
    const fetchAndDisplaySignals = async () => { /* ... your entire function ... */ 
        lastUpdatedElem.textContent = new Date().toLocaleString();
        signalsContainer.innerHTML = ''; 
        for (const tf of TIMEFRAMES) {
            const url = `signals_report_${tf}.json`;
            const timeframeDiv = document.createElement('div');
            timeframeDiv.className = 'timeframe-section';
            const title = document.createElement('h2');
            title.className = 'timeframe-title';
            title.textContent = `Timeframe: ${tf}`;
            const signalsList = document.createElement('div');
            signalsList.className = 'signal-list';
            title.addEventListener('click', () => {
                const isExpanded = timeframeDiv.classList.contains('expanded');
                if (!isExpanded) {
                    timeframeDiv.classList.add('expanded');
                    signalsList.style.height = signalsList.scrollHeight + 'px';
                } else {
                    signalsList.style.height = '0px';
                    signalsList.addEventListener('transitionend', () => {
                        timeframeDiv.classList.remove('expanded');
                    }, { once: true });
                }
            });
            timeframeDiv.appendChild(title);
            timeframeDiv.appendChild(signalsList);
            try {
                const response = await fetch(`${url}?v=${new Date().getTime()}`);
                if (!response.ok) throw new Error(`File not found for ${tf}`);
                const data = await response.json();
                const threeDayTimeframes = ['5m', '15m', '30m', '1h'];
                let daysToKeep = threeDayTimeframes.includes(tf) ? 3 : 10;
                const cutoffDate = new Date();
                cutoffDate.setDate(new Date().getDate() - daysToKeep);
                let filteredSignals = [];
                if (data && data[0] && data[0].sections) {
                    filteredSignals = data[0].sections.filter(signal => new Date(signal.entry_date) >= cutoffDate);
                }
                if (filteredSignals.length > 0) {
                    filteredSignals.forEach(signal => {
                        const card = document.createElement('div');
                        card.className = `signal-card ${signal.direction.toLowerCase()}`;
                        card.innerHTML = `<p><strong>Symbol:</strong> ${signal.symbol}</p><p><strong>Direction:</strong> ${signal.direction}</p><p><strong>Date:</strong> ${signal.entry_date}</p><p><strong>Entry:</strong> ${signal.entry}</p><p><strong>Resistance:</strong> ${signal.resistance}</p><p><strong>Stoploss:</strong> ${signal.stoploss}</p>`;
                        signalsList.appendChild(card);
                    });
                } else {
                    const noSignalMsg = document.createElement('p');
                    noSignalMsg.textContent = `No signals found within the last ${daysToKeep} days.`;
                    signalsList.appendChild(noSignalMsg);
                }
            } catch (error) {
                console.error(`Could not load signals for ${tf}:`, error);
                const errorMsg = document.createElement('p');
                errorMsg.textContent = `Could not load data for this timeframe.`;
                signalsList.appendChild(errorMsg);
            }
            signalsContainer.appendChild(timeframeDiv);
        }
    };
    fetchAndDisplaySignals();

    // --- COMPOUND CALCULATOR LOGIC (CORRECTED VERSION WITH NUMERIC INPUT) ---
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
            startBankrollInput.value = state.start || '1000';
            targetBankrollInput.value = state.target || '5500';
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
            startBankrollInput.value = '1000';
            targetBankrollInput.value = '5500';
            calculateAndRender();
        }
    };

    startBankrollInput.addEventListener('change', calculateAndRender);
    targetBankrollInput.addEventListener('change', calculateAndRender);
    resetButton.addEventListener('click', resetCalculator);

    loadState();
    calculateAndRender();
});

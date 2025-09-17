document.addEventListener('DOMContentLoaded', () => {
    
    // --- NEW BULLETPROOF TAB SWITCHING LOGIC ---
    const signalsBtn = document.getElementById('show-signals-btn');
    const calcBtn = document.getElementById('show-calc-btn');
    const signalsContainer = document.getElementById('signals-container');
    const compoundContainer = document.getElementById('compound-container');

    signalsBtn.addEventListener('click', () => {
        // Show Signals
        compoundContainer.style.display = 'none';
        signalsContainer.style.display = 'grid'; // Crucially, restore the grid layout!

        // Update button styles
        signalsBtn.classList.add('active');
        calcBtn.classList.remove('active');
    });

    calcBtn.addEventListener('click', () => {
        // Show Calculator
        signalsContainer.style.display = 'none';
        compoundContainer.style.display = 'block';

        // Update button styles
        calcBtn.classList.add('active');
        signalsBtn.classList.remove('active');
    });
    // --- END OF NEW TAB LOGIC ---


    // --- YOUR ORIGINAL SIGNAL FETCHING CODE (UNCHANGED) ---
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


    // --- COMPOUND CALCULATOR LOGIC (UNCHANGED) ---
    const startBankrollInput = document.getElementById('start-bankroll');
    const targetBankrollInput = document.getElementById('target-bankroll');
    const tableBody = document.querySelector('#compound-table tbody');
    const resetButton = document.getElementById('reset-calculator');
    const RISK_PERCENT = 0.01;
    const RR_RATIO = 1;
    let tradeResults = [];

    const saveState = () => { /* ... */ 
        const state = { start: startBankrollInput.value, target: targetBankrollInput.value, results: tradeResults };
        localStorage.setItem('compoundChallengeState', JSON.stringify(state));
    };
    const loadState = () => { /* ... */
        const savedState = localStorage.getItem('compoundChallengeState');
        if (savedState) {
            const state = JSON.parse(savedState);
            startBankrollInput.value = state.start || '1000';
            targetBankrollInput.value = state.target || '5500';
            tradeResults = state.results || [];
        }
    };
    const calculateAndRender = () => { /* ... your entire function ... */
        tableBody.innerHTML = '';
        let currentBankroll = parseFloat(startBankrollInput.value);
        const targetBankroll = parseFloat(targetBankrollInput.value);
        let level = 1;
        let tradeHasBeenLogged = false;
        while (currentBankroll < targetBankroll && currentBankroll > 0 && level < 200) {
            const startOfLevelBankroll = currentBankroll;
            const riskAmount = startOfLevelBankroll * RISK_PERCENT;
            const profitTarget = riskAmount * RR_RATIO;
            const result = tradeResults[level - 1] || 'pending';
            let endOfLevelBankroll = startOfLevelBankroll;
            let rowClass = '';
            if (result === 'win') {
                endOfLevelBankroll += profitTarget;
                rowClass = 'win';
                tradeHasBeenLogged = true;
            } else if (result === 'loss') {
                endOfLevelBankroll -= riskAmount;
                rowClass = 'loss';
                tradeHasBeenLogged = true;
            }
            const row = document.createElement('tr');
            if (rowClass) row.className = rowClass;
            row.innerHTML = `<td>${level}</td><td>$${startOfLevelBankroll.toFixed(2)}</td><td>$${riskAmount.toFixed(2)}</td><td>$${profitTarget.toFixed(2)}</td><td><select data-level="${level}"><option value="pending" ${result === 'pending' ? 'selected' : ''}>Pending</option><option value="win" ${result === 'win' ? 'selected' : ''}>Win</option><option value="loss" ${result === 'loss' ? 'selected' : ''}>Loss</option></select></td><td>$${endOfLevelBankroll.toFixed(2)}</td>`;
            tableBody.appendChild(row);
            const selectElement = row.querySelector('select');
            if (tradeHasBeenLogged && result === 'pending') {
                selectElement.disabled = true;
            }
            currentBankroll = endOfLevelBankroll;
            level++;
        }
        document.querySelectorAll('#compound-table select').forEach(select => {
            select.addEventListener('change', handleResultChange);
        });
        saveState();
    };
    const handleResultChange = (event) => { /* ... */
        const level = parseInt(event.target.dataset.level);
        const result = event.target.value;
        tradeResults[level - 1] = result;
        if(result === 'pending') { tradeResults.splice(level - 1); }
        calculateAndRender();
    };
    const resetCalculator = () => { /* ... */
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

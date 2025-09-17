document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Script is running."); // Debug message 1

    // --- TAB SWITCHING LOGIC ---
    const signalsBtn = document.getElementById('show-signals-btn');
    const calcBtn = document.getElementById('show-calc-btn');
    const signalsContainer = document.getElementById('signals-container');
    const compoundContainer = document.getElementById('compound-container');

    if (signalsBtn && calcBtn && signalsContainer && compoundContainer) {
        console.log("Tab buttons and containers found."); // Debug message 2

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
    } else {
        console.error("CRITICAL ERROR: One or more tab elements were not found.");
    }

    // --- SIGNAL FETCHING CODE (TEMPORARILY DISABLED FOR DEBUGGING) ---
    // const lastUpdatedElem = document.getElementById('last-updated');
    // const TIMEFRAMES = ['5m', '15m', '30m', '1h', '2h', '4h', '1d'];
    // const fetchAndDisplaySignals = async () => { ... };
    // fetchAndDisplaySignals();
    console.log("Signal fetching is temporarily disabled."); // Debug message 3


    // --- COMPOUND CALCULATOR LOGIC ---
    const startBankrollInput = document.getElementById('start-bankroll');
    const targetBankrollInput = document.getElementById('target-bankroll');
    const tableBody = document.querySelector('#compound-table tbody');
    const resetButton = document.getElementById('reset-calculator');

    if (startBankrollInput && targetBankrollInput && tableBody && resetButton) {
        console.log("Calculator elements found."); // Debug message 4
        
        const RISK_PERCENT = 0.01;
        let tradeResults = [];

        const saveState = () => {
            const state = { start: startBankrollInput.value, target: targetBankrollInput.value, results: tradeResults.filter(r => r !== null && r !== undefined) };
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
            console.log("State loaded.");
        };

        const calculateAndRender = () => {
            console.log("calculateAndRender started.");
            tableBody.innerHTML = '';
            let currentBankroll = parseFloat(startBankrollInput.value) || 0;
            const targetBankroll = parseFloat(targetBankrollInput.value) || 0;
            let level = 1;
            let foundFirstEmptyInput = false;

            while (currentBankroll < targetBankroll && currentBankroll > 0 && level < 200) {
                const startOfLevelBankroll = currentBankroll;
                const riskAmount = startOfLevelBankroll * RISK_PERCENT;
                const profitTarget = riskAmount;
                const actualPL = tradeResults[level - 1];
                let endOfLevelBankroll = startOfLevelBankroll;
                let rowClass = '';
                let isEnabled = false;

                if (typeof actualPL === 'number' && !isNaN(actualPL)) {
                    endOfLevelBankroll += actualPL;
                    rowClass = actualPL >= 0 ? 'win' : 'loss';
                } else if (!foundFirstEmptyInput) {
                    isEnabled = true;
                    foundFirstEmptyInput = true;
                }

                const row = document.createElement('tr');
                if (rowClass) row.className = rowClass;
                row.innerHTML = `
                    <td>${level}</td>
                    <td>$${startOfLevelBankroll.toFixed(2)}</td>
                    <td>$${riskAmount.toFixed(2)}</td>
                    <td>$${profitTarget.toFixed(2)}</td>
                    <td><input type="number" data-level="${level}" placeholder="P/L $" value="${typeof actualPL === 'number' ? actualPL.toFixed(2) : ''}" ${isEnabled ? '' : 'disabled'}></td>
                    <td>$${endOfLevelBankroll.toFixed(2)}</td>`;
                tableBody.appendChild(row);

                currentBankroll = endOfLevelBankroll;
                level++;
            }

            document.querySelectorAll('#compound-table input[type="number"]').forEach(input => {
                input.addEventListener('change', handlePLChange);
            });
            saveState();
            console.log("Table rendered.");
        };

        const handlePLChange = (event) => {
            const level = parseInt(event.target.dataset.level);
            const value = event.target.value;
            tradeResults[level - 1] = (value === '') ? null : parseFloat(value);
            if (tradeResults[level - 1] === null) {
                tradeResults.splice(level - 1);
            }
            calculateAndRender();
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

    } else {
        console.error("CRITICAL ERROR: One or more calculator elements were not found.");
    }
});

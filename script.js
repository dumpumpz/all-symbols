document.addEventListener('DOMContentLoaded', () => {
    // --- MASTER MODE CHECK ---
    const urlParams = new URLSearchParams(window.location.search);
    const isMasterMode = urlParams.get('master') === 'true';

    // --- FIREBASE SETUP ---
    const firebaseConfig = {
      apiKey: "AIzaSyCQ4vHqGiv_yRkA0zZaaOU24gxhqBkxnv4",
      authDomain: "journal-a003f.firebaseapp.com",
      databaseURL: "https://journal-a003f-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "journal-a003f",
      storageBucket: "journal-a003f.appspot.com",
      messagingSenderId: "1038636626553",
      appId: "1:1038636626553:web:9d8bb7a6a80a9ce4dc9aa8"
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    const MASTER_USER_ID = "local_pc_main_user";

    // --- REUSABLE CALCULATOR INITIALIZER ---
    const initializeCompoundCalculator = (config) => {
        const startBankrollInput = document.getElementById(config.startBankrollId);
        const targetBankrollInput = document.getElementById(config.targetBankrollId);
        const tableBody = document.querySelector(`#${config.tableId} tbody`);
        const resetButton = document.getElementById(config.resetButtonId);
        
        startBankrollInput.disabled = !isMasterMode;
        targetBankrollInput.disabled = !isMasterMode;
        resetButton.disabled = !isMasterMode;

        let tradeResults = [];

        const saveState = async () => {
            if (!isMasterMode) return;
            const dataToSave = { start: startBankrollInput.value, target: targetBankrollInput.value, results: tradeResults.filter(r => r !== null && r !== undefined) };
            try {
                // This path now correctly matches your Firebase Rules
                await db.ref(config.firebasePath + '/' + MASTER_USER_ID).set(dataToSave);
                console.log(`Data saved to: ${config.firebasePath}/${MASTER_USER_ID}`);
            } catch (error) {
                console.error("Error saving data: ", error);
            }
        };

        const loadState = async () => {
            const snapshot = await db.ref(config.firebasePath + '/' + MASTER_USER_ID).get();
            if (snapshot.exists()) {
                const data = snapshot.val();
                startBankrollInput.value = data.start || config.defaultStart;
                targetBankrollInput.value = data.target || config.defaultTarget;
                tradeResults = data.results || [];
            } else {
                startBankrollInput.value = config.defaultStart;
                targetBankrollInput.value = config.defaultTarget;
                tradeResults = [];
            }
            calculateAndRender();
        };

        const calculateAndRender = () => {
            tableBody.innerHTML = '';
            let bankrollForNextLevel = parseFloat(startBankrollInput.value) || 0;
            const targetBankroll = parseFloat(targetBankrollInput.value) || 0;
            let level = 1;
            let foundFirstEmptyInput = false;

            while (bankrollForNextLevel < targetBankroll && bankrollForNextLevel > 0 && level < 200) {
                const startOfLevelBankroll = bankrollForNextLevel;
                const riskAmount = startOfLevelBankroll * config.riskPercent;
                const profitTarget = riskAmount;
                const actualPL = tradeResults[level - 1];
                let endOfLevelBankroll;
                let rowClass = '';
                let isEnabledForInput = false;

                if (typeof actualPL === 'number' && !isNaN(actualPL)) {
                    endOfLevelBankroll = startOfLevelBankroll + actualPL;
                    rowClass = actualPL >= 0 ? 'win' : 'loss';
                } else {
                    endOfLevelBankroll = startOfLevelBankroll + profitTarget;
                    rowClass = 'projected';
                    if (!foundFirstEmptyInput) {
                        isEnabledForInput = true;
                        foundFirstEmptyInput = true;
                    }
                }

                const isDisabled = !isMasterMode || !isEnabledForInput;
                const row = document.createElement('tr');
                if (rowClass) row.className = rowClass;
                row.innerHTML = `
                    <td>${level}</td>
                    <td>$${startOfLevelBankroll.toFixed(2)}</td>
                    <td>$${riskAmount.toFixed(2)}</td>
                    <td>$${profitTarget.toFixed(2)}</td>
                    <td><input type="number" data-level="${level}" placeholder="${isMasterMode ? 'P/L $' : 'Read-Only'}" value="${typeof actualPL === 'number' ? actualPL.toFixed(2) : ''}" ${isDisabled ? 'disabled' : ''}></td>
                    <td>$${endOfLevelBankroll.toFixed(2)}</td>`;
                tableBody.appendChild(row);
                bankrollForNextLevel = endOfLevelBankroll;
                level++;
            }
            document.querySelectorAll(`#${config.tableId} input[type="number"]`).forEach(input => {
                input.addEventListener('change', handlePLChange);
            });
        };

        const handlePLChange = (event) => {
            if (!isMasterMode) return;
            const level = parseInt(event.target.dataset.level);
            const value = event.target.value;
            tradeResults[level - 1] = (value === '') ? null : parseFloat(value);
            if (tradeResults[level - 1] === null) {
                tradeResults.splice(level - 1);
            }
            calculateAndRender();
            saveState();
        };

        startBankrollInput.addEventListener('change', () => { calculateAndRender(); saveState(); });
        targetBankrollInput.addEventListener('change', () => { calculateAndRender(); saveState(); });
        resetButton.addEventListener('click', () => {
            if (!isMasterMode) return;
            if (confirm('Are you sure you want to reset all progress for this challenge?')) {
                tradeResults = [];
                startBankrollInput.value = config.defaultStart;
                targetBankrollInput.value = config.defaultTarget;
                calculateAndRender();
                saveState();
            }
        });
        loadState();
    };

    // --- INITIALIZE BOTH CALCULATORS ---
    initializeCompoundCalculator({
        startBankrollId: 'start-bankroll-1',
        targetBankrollId: 'target-bankroll-1',
        resetButtonId: 'reset-calculator-1',
        tableId: 'compound-table-1',
        riskPercent: 0.01,
        // ▼▼▼ THIS LINE HAS CHANGED ▼▼▼
        firebasePath: 'compounding_data/1_percent', // This path is now allowed by your rules
        defaultStart: '5500',
        defaultTarget: '20000'
    });

    initializeCompoundCalculator({
        startBankrollId: 'start-bankroll-2',
        targetBankrollId: 'target-bankroll-2',
        resetButtonId: 'reset-calculator-2',
        tableId: 'compound-table-2',
        riskPercent: 0.02,
        // ▼▼▼ THIS LINE HAS CHANGED ▼▼▼
        firebasePath: 'compounding_data/2_percent', // This path is now allowed by your rules
        defaultStart: '5500',
        defaultTarget: '20000'
    });

    // --- TAB SWITCHING LOGIC ---
    const signalsBtn = document.getElementById('show-signals-btn');
    const calc1Btn = document.getElementById('show-calc-1-btn');
    const calc2Btn = document.getElementById('show-calc-2-btn');
    const signalsContainer = document.getElementById('signals-container');
    const calc1Container = document.getElementById('compound-container-1');
    const calc2Container = document.getElementById('compound-container-2');
    const allTabs = [signalsBtn, calc1Btn, calc2Btn];
    const allContent = [signalsContainer, calc1Container, calc2Container];

    const switchTab = (activeBtn, activeContent) => {
        allTabs.forEach(btn => btn.classList.remove('active'));
        allContent.forEach(content => content.style.display = 'none');
        activeBtn.classList.add('active');
        activeContent.style.display = (activeContent === signalsContainer) ? 'grid' : 'block';
    };
    signalsBtn.addEventListener('click', () => switchTab(signalsBtn, signalsContainer));
    calc1Btn.addEventListener('click', () => switchTab(calc1Btn, calc1Container));
    calc2Btn.addEventListener('click', () => switchTab(calc2Btn, calc2Container));

    // --- SIGNALS CODE (Unchanged) ---
    const lastUpdatedElem = document.getElementById('last-updated');
    const TIMEFRAMES = ['5m', '15m', '30m', '1h', '2h', '4h', '1d'];
    const fetchAndDisplaySignals = async () => {
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
});

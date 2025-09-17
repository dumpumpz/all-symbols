document.addEventListener('DOMContentLoaded', () => {
    // --- START FIREBASE SETUP ---

    // Your specific Firebase configuration is now included
    const firebaseConfig = {
      apiKey: "AIzaSyCQ4vHqGiv_yRkA0zZaaOU24gxhqBkxnv4",
      authDomain: "journal-a003f.firebaseapp.com",
      databaseURL: "https://journal-a003f-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "journal-a003f",
      storageBucket: "journal-a003f.appspot.com",
      messagingSenderId: "1038636626553",
      appId: "1:1038636626553:web:9d8bb7a6a80a9ce4dc9aa8"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore(); // We are using Firestore, the modern database
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    let currentUser = null; // Variable to hold the current user's data

    // --- UI Elements ---
    const authBtn = document.getElementById('auth-btn');
    const userStatus = document.getElementById('user-status');
    const compoundContainer = document.getElementById('compound-container');
    const startBankrollInput = document.getElementById('start-bankroll');
    const targetBankrollInput = document.getElementById('target-bankroll');
    const tableBody = document.querySelector('#compound-table tbody');
    const resetButton = document.getElementById('reset-calculator');

    // --- AUTHENTICATION LOGIC ---
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in
            currentUser = user;
            userStatus.textContent = `Signed in as ${user.displayName}`;
            authBtn.textContent = 'Sign Out';
            authBtn.classList.add('logout');
            loadState(); // Load the user's data from Firestore
        } else {
            // User is signed out
            currentUser = null;
            userStatus.textContent = 'Please sign in to save progress';
            authBtn.textContent = 'Sign in with Google';
            authBtn.classList.remove('logout');
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Please sign in to view your challenge.</td></tr>';
        }
    });

    authBtn.addEventListener('click', () => {
        if (currentUser) {
            auth.signOut();
        } else {
            auth.signInWithPopup(googleProvider);
        }
    });

    // --- COMPOUND CALCULATOR LOGIC (UPDATED FOR FIREBASE) ---
    const RISK_PERCENT = 0.01;
    let tradeResults = [];

    const saveState = async () => {
        if (!currentUser) return;
        const dataToSave = {
            start: startBankrollInput.value,
            target: targetBankrollInput.value,
            results: tradeResults.filter(r => r !== null && r !== undefined)
        };
        try {
            await db.collection('users').doc(currentUser.uid).set(dataToSave);
            console.log("Progress saved to Firestore!");
        } catch (error) {
            console.error("Error saving data: ", error);
        }
    };

    const loadState = async () => {
        if (!currentUser) return;
        const userDocRef = db.collection('users').doc(currentUser.uid);
        const doc = await userDocRef.get();
        if (doc.exists) {
            const data = doc.data();
            startBankrollInput.value = data.start || '5500';
            targetBankrollInput.value = data.target || '20000';
            tradeResults = data.results || [];
        } else {
            startBankrollInput.value = '5500';
            targetBankrollInput.value = '20000';
            tradeResults = [];
        }
        calculateAndRender();
    };

    const calculateAndRender = () => {
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
    };

    const handlePLChange = (event) => {
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
        if (confirm('Are you sure you want to reset all progress? This will clear all P/L entries.')) {
            tradeResults = [];
            startBankrollInput.value = '5500';
            targetBankrollInput.value = '20000';
            calculateAndRender();
            saveState();
        }
    });

    // --- UNCHANGED CODE (Signals, Tabs) ---
    const signalsBtn = document.getElementById('show-signals-btn');
    const calcBtn = document.getElementById('show-calc-btn');
    const signalsContainer = document.getElementById('signals-container');

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

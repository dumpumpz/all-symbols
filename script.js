document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('signals-container');
    const lastUpdatedElem = document.getElementById('last-updated');
    
    const TIMEFRAMES = ['5m', '15m', '30m', '1h', '2h', '4h', '1d'];

    const fetchAndDisplaySignals = async () => {
        lastUpdatedElem.textContent = new Date().toLocaleString();
        container.innerHTML = ''; 

        for (const tf of TIMEFRAMES) {
            const url = `signals_report_${tf}.json`;
            
            const timeframeDiv = document.createElement('div');
            timeframeDiv.className = 'timeframe-section'; 

            const title = document.createElement('h2');
            title.className = 'timeframe-title';
            title.textContent = `Timeframe: ${tf}`;

            const signalsList = document.createElement('div');
            signalsList.className = 'signal-list';
            
            // --- ★★★ THE DEFINITIVE JAVASCRIPT ANIMATION LOGIC ★★★ ---
            title.addEventListener('click', () => {
                const isExpanded = timeframeDiv.classList.contains('expanded');

                if (!isExpanded) {
                    // --- EXPAND SEQUENCE ---
                    // 1. Instantly apply the 'expanded' class to make it full-width
                    timeframeDiv.classList.add('expanded');
                    
                    // 2. Set height to its full, measured scrollHeight to trigger animation
                    signalsList.style.height = signalsList.scrollHeight + 'px';

                } else {
                    // --- COLLAPSE SEQUENCE ---
                    // 1. Set height back to 0 to start the collapse animation
                    signalsList.style.height = '0px';

                    // 2. IMPORTANT: Listen for when the height animation finishes
                    signalsList.addEventListener('transitionend', () => {
                        // 3. ONLY AFTER it's fully collapsed, remove the class to snap it back to its grid cell
                        timeframeDiv.classList.remove('expanded');
                    }, { once: true }); // {once: true} automatically removes the listener after it fires once
                }
            });
            
            timeframeDiv.appendChild(title);
            timeframeDiv.appendChild(signalsList);

            // Fetching and populating logic remains the same...
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
                        card.innerHTML = `
                            <p><strong>Symbol:</strong> ${signal.symbol}</p>
                            <p><strong>Direction:</strong> ${signal.direction}</p>
                            <p><strong>Date:</strong> ${signal.entry_date}</p>
                            <p><strong>Entry:</strong> ${signal.entry}</p>
                            <p><strong>Resistance:</strong> ${signal.resistance}</p>
                            <p><strong>Stoploss:</strong> ${signal.stoploss}</p>
                        `;
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
            
            container.appendChild(timeframeDiv);
        }
    };

    fetchAndDisplaySignals();
});
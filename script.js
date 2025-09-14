document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('signals-container');
    const lastUpdatedElem = document.getElementById('last-updated');
    
    const TIMEFRAMES = ['5m', '15m', '30m', '1h', '2h', '4h', '1d'];

    const fetchAndDisplaySignals = async () => {
        lastUpdatedElem.textContent = new Date().toLocaleString();
        container.innerHTML = ''; 

        for (const tf of TIMEFRAMES) {
            const url = `signals_report_${tf}.json`;
            
            // Main container for the whole section
            const timeframeDiv = document.createElement('div');
            timeframeDiv.className = 'timeframe-section collapsed'; // Start as collapsed by default

            // The clickable header
            const title = document.createElement('h2');
            title.className = 'timeframe-title';
            title.textContent = `Timeframe: ${tf}`;

            // A new container for the list of signals that will be toggled
            const signalsList = document.createElement('div');
            signalsList.className = 'signal-list';

            // Add the click event listener to the title
            title.addEventListener('click', () => {
                timeframeDiv.classList.toggle('collapsed');
            });
            
            // Append the title and the (currently empty) signal list to the main div
            timeframeDiv.appendChild(title);
            timeframeDiv.appendChild(signalsList);

            try {
                const response = await fetch(`${url}?v=${new Date().getTime()}`);
                if (!response.ok) throw new Error(`File not found for ${tf}`);
                
                const data = await response.json();
                
                // Filtering logic (from previous request)
                const threeDayTimeframes = ['5m', '15m', '30m', '1h'];
                let daysToKeep = threeDayTimeframes.includes(tf) ? 3 : 10;
                const cutoffDate = new Date();
                cutoffDate.setDate(new Date().getDate() - daysToKeep);
                
                let filteredSignals = [];
                if (data && data[0] && data[0].sections) {
                    filteredSignals = data[0].sections.filter(signal => new Date(signal.entry_date) >= cutoffDate);
                }

                // Now, add content to the 'signalsList' container
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
                        signalsList.appendChild(card); // Append card to the collapsible list
                    });
                } else {
                    const noSignalMsg = document.createElement('p');
                    noSignalMsg.textContent = `No signals found within the last ${daysToKeep} days.`;
                    signalsList.appendChild(noSignalMsg); // Append message to the collapsible list
                }

            } catch (error) {
                console.error(`Could not load signals for ${tf}:`, error);
                const errorMsg = document.createElement('p');
                errorMsg.textContent = `Could not load data for this timeframe.`;
                signalsList.appendChild(errorMsg); // Append error to the collapsible list
            }
            
            // Finally, add the complete section to the page container
            container.appendChild(timeframeDiv);
        }
    };

    fetchAndDisplaySignals();
});
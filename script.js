document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('signals-container');
    const lastUpdatedElem = document.getElementById('last-updated');
    
    // Timeframes defined in your Python script
    const TIMEFRAMES = ['5m', '15m', '30m', '1h', '2h', '4h', '1d'];

    const fetchAndDisplaySignals = async () => {
        // Update the timestamp
        lastUpdatedElem.textContent = new Date().toLocaleString();
        container.innerHTML = ''; // Clear previous content

        for (const tf of TIMEFRAMES) {
            const url = `signals_report_${tf}.json`;
            
            const timeframeDiv = document.createElement('div');
            timeframeDiv.className = 'timeframe-section';
            const title = document.createElement('h2');
            title.className = 'timeframe-title';
            title.textContent = `Timeframe: ${tf}`;
            timeframeDiv.appendChild(title);

            try {
                const response = await fetch(`${url}?v=${new Date().getTime()}`); // Cache-busting
                if (!response.ok) throw new Error(`File not found or error for ${tf}`);
                
                const data = await response.json();
                
                // --- NEW LOGIC STARTS HERE ---

                // 1. Determine the number of days to keep signals for this timeframe
                const threeDayTimeframes = ['5m', '15m', '30m', '1h'];
                let daysToKeep = 10; // Default to 10 days
                if (threeDayTimeframes.includes(tf)) {
                    daysToKeep = 3; // Set to 3 days for specific timeframes
                }

                // 2. Calculate the cutoff date
                const now = new Date();
                const cutoffDate = new Date();
                cutoffDate.setDate(now.getDate() - daysToKeep);

                // 3. Filter the signals to only include recent ones
                let filteredSignals = [];
                if (data && data[0] && data[0].sections) {
                    filteredSignals = data[0].sections.filter(signal => {
                        const signalDate = new Date(signal.entry_date); // Convert signal's date string to a Date object
                        return signalDate >= cutoffDate; // Keep the signal if its date is on or after the cutoff date
                    });
                }
                
                // --- NEW LOGIC ENDS HERE ---

                // 4. Display the filtered signals
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
                        timeframeDiv.appendChild(card);
                    });
                } else {
                    const noSignalMsg = document.createElement('p');
                    // Updated message to reflect the filtering
                    noSignalMsg.textContent = `No signals found within the last ${daysToKeep} days.`;
                    timeframeDiv.appendChild(noSignalMsg);
                }

            } catch (error) {
                console.error(`Could not load signals for ${tf}:`, error);
                const errorMsg = document.createElement('p');
                errorMsg.textContent = `Could not load data for this timeframe.`;
                timeframeDiv.appendChild(errorMsg);
            }
            container.appendChild(timeframeDiv);
        }
    };

    fetchAndDisplaySignals();
});
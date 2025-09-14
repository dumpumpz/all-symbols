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
            
            // Create a container for this timeframe
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
                
                if (data && data[0] && data[0].sections && data[0].sections.length > 0) {
                    data[0].sections.forEach(signal => {
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
                    noSignalMsg.textContent = 'No active signals found for this timeframe.';
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

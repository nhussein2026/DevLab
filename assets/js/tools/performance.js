function analyzePerformance() {
    const url = document.getElementById('analysisUrl').value;
    const resultsDiv = document.getElementById('performanceResults');
    const detailedDiv = document.getElementById('detailedResults');

    if (!url) {
        alert('Please enter a URL');
        return;
    }

    // Show loading state
    resultsDiv.innerHTML = '<div class="loading">Analyzing...</div>';
    detailedDiv.innerHTML = '';

    // Simulate performance analysis (in a real app, this would use Performance API or external services)
    setTimeout(() => {
        // Mock performance data
        const mockData = {
            loadTime: '2.3s',
            pageSize: '1.2 MB',
            requests: '24',
            score: '85/100'
        };

        resultsDiv.innerHTML = `
            <div class="metric-card">
                <h3>Loading Time</h3>
                <div id="loadTime">${mockData.loadTime}</div>
            </div>
            <div class="metric-card">
                <h3>Page Size</h3>
                <div id="pageSize">${mockData.pageSize}</div>
            </div>
            <div class="metric-card">
                <h3>Requests</h3>
                <div id="requests">${mockData.requests}</div>
            </div>
            <div class="metric-card">
                <h3>Score</h3>
                <div id="performanceScore">${mockData.score}</div>
            </div>
        `;

        detailedDiv.innerHTML = `
            <h3>Detailed Analysis</h3>
            <div class="recommendations">
                <h4>Recommendations:</h4>
                <ul>
                    <li>Optimize images to reduce page size</li>
                    <li>Minify CSS and JavaScript files</li>
                    <li>Use browser caching</li>
                    <li>Enable compression (GZIP)</li>
                </ul>
            </div>
        `;
    }, 2000);
}

// Test current page performance using Performance API
function testCurrentPage() {
    if ('performance' in window) {
        const perfData = performance.getEntriesByType('navigation')[0];
        const loadTime = perfData.loadEventEnd - perfData.fetchStart;

        document.getElementById('loadTime').textContent = (loadTime / 1000).toFixed(2) + 's';
        document.getElementById('requests').textContent = performance.getEntriesByType('resource').length;
    }
}

// Run analysis on page load
document.addEventListener('DOMContentLoaded', function() {
    testCurrentPage();
});
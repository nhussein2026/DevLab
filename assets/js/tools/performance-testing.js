// Performance Testing Tool
class PerformanceTester {
    constructor() {
        this.results = [];
        this.isRunning = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSavedTests();
    }

    setupEventListeners() {
        const runBtn = document.getElementById('runTest');
        const clearBtn = document.getElementById('clearResults');
        const saveBtn = document.getElementById('saveTest');
        const loadBtn = document.getElementById('loadTest');

        if (runBtn) runBtn.addEventListener('click', () => this.runTest());
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearResults());
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveTest());
        if (loadBtn) loadBtn.addEventListener('click', () => this.loadTest());
    }

    runTest() {
        if (this.isRunning) return;

        const code = document.getElementById('testCode').value;
        const iterations = parseInt(document.getElementById('iterations').value) || 1;

        if (!code.trim()) {
            this.showError('Please enter some code to test.');
            return;
        }

        this.isRunning = true;
        this.updateUI(true);
        this.clearResults();

        try {
            this.executeTest(code, iterations);
        } catch (error) {
            this.showError(`Test execution failed: ${error.message}`);
            this.updateUI(false);
        }
    }

    async executeTest(code, iterations) {
        const results = [];
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');

        // Create a new function from the code
        const testFunction = new Function(code);

        for (let i = 0; i < iterations; i++) {
            try {
                const startTime = performance.now();
                const result = await testFunction();
                const endTime = performance.now();
                const executionTime = endTime - startTime;

                results.push({
                    iteration: i + 1,
                    time: executionTime,
                    result: result,
                    success: true
                });

                // Update progress
                const progress = ((i + 1) / iterations) * 100;
                if (progressBar) progressBar.style.width = `${progress}%`;
                if (progressText) progressText.textContent = `Running iteration ${i + 1} of ${iterations}...`;

            } catch (error) {
                results.push({
                    iteration: i + 1,
                    time: 0,
                    error: error.message,
                    success: false
                });
            }
        }

        this.displayResults(results);
        this.updateUI(false);
    }

    displayResults(results) {
        const resultsDiv = document.getElementById('results');
        if (!resultsDiv) return;

        const successfulTests = results.filter(r => r.success);
        const failedTests = results.filter(r => !r.success);

        let html = '<h3>Test Results</h3>';

        // Summary
        html += '<div class="result-summary">';
        html += `<p><strong>Total Tests:</strong> ${results.length}</p>`;
        html += `<p><strong>Successful:</strong> ${successfulTests.length}</p>`;
        html += `<p><strong>Failed:</strong> ${failedTests.length}</p>`;

        if (successfulTests.length > 0) {
            const times = successfulTests.map(r => r.time);
            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const minTime = Math.min(...times);
            const maxTime = Math.max(...times);

            html += `<p><strong>Average Time:</strong> ${avgTime.toFixed(4)} ms</p>`;
            html += `<p><strong>Min Time:</strong> ${minTime.toFixed(4)} ms</p>`;
            html += `<p><strong>Max Time:</strong> ${maxTime.toFixed(4)} ms</p>`;
        }
        html += '</div>';

        // Detailed results
        html += '<div class="result-details">';
        html += '<h4>Detailed Results</h4>';
        html += '<table>';
        html += '<thead><tr><th>Iteration</th><th>Time (ms)</th><th>Result</th><th>Status</th></tr></thead>';
        html += '<tbody>';

        results.forEach(result => {
            const status = result.success ? 'Success' : 'Failed';
            const statusClass = result.success ? 'success' : 'error';
            const time = result.success ? result.time.toFixed(4) : 'N/A';
            const resultValue = result.success ? (result.result !== undefined ? JSON.stringify(result.result) : 'undefined') : result.error;

            html += `<tr class="${statusClass}">`;
            html += `<td>${result.iteration}</td>`;
            html += `<td>${time}</td>`;
            html += `<td>${resultValue}</td>`;
            html += `<td>${status}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table></div>';

        resultsDiv.innerHTML = html;
    }

    clearResults() {
        const resultsDiv = document.getElementById('results');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');

        if (resultsDiv) resultsDiv.innerHTML = '';
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '';
    }

    saveTest() {
        const code = document.getElementById('testCode').value;
        const iterations = document.getElementById('iterations').value;
        const testName = prompt('Enter a name for this test:');

        if (!testName || !code.trim()) return;

        const test = {
            name: testName,
            code: code,
            iterations: iterations,
            timestamp: new Date().toISOString()
        };

        const savedTests = JSON.parse(localStorage.getItem('performanceTests') || '[]');
        savedTests.push(test);
        localStorage.setItem('performanceTests', JSON.stringify(savedTests));

        this.loadSavedTests();
        alert('Test saved successfully!');
    }

    loadTest() {
        const savedTests = JSON.parse(localStorage.getItem('performanceTests') || '[]');
        if (savedTests.length === 0) {
            alert('No saved tests found.');
            return;
        }

        const testNames = savedTests.map((test, index) => `${index + 1}. ${test.name}`).join('\n');
        const choice = prompt(`Select a test to load:\n${testNames}`);

        if (!choice) return;

        const index = parseInt(choice.split('.')[0]) - 1;
        if (isNaN(index) || index < 0 || index >= savedTests.length) {
            alert('Invalid selection.');
            return;
        }

        const test = savedTests[index];
        document.getElementById('testCode').value = test.code;
        document.getElementById('iterations').value = test.iterations;
    }

    loadSavedTests() {
        const savedTests = JSON.parse(localStorage.getItem('performanceTests') || '[]');
        const savedTestsDiv = document.getElementById('savedTests');

        if (!savedTestsDiv) return;

        if (savedTests.length === 0) {
            savedTestsDiv.innerHTML = '<p>No saved tests.</p>';
            return;
        }

        let html = '<h4>Saved Tests</h4><ul>';
        savedTests.forEach((test, index) => {
            html += `<li>${test.name} <button onclick="performanceTester.deleteTest(${index})">Delete</button></li>`;
        });
        html += '</ul>';

        savedTestsDiv.innerHTML = html;
    }

    deleteTest(index) {
        const savedTests = JSON.parse(localStorage.getItem('performanceTests') || '[]');
        savedTests.splice(index, 1);
        localStorage.setItem('performanceTests', JSON.stringify(savedTests));
        this.loadSavedTests();
    }

    updateUI(running) {
        const runBtn = document.getElementById('runTest');
        const progressDiv = document.getElementById('progress');

        if (runBtn) {
            runBtn.disabled = running;
            runBtn.textContent = running ? 'Running...' : 'Run Test';
        }

        if (progressDiv) {
            progressDiv.style.display = running ? 'block' : 'none';
        }
    }

    showError(message) {
        const resultsDiv = document.getElementById('results');
        if (resultsDiv) {
            resultsDiv.innerHTML = `<div class="error">${message}</div>`;
        }
    }
}

// Sample test cases
const sampleTests = {
    fibonacci: `// Fibonacci calculation
function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}
return fibonacci(30);`,

    arrayOperations: `// Array operations
const arr = [];
for (let i = 0; i < 10000; i++) {
    arr.push(Math.random());
}
arr.sort((a, b) => a - b);
return arr.length;`,

    stringManipulation: `// String manipulation
let str = '';
for (let i = 0; i < 1000; i++) {
    str += 'Hello World ';
}
return str.length;`,

    objectCreation: `// Object creation and manipulation
const objects = [];
for (let i = 0; i < 1000; i++) {
    objects.push({
        id: i,
        name: 'Object ' + i,
        value: Math.random(),
        nested: {
            prop1: 'value1',
            prop2: 'value2'
        }
    });
}
return objects.length;`
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.performanceTester = new PerformanceTester();

    // Load sample tests
    const sampleSelect = document.getElementById('sampleTests');
    if (sampleSelect) {
        Object.keys(sampleTests).forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
            sampleSelect.appendChild(option);
        });

        sampleSelect.addEventListener('change', (e) => {
            const selected = e.target.value;
            if (selected && sampleTests[selected]) {
                document.getElementById('testCode').value = sampleTests[selected];
            }
        });
    }
});
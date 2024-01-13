function lintCode() {
    const code = document.getElementById('codeInput').value;

    // ESLint configuration
    const eslintConfig = {
        rules: {
            // Add ESLint rules as needed
            // Example:
            'no-alert': 'error',
        },
    };

    // Lint the code
    eslint.lintText(code, eslintConfig).then((results) => {
        const lintResults = document.getElementById('lintResults');
        lintResults.innerHTML = '';

        // Display linting results
        results.forEach((result) => {
            const message = document.createElement('div');
            message.className = result.errorCount > 0 ? 'lint-error' : 'lint-warning';
            message.textContent = `${result.filePath}: ${result.messages[0].message}`;
            lintResults.appendChild(message);
        });
    });
}

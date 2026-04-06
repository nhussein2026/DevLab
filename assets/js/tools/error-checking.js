function lintCode() {
    const code = document.getElementById('codeInput').value;
    const lintResults = document.getElementById('lintResults');

    lintResults.innerHTML = '';

    if (!code.trim()) {
        lintResults.innerHTML = '<div class="lint-info">Please enter some code to lint.</div>';
        return;
    }

    const errors = [];

    // Basic HTML validation
    if (code.includes('<html') && !code.includes('</html>')) {
        errors.push('Missing closing </html> tag');
    }

    // Check for unclosed tags
    const openTags = code.match(/<[^\/][^>]*>/g) || [];
    const closeTags = code.match(/<\/[^>]+>/g) || [];

    if (openTags.length !== closeTags.length) {
        errors.push('Unmatched HTML tags detected');
    }

    // Basic JavaScript checks
    if (code.includes('function') && !code.includes('}')) {
        errors.push('Possible unclosed function');
    }

    if (code.includes('if') && !code.includes(')')) {
        errors.push('Possible unclosed if statement');
    }

    // CSS checks
    if (code.includes('{') && !code.includes('}')) {
        errors.push('Possible unclosed CSS rule');
    }

    // Display results
    if (errors.length === 0) {
        lintResults.innerHTML = '<div class="lint-success">✅ No obvious errors found!</div>';
    } else {
        errors.forEach(error => {
            const div = document.createElement('div');
            div.className = 'lint-error';
            div.textContent = error;
            lintResults.appendChild(div);
        });
    }
}

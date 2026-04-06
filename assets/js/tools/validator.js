function showValidator(type) {
    // Hide all validator contents
    const contents = document.querySelectorAll('.validator-content');
    contents.forEach(content => content.classList.remove('active'));

    // Remove active class from all tabs
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => tab.classList.remove('active'));

    // Show selected validator
    document.getElementById(type + '-validator').classList.add('active');
    event.target.classList.add('active');

    // Clear results
    document.getElementById('validationResults').innerHTML = '';
}

function validateHTML() {
    const code = document.getElementById('htmlCode').value;
    const resultsDiv = document.getElementById('validationResults');

    resultsDiv.innerHTML = '<div class="validating">Validating HTML...</div>';

    setTimeout(() => {
        const errors = [];

        // Basic HTML validation
        if (!code.includes('<!DOCTYPE html>') && !code.includes('<!doctype html>')) {
            errors.push('Missing DOCTYPE declaration');
        }

        if (!code.includes('<html') || !code.includes('</html>')) {
            errors.push('Missing html tags');
        }

        if (!code.includes('<head>') || !code.includes('</head>')) {
            errors.push('Missing head tags');
        }

        if (!code.includes('<body>') || !code.includes('</body>')) {
            errors.push('Missing body tags');
        }

        // Check for unclosed tags
        const openTags = (code.match(/<[^\/][^>]*>/g) || []).length;
        const closeTags = (code.match(/<\/[^>]+>/g) || []).length;

        if (openTags !== closeTags) {
            errors.push('Unmatched HTML tags');
        }

        displayValidationResults(errors, 'HTML');
    }, 1000);
}

function validateCSS() {
    const code = document.getElementById('cssCode').value;
    const resultsDiv = document.getElementById('validationResults');

    resultsDiv.innerHTML = '<div class="validating">Validating CSS...</div>';

    setTimeout(() => {
        const errors = [];

        // Basic CSS validation
        if (code.includes('{') && !code.includes('}')) {
            errors.push('Unclosed CSS rule');
        }

        if (code.includes('}') && !code.includes('{')) {
            errors.push('Missing opening brace');
        }

        // Check for missing semicolons (basic check)
        const rules = code.split('}');
        rules.forEach(rule => {
            if (rule.includes('{') && rule.includes(':') && !rule.includes(';')) {
                errors.push('Missing semicolon in CSS rule');
            }
        });

        displayValidationResults(errors, 'CSS');
    }, 1000);
}

function validateJS() {
    const code = document.getElementById('jsCode').value;
    const resultsDiv = document.getElementById('validationResults');

    resultsDiv.innerHTML = '<div class="validating">Validating JavaScript...</div>';

    setTimeout(() => {
        const errors = [];

        try {
            // Try to parse the code
            new Function(code);
        } catch (e) {
            errors.push('Syntax Error: ' + e.message);
        }

        // Basic checks
        if (code.includes('function') && !code.includes(')')) {
            errors.push('Unclosed function declaration');
        }

        if (code.includes('if') && !code.includes(')')) {
            errors.push('Unclosed if statement');
        }

        if (code.includes('for') && !code.includes(')')) {
            errors.push('Unclosed for loop');
        }

        displayValidationResults(errors, 'JavaScript');
    }, 1000);
}

function displayValidationResults(errors, type) {
    const resultsDiv = document.getElementById('validationResults');

    if (errors.length === 0) {
        resultsDiv.innerHTML = `<div class="validation-success">✅ ${type} code is valid!</div>`;
    } else {
        let html = `<div class="validation-error">❌ ${type} validation errors found:</div><ul>`;
        errors.forEach(error => {
            html += `<li>${error}</li>`;
        });
        html += '</ul>';
        resultsDiv.innerHTML = html;
    }
}

// Initialize with HTML validator active
document.addEventListener('DOMContentLoaded', function() {
    showValidator('html');
});
function showMinifier(mode) {
    const buttons = document.querySelectorAll('.minifier-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Store the current mode
    window.currentMode = mode;
}

function processCode() {
    const inputCode = document.getElementById('inputCode').value;
    const language = document.getElementById('languageSelect').value;
    const outputTextarea = document.getElementById('outputCode');
    const statsDiv = document.getElementById('stats');

    if (!inputCode.trim()) {
        alert('Please enter some code to process');
        return;
    }

    let output = '';
    let stats = {};

    if (window.currentMode === 'minify') {
        output = minifyCode(inputCode, language);
        stats = {
            originalSize: inputCode.length,
            minifiedSize: output.length,
            reduction: ((inputCode.length - output.length) / inputCode.length * 100).toFixed(1)
        };
    } else {
        output = beautifyCode(inputCode, language);
        stats = {
            originalSize: inputCode.length,
            beautifiedSize: output.length
        };
    }

    outputTextarea.value = output;

    // Display stats
    if (window.currentMode === 'minify') {
        statsDiv.innerHTML = `
            <div class="stat-item">Original Size: ${stats.originalSize} characters</div>
            <div class="stat-item">Minified Size: ${stats.minifiedSize} characters</div>
            <div class="stat-item">Reduction: ${stats.reduction}%</div>
        `;
    } else {
        statsDiv.innerHTML = `
            <div class="stat-item">Original Size: ${stats.originalSize} characters</div>
            <div class="stat-item">Beautified Size: ${stats.beautifiedSize} characters</div>
        `;
    }
}

function minifyCode(code, language) {
    let minified = code;

    // Remove comments
    if (language === 'js') {
        minified = minified.replace(/\/\*[\s\S]*?\*\//g, '');
        minified = minified.replace(/\/\/.*$/gm, '');
    } else if (language === 'css') {
        minified = minified.replace(/\/\*[\s\S]*?\*\//g, '');
    }

    // Remove extra whitespace
    minified = minified.replace(/\s+/g, ' ');
    minified = minified.replace(/\s*([{}:;,()])\s*/g, '$1');

    // Remove trailing/leading whitespace
    minified = minified.trim();

    return minified;
}

function beautifyCode(code, language) {
    let beautified = code;

    if (language === 'js') {
        // Basic JavaScript beautification
        beautified = beautified.replace(/;/g, ';\n');
        beautified = beautified.replace(/{/g, ' {\n    ');
        beautified = beautified.replace(/}/g, '\n}\n');
        beautified = beautified.replace(/,/g, ',\n    ');
    } else if (language === 'css') {
        // Basic CSS beautification
        beautified = beautified.replace(/{/g, ' {\n    ');
        beautified = beautified.replace(/}/g, '\n}\n\n');
        beautified = beautified.replace(/;/g, ';\n    ');
    } else if (language === 'html') {
        // Basic HTML beautification
        beautified = beautified.replace(/></g, '>\n<');
        beautified = beautified.replace(/<([^/])/g, '\n<$1');
    }

    return beautified;
}

function copyToClipboard() {
    const outputTextarea = document.getElementById('outputCode');
    outputTextarea.select();
    document.execCommand('copy');
    alert('Code copied to clipboard!');
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    window.currentMode = 'minify';
});
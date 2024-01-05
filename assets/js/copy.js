// Function to copy code block content to clipboard
function copyCode() {
    copyToClipboard(document.getElementById('code-block').innerText);
}

function copyLivePreviewCode() {
    copyToClipboard(document.getElementById('live-preview-code').innerText);
}

function copyCodeSnippetsCode() {
    copyToClipboard(document.getElementById('code-snippets-code').innerText);
}

function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    alert('Code copied to clipboard!');
}

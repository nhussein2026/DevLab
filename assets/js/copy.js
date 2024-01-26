// Function to copy the content of the code block to the clipboard
function copyCode() {
    // Calls the copyToClipboard function with the inner text of the element with id 'code-block'
    copyToClipboard(document.getElementById('code-block').innerText);
}

//to copy css code
function copyCssCode() {
    copyToClipboard(document.getElementById('generatedCode').innerText);
}

//copy html code
function copyHtmlCode() {
    copyToClipboard(document.getElementById('generatedHtmlCode').innerText);
}

// Function to copy the content of the live preview code to the clipboard
function copyLivePreviewCode() {
    // Calls the copyToClipboard function with the inner text of the element with id 'live-preview-code'
    copyToClipboard(document.getElementById('live-preview-code').innerText);
}

// Function to copy the content of the code snippets code to the clipboard
function copyCodeSnippetsCode() {
    // Calls the copyToClipboard function with the inner text of the element with id 'code-snippets-code'
    copyToClipboard(document.getElementById('code-snippets-code').innerText);
}

// Function to copy the given text to the clipboard
function copyToClipboard(text) {
    // Creates a new textarea element
    const textarea = document.createElement('textarea');
    // Sets the value of the textarea to the text that needs to be copied
    textarea.value = text;
    // Appends the textarea to the document body
    document.body.appendChild(textarea);
    // Selects the content of the textarea
    textarea.select();
    // Executes the 'copy' command to copy the text to the clipboard
    document.execCommand('copy');
    // Removes the textarea from the document body
    document.body.removeChild(textarea);
    // Displays an alert to the user indicating that the code has been copied
    alert('Code copied to clipboard!');
}

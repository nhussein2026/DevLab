// script.js

function updateColor() {
    const colorInput = document.getElementById('colorInput');
    const colorDisplay = document.getElementById('colorDisplay');

    // Get the selected color value
    const selectedColor = colorInput.value;

    // Update the color display
    colorDisplay.textContent = `Selected Color: ${selectedColor}`;
    colorDisplay.style.color = selectedColor;
}

function convertText() {
    const textInput = document.getElementById('textInput');
    const encodedText = document.getElementById('encodedText');

    // Get the text input value
    const inputText = textInput.value;

    // Convert text to HTML entities
    const encodedHTML = htmlEntities(inputText);

    // Display the encoded text
    encodedText.textContent = `Encoded Text: ${encodedHTML}`;
}

function htmlEntities(str) {
    return str.replace(/[\u00A0-\u9999<>\&]/gim, function(i) {
        return '&#' + i.charCodeAt(0) + ';';
    });
}

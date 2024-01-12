function formatCode() {
    const codeInput = document.getElementById('codeInput');
    
    // Use Prettier to format the code
    const formattedCode = prettier.format(codeInput.value, { parser: 'html' });

    // Update the textarea with the formatted code
    codeInput.value = formattedCode;
}

function generateSnippet() {
    // Get the user's input code
    const userInput = document.getElementById('codeInput').value;

    // Use html2canvas to convert the styled code to an image
    html2canvas(codeInput).then(canvas => {
        // Convert the canvas to a data URL
        const imageUrl = canvas.toDataURL();

        // Display the generated code snippet image
        const snippetOutput = document.getElementById('snippetOutput');
        snippetOutput.innerHTML = `<img src="${imageUrl}" alt="Code Snippet">`;
        snippetOutput.style.display = 'block';
    });
}
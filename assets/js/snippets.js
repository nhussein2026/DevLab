function generateSnippet() {
    // Get the user's input code
    const userInput = document.getElementById('codeInput').value;

    // Use html2canvas to convert the code to an image
    html2canvas(document.getElementById('codeInput')).then(canvas => {
        // Convert the canvas to a data URL
        const imageUrl = canvas.toDataURL();

        // Display the generated code snippet image
        const snippetOutput = document.getElementById('snippetOutput');
        snippetOutput.innerHTML = `<img src="${imageUrl}" alt="Code Snippet">`;
        snippetOutput.style.display = 'block';
    });
}
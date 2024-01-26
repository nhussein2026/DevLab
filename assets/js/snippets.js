// Use addEventListener for better separation of concerns
document.getElementById('formatCodeButton').addEventListener('click', formatCode);

// error handling
function formatCode() {
    try {
        const codeInput = document.getElementById('codeInput');
        const formattedCode = prettier.format(codeInput.value, { parser: 'html' });
        codeInput.value = formattedCode;
    } catch (error) {
        console.error('Error formatting code:', error);
    }
}

// Use addEventListener for better separation of concerns
document.getElementById('formatCodeButton').addEventListener('click', formatCode);

function generateSnippet() {
    // Get the user's input code and snippet title
    const codeInput = document.getElementById('codeInput').value;
    const snippetTitle = document.getElementById('snippetTitle').value;

    // Create HTML structure for the snippet
    const snippetHTML = `
        <div class="snippet-input">
            <div class="live-preview-card">
                <div class="tools-parent">
                    <div class="tools-place">
                        <div class="circle">
                            <span class="red box"></span>
                        </div>
                        <div class="circle">
                            <span class="yellow box"></span>
                        </div>
                        <div class="circle">
                            <span class="green box"></span>
                        </div>
                    </div>
                    <div class="title">
                        <h2>${snippetTitle}</h2>
                    </div>
                </div>
                <div class="content">
                    <p>
                        <code>${codeInput}</code>
                    </p>
                </div>
            </div>
        </div>
    `;

    // Use html2canvas to convert the styled code to an image
    html2canvas(document.getElementById('code-snippet-generator'), {
        width: document.getElementById('snippet-input').scrollWidth,
        height: document.getElementById('snippet-input').scrollHeight,
    }).then(canvas => {
        // Convert the canvas to a data URL
        const imageUrl = canvas.toDataURL();

        // Display the generated code snippet image
        const snippetImage = document.getElementById('snippetImage');
        snippetImage.src = imageUrl;

        const snippetOutput = document.getElementById('snippetOutput');
        snippetOutput.style.display = 'block';
    });
}

// download snippet image
function downloadImage() {
    const snippetImage = document.getElementById('snippetImage');
    const imageURL = snippetImage.src;

    const link = document.createElement('a');
    link.href = imageURL;
    link.download = 'devLab-code-snippet.png'; // Adjust filename as needed
    link.click();
}


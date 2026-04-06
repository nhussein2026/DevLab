// Use addEventListener for better separation of concerns
document.getElementById('downloadButton').addEventListener('click', generateSnippet);

// Function to format code using Prettier
function formatCode() {
    try {
        const codeInput = document.getElementById('codeInput');
        const formattedCode = prettier.format(codeInput.value, { parser: 'html' });
        codeInput.value = formattedCode;
    } catch (error) {
        console.error('Error formatting code:', error);
    }
}

function generateSnippet() {
    formatCode();
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

    // Append the snippetHTML to a temporary container to measure its height
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = snippetHTML;
    document.body.appendChild(tempContainer);

    // Get the height of the generated content
    const snippetHeight = tempContainer.offsetHeight;

    // Remove the temporary container
    document.body.removeChild(tempContainer);

    // Set the height of the #snippet-input container
    const snippetInputContainer = document.getElementById('snippet-input');
    snippetInputContainer.style.height = `${snippetHeight}px`;


    // Use html2canvas to convert the styled code to an image
    html2canvas(snippetInputContainer).then(canvas => {
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


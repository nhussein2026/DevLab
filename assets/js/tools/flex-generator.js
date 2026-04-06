document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('generateDivsBtn').addEventListener('click', generateDivs);

    // Event listeners for immediate updates as the user changes the options
    document.getElementById('flexDirection').addEventListener('change', function () {
        updateFlexboxStyles();
        generateCode();
    });
    document.getElementById('justifyContent').addEventListener('change', function () {
        updateFlexboxStyles();
        generateCode();
    });
    document.getElementById('alignItems').addEventListener('change', function () {
        updateFlexboxStyles();
        generateCode();
    });

    function generateDivs() {
        const numOfItems = parseInt(document.getElementById('numOfItems').value, 10);
        const flexContainer = document.getElementById('flexContainer');

        // Clear previous content
        flexContainer.innerHTML = '';

        // Generate the specified number of divs
        for (let i = 1; i <= numOfItems; i++) {
            const div = document.createElement('div');
            div.className = 'flex-item';
            div.innerText = `Item ${i}`;
            flexContainer.appendChild(div);
        }

        // Apply flex settings to each generated div
        updateFlexboxStyles();

        // Generate the CSS code
        generateCode();
    }

    function generateCode() {
        const flexDirection = document.getElementById('flexDirection').value;
        const justifyContent = document.getElementById('justifyContent').value;
        const alignItems = document.getElementById('alignItems').value;

        // Generate the CSS code
        const cssCode = `
            .flex-container {
                display: flex;
                flex-wrap: wrap;
                flex-direction: ${flexDirection};
                justify-content: ${justifyContent};
                align-items: ${alignItems};
            }

            .flex-item {
                /* Add individual item styles here */
                margin: 5px;
                padding: 10px;
                border: 1px solid #06e8f9;
                order: 0; /* Initial order */
            }
        `;
        // Generate the HTML structure representation
        const numOfItems = parseInt(document.getElementById('numOfItems').value, 10);
        const htmlStructure = `
            <div class="flex-container">
                ${Array.from({ length: numOfItems }, (_, i) => `
                <div class="flex-item">Item ${i + 1}</div>`).join('\n')}
            </div>
        `;

        // Display the generated css code
        document.getElementById('generatedCode').innerText = cssCode;

      // Display the generated html code
      document.getElementById('generatedHtmlCode').innerText = htmlStructure;
  
    }

    function updateFlexboxStyles() {
        const flexDirection = document.getElementById('flexDirection').value;
        const justifyContent = document.getElementById('justifyContent').value;
        const alignItems = document.getElementById('alignItems').value;
    
        const flexContainer = document.getElementById('flexContainer');
    
        flexContainer.style.flexDirection = flexDirection;
        flexContainer.style.justifyContent = justifyContent;
        flexContainer.style.alignItems = alignItems;
    }
});

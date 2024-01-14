document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('generateDivsBtn').addEventListener('click', generateDivs);
    document.getElementById('generateCodeBtn').addEventListener('click', generateCode);

    function generateDivs() {
        const numOfItems = parseInt(document.getElementById('numOfItems').value, 10);
        const flexContainer = document.getElementById('flexContainer');
        const generatedCode = document.getElementById('generatedCode');

        // Clear previous content
        flexContainer.innerHTML = '';
        generatedCode.innerText = '';

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

        // Apply flex settings to each generated div
        updateFlexboxStyles();

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
                border: 1px solid #000;
                order: 0; /* Initial order */
            }
        `;

        // Display the generated code
        document.getElementById('generatedCode').innerText = cssCode;
    }

    function updateFlexboxStyles() {
        const flexDirection = document.getElementById('flexDirection').value;
        const justifyContent = document.getElementById('justifyContent').value;
        const alignItems = document.getElementById('alignItems').value;
    
        const flexContainer = document.getElementById('flexContainer');
        const flexItems = document.getElementsByClassName('flex-item');
    
        flexContainer.style.flexDirection = flexDirection;
        flexContainer.style.justifyContent = justifyContent;
        flexContainer.style.alignItems = alignItems;
    
        // Apply order based on position (if needed)
        for (let i = 0; i < flexItems.length; i++) {
            flexItems[i].style.order = i;
        }
    }
    

    // Event listeners to trigger updates as the user changes the options
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
});

function loadApiDocumentation() {
    const apiEndpointInput = document.getElementById('apiEndpoint');
    const documentationContainer = document.getElementById('documentationContainer');

    // Get user-entered API endpoint
    const apiEndpoint = apiEndpointInput.value.trim();

    // Validate if the input is not empty
    if (!apiEndpoint) {
        alert('Please enter a valid API endpoint.');
        return;
    }

    // Fetch API documentation
    fetch(apiEndpoint)
        .then(response => response.json())  // Assuming the API returns JSON, adjust as needed
        .then(data => {
            // Display the documentation content
            documentationContainer.innerHTML = JSON.stringify(data, null, 2); // Pretty print JSON
        })
        .catch(error => {
            // Handle errors
            console.error('Error fetching API documentation:', error);
            documentationContainer.innerHTML = 'Failed to load API documentation.';
        });
}

// Initial load when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Bind the function to the button click event
    document.getElementById('loadApiButton').addEventListener('click', loadApiDocumentation);
});
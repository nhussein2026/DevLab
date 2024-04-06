// const visitorCountElement = document.getElementById('visitorCount');

// fetch('assets\json\visitor-count.json')
//     .then(response => response.json())
//     .then(data => {
//         visitorCountElement.textContent = data.count;
//     })
//     .catch(error => {
//         console.error('Error fetching visitor count:', error);
//         // Optionally display an error message to the user
//     });


    
// Function to fetch visitor count and update it
function updateVisitorCount() {
    // Fetch the visitor count JSON file
    fetch('assets\json\visitor-count.json')
        .then(response => response.json())
        .then(data => {
            // Increment the count
            data.count++;

            // Update the counter element
            counterElement.textContent = 'Visitors: ' + data.count;

            // Save the updated count back to the JSON file
            fetch('visitor_count.json', {
                method: 'PUT',
                body: JSON.stringify(data),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        })
        .catch(error => console.error('Error:', error));
}

// Call the function to update the count when the page loads
updateVisitorCount();

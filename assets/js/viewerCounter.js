// fetch('visitor-count.json')
// .then(response => response.json())
// .then(data => {
//   document.getElementById('visitorCount').textContent = data.count;
// });

const visitorCountElement = document.getElementById('visitorCount');

fetch('assets\json\visitor-count.json')
    .then(response => response.json())
    .then(data => {
        visitorCountElement.textContent = data.count;
    })
    .catch(error => {
        console.error('Error fetching visitor count:', error);
        // Optionally display an error message to the user
    });
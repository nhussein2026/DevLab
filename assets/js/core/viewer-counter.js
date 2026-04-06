// Function to fetch visitor count and display it
function updateVisitorCount() {
  // Fetch the visitor count JSON file
  fetch("assets/json/visitor-count.json")
    .then((response) => response.json())
    .then((data) => {
      // Update the counter element if it exists
      const counterElement = document.getElementById("visitorCount");
      if (counterElement) {
        counterElement.textContent = "Visitors: " + data.count;
      }
    })
    .catch((error) => console.error("Error fetching visitor count:", error));
}

// Call the function to update the count when the page loads
updateVisitorCount();

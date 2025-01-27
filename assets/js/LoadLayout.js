document.addEventListener("DOMContentLoaded", () => {
  // Load navbar.html
  fetch("./components/navbar.html") // Correct path to navbar.html
    .then((response) => {
      if (!response.ok) throw new Error("Failed to fetch navbar");
      return response.text();
    })
    .then((data) => {
      document.querySelector("header").innerHTML = data; // Ensure <header> exists in your HTML
    })
    .catch((err) => console.error("Error loading navbar:", err));

  // Load footer.html
  fetch("./components/footer.html") // Correct path to footer.html
    .then((response) => {
      if (!response.ok) throw new Error("Failed to fetch footer");
      return response.text();
    })
    .then((data) => {
      document.querySelector("footer").innerHTML = data; // Ensure <footer> exists in your HTML
    })
    .catch((err) => console.error("Error loading footer:", err));
});

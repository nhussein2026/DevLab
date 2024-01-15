// Example: Open tool links in a new tab dynamically
const toolLinks = document.querySelectorAll('.tool');
toolLinks.forEach(link => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    window.open(link.href, '_blank');
  });
});

// Example: Fetch PageSpeed Insights data (advanced)
// Note: This requires handling API calls and potential CORS issues
const fetchPageSpeedData = async (url) => {
  const response = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${url}`);
  const data = await response.json();
  // Process and display PageSpeed Insights data here
};

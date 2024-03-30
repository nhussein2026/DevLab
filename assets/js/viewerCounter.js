fetch('visitor-count.json')
.then(response => response.json())
.then(data => {
  document.getElementById('visitorCount').textContent = data.count;
});
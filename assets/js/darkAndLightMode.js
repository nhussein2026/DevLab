const darkModeToggle = document.getElementById('darkmode-toggle');
const body = document.body;

darkModeToggle.addEventListener('change', () => {
    body.classList.toggle('dark-mode', darkModeToggle.checked);

    if (darkModeToggle.checked) {
        // Dark mode
        document.documentElement.style.setProperty('--bg-light-color', '#111f41');
        document.documentElement.style.setProperty('--dark-font-color', '#ffffff');
        document.documentElement.style.setProperty('--light-font-color', '#000');
        document.documentElement.style.setProperty('--bg-section-light', 'rgb(7 16 45)');
    } else {
        // Light mode
        document.documentElement.style.setProperty('--bg-light-color', '#f9f9f9');
        document.documentElement.style.setProperty('--dark-font-color', '#6bd6ea');
        document.documentElement.style.setProperty('--light-font-color', '#000');
        document.documentElement.style.setProperty('--bg-section-light', '#ffffff');
    }
});


// Check if user has a preference stored
const storedDarkMode = localStorage.getItem('darkMode');

// If a preference exists, apply it
if (storedDarkMode) {
    body.classList.toggle('dark-mode', storedDarkMode === 'true');
    darkModeToggle.checked = storedDarkMode === 'true';
}

// Update preference on toggle
darkModeToggle.addEventListener('change', () => {
    const darkModeEnabled = darkModeToggle.checked;
    body.classList.toggle('dark-mode', darkModeEnabled);
    localStorage.setItem('darkMode', darkModeEnabled);
});

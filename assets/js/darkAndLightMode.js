const darkModeToggle = document.querySelector('#dark-mode-toggle');
const body = document.body;
const dark = document.querySelectorAll('body, .navbar, .nav-link, .contribution-section, .navigationLink, .hero-section, footer, .cta-button, .doc-section, #code-editor, #live-preview, #code-snippets, #contributions, code, pre, #code-block, #author, .tool-title, .line-span, .terminal_toolbar, .loadApiButton, .api-input, .flexbox-preview, .flex-item, .flexbox-generator, .user-inputs ');

// Function to apply dark mode based on user preference
function applyDarkModePreference() {
    const storedDarkMode = localStorage.getItem('darkMode');

    if (storedDarkMode) {
        const darkModeEnabled = storedDarkMode === 'true';

        // Apply dark mode to body
        body.classList.toggle('dark-mode', darkModeEnabled);

        // Apply dark mode to all elements in the list
        dark.forEach(element => {
            element.classList.toggle('dark-mode', darkModeEnabled);
        });

        // Update the dark mode toggle state
        darkModeToggle.checked = darkModeEnabled;
    }
}

// Function to toggle dark mode on elements
function toggleDarkModeOnElements(enabled) {
    dark.forEach(element => {
        element.classList.toggle('dark-mode', enabled);
    });
}

// Toggle dark mode on button change
darkModeToggle.addEventListener('change', () => {
    toggleDarkModeOnElements(darkModeToggle.checked);

    // Save dark mode preference to local storage
    localStorage.setItem('darkMode', darkModeToggle.checked);
});

// Check and apply dark mode preference on page load
applyDarkModePreference();

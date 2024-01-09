// const darkModeToggle = document.getElementById('darkmode-toggle');
// const body = document.body;
// const sectionsToToggleDarkMode = document.querySelectorAll('.dark-mode-toggle-section');
// const navbar = document.querySelector('.navbar');
// const hero = document.querySelector('.hero');
// // Add more elements as needed

// darkModeToggle.addEventListener('change', () => {
//     body.classList.toggle('dark-mode', darkModeToggle.checked);

//     sectionsToToggleDarkMode.forEach(section => {
//         section.classList.toggle('dark-mode', darkModeToggle.checked);
//     });


const darkModeToggle = document.querySelector('#darkmode-toggle');

darkModeToggle.addEventListener('change', () => {
    const bodyAndNavbar = document.querySelectorAll('body, .navbar, .nav-link, .contribution-section, .navigationLink, .hero-section, footer, .cta-button');

    if (darkModeToggle.checked) {
        bodyAndNavbar.forEach(element => {
            element.classList.add('dark-mode');
        });
    } else {
        bodyAndNavbar.forEach(element => {
            element.classList.remove('dark-mode');
        });
    }
});





    // Toggle dark mode for specific elements like navbar and hero
    // navbar.classList.toggle('dark-mode', darkModeToggle.checked);
    // hero.classList.toggle('dark-mode', darkModeToggle.checked);
    // Add more toggles for other elements as needed
// });




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

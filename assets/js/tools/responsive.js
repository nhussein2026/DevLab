function setDevice(device) {
    const frame = document.getElementById('responsiveFrame');
    const buttons = document.querySelectorAll('.device-btn');

    // Remove active class from all buttons
    buttons.forEach(btn => btn.classList.remove('active'));

    // Add active class to clicked button
    event.target.classList.add('active');

    // Set iframe dimensions based on device
    switch(device) {
        case 'desktop':
            frame.style.width = '100%';
            frame.style.maxWidth = '1920px';
            frame.style.height = '600px';
            break;
        case 'laptop':
            frame.style.width = '100%';
            frame.style.maxWidth = '1366px';
            frame.style.height = '600px';
            break;
        case 'tablet':
            frame.style.width = '100%';
            frame.style.maxWidth = '768px';
            frame.style.height = '600px';
            break;
        case 'mobile':
            frame.style.width = '100%';
            frame.style.maxWidth = '375px';
            frame.style.height = '600px';
            break;
    }
}

function loadWebsite() {
    const url = document.getElementById('testUrl').value;
    const frame = document.getElementById('responsiveFrame');

    if (url) {
        frame.src = url;
    } else {
        alert('Please enter a valid URL');
    }
}

// Initialize with desktop view
document.addEventListener('DOMContentLoaded', function() {
    setDevice('desktop');
});
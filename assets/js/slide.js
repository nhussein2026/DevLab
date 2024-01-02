let currentIndex = 0;
const totalSlides = document.querySelectorAll('.slide').length;
const slider = document.querySelector('.slider');
const dotsContainer = document.querySelector('.dots-container');

function showSlide(index) {
    const slideWidth = document.querySelector('.slide').clientWidth;
    slider.style.transform = `translateX(${-index * slideWidth}px)`
}

function nextSlide() {
    currentIndex = (currentIndex +1)% totalSlides;
    updateSlider();
}

function prevSlide() {
    currentIndex = (currentIndex - 1 + totalSlides) % totalSlides;
    updateSlider();
}

function goToSlide(index) {
    currentIndex = index;
    updateSlider();
}

function createDots() {
    for(let i = 0; i < totalSlides; i++){
        const dot = document.createElement('span');
        dot.classList.add('dot');
        dot.addEventListener('click', () => goToSlide(i))
        dotsContainer.appendChild(dot);
    }
}

function updateDots() {
    const dots = document.querySelectorAll('.dot');
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentIndex)
    })
}

function updateSlider() {
    showSlide(currentIndex);
    updateDots();
}

createDots();
updateDots
// Automatic slide change every 3 seconds
setInterval(nextSlide, 3000);
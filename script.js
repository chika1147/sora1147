const playButton = document.getElementById('playButton');
const audio = document.getElementById('lofiAudio');
const sliderTrack = document.querySelector('.slider__track');
const sliderControls = document.querySelectorAll('.slider__control');

if (playButton && audio) {
  playButton.addEventListener('click', async () => {
    playButton.classList.add('pulse');
    setTimeout(() => playButton.classList.remove('pulse'), 200);

    try {
      if (audio.paused) {
        await audio.play();
        playButton.textContent = '⏸ Pause';
        playButton.classList.add('is-playing');
        playButton.setAttribute('aria-pressed', 'true');
      } else {
        audio.pause();
        playButton.textContent = '▶︎ Play';
        playButton.classList.remove('is-playing');
        playButton.setAttribute('aria-pressed', 'false');
      }
    } catch (error) {
      console.error('Audio playback failed', error);
    }
  });
}

sliderControls.forEach((button) => {
  button.addEventListener('click', () => {
    if (!sliderTrack) return;
    const direction = button.dataset.direction === 'next' ? 1 : -1;
    const shift = sliderTrack.clientWidth * 0.75 * direction;
    sliderTrack.scrollBy({ left: shift, behavior: 'smooth' });
  });
});

if (sliderTrack) {
  let isDown = false;
  let startX;
  let scrollLeft;

  sliderTrack.addEventListener('pointerdown', (e) => {
    isDown = true;
    sliderTrack.setPointerCapture(e.pointerId);
    startX = e.clientX;
    scrollLeft = sliderTrack.scrollLeft;
  });

  sliderTrack.addEventListener('pointermove', (e) => {
    if (!isDown) return;
    const walk = (e.clientX - startX) * -1;
    sliderTrack.scrollLeft = scrollLeft + walk;
  });

  sliderTrack.addEventListener('pointerup', () => {
    isDown = false;
  });

  sliderTrack.addEventListener('pointercancel', () => {
    isDown = false;
  });
}

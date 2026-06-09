document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('replayBtn');
    const animBoxes = document.querySelectorAll('.anim-box');

    const playAnimations = () => {
        // Remove play class to reset animations
        animBoxes.forEach(box => {
            box.classList.remove('play');
        });

        // Trigger reflow to restart animations
        void document.body.offsetWidth;

        // Add play class to start animations
        animBoxes.forEach(box => {
            box.classList.add('play');
        });
    };

    // Play animations automatically 500ms after load
    setTimeout(playAnimations, 500);

    // Play on button click
    playBtn.addEventListener('click', playAnimations);
});

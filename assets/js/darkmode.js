
(function() {
  const toggleButton = document.getElementById('dark-mode-toggle');
  const icon = toggleButton ? toggleButton.querySelector('.fa') : null;

  const setIcon = (isDarkMode) => {
    if (icon) {
      if (isDarkMode) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
      } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
      }
    }
  };

  const toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('dark-mode', isDarkMode ? 'enabled' : 'disabled');
    setIcon(isDarkMode);
  };

  // Check for saved preference and apply on load
  const savedMode = localStorage.getItem('dark-mode');
  let initialDarkMode = false;
  if (savedMode === 'disabled') {
    // User explicitly chose light mode, do nothing
  } else { // savedMode is 'enabled' or null (no preference saved)
    document.body.classList.add('dark-mode');
    initialDarkMode = true;
  }

  // Set initial icon state
  document.addEventListener('DOMContentLoaded', () => {
    if (toggleButton) {
      setIcon(initialDarkMode);
      toggleButton.addEventListener('click', toggleDarkMode);
    }
  });
})();


(function() {
  const toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('dark-mode', isDarkMode ? 'enabled' : 'disabled');
  };

  // Check for saved preference
  const savedMode = localStorage.getItem('dark-mode');
  if (savedMode === 'enabled') {
    document.body.classList.add('dark-mode');
  } else if (savedMode === null && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    // If no preference saved, check system preference
    document.body.classList.add('dark-mode');
  }

  // Add toggle button functionality (assuming a button with id 'dark-mode-toggle' exists)
  document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('dark-mode-toggle');
    if (toggleButton) {
      toggleButton.addEventListener('click', toggleDarkMode);
    }
  });
})();

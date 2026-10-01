// Dark mode. Adds a toggle to the navbar, remembers the choice in
// localStorage, and defaults to dark when nothing has been chosen.
(function () {
  var saved = null;
  try { saved = localStorage.getItem('dark-mode'); } catch (e) { saved = null; }
  var dark = saved !== 'disabled';
  if (dark) document.body.classList.add('dark-mode');

  function setIcon(icon, isDark) {
    icon.classList.toggle('fa-sun', isDark);
    icon.classList.toggle('fa-moon', !isDark);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var menu = document.querySelector('#main-navbar .navbar-nav');
    if (!menu) return;
    var item = document.createElement('li');
    item.className = 'nav-item';
    var button = document.createElement('button');
    button.className = 'nav-link';
    button.id = 'dark-mode-toggle';
    button.title = 'Toggle Dark Mode';
    var icon = document.createElement('span');
    icon.className = 'fa fa-moon';
    button.appendChild(icon);
    item.appendChild(button);
    menu.appendChild(item);
    setIcon(icon, dark);
    button.addEventListener('click', function () {
      dark = document.body.classList.toggle('dark-mode');
      try { localStorage.setItem('dark-mode', dark ? 'enabled' : 'disabled'); } catch (e) { /* private mode */ }
      setIcon(icon, dark);
    });
  });
})();

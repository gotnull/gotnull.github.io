// Colour scheme toggle, search, the table of contents in posts, and the
// gallery lightbox. No framework; everything is guarded so a missing
// element never throws.
(function () {
  'use strict';

  var root = document.documentElement;

  function byId(id) { return document.getElementById(id); }

  // Scheme. Dark unless chosen otherwise; the choice is remembered.
  var toggle = byId('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var light = root.getAttribute('data-theme') === 'light';
      var next = light ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
    });
  }

  // Search. The corpus is /search.json, built by Jekyll.
  var overlay = byId('search-overlay');
  var input = byId('search-input');
  var results = byId('search-results');
  var corpus = null;

  function openSearch() {
    if (!overlay || !input) return;
    overlay.hidden = false;
    input.value = '';
    renderResults([]);
    input.focus();
    if (corpus === null) {
      corpus = [];
      fetch(root.getAttribute('data-baseurl') || '/search.json').then(function (r) { return r.json(); })
        .then(function (data) { corpus = data; search(input.value); })
        .catch(function () { corpus = []; });
    }
  }

  function closeSearch() {
    if (overlay) overlay.hidden = true;
  }

  function search(query) {
    var q = query.trim().toLowerCase();
    if (!q || !corpus) { renderResults([]); return; }
    var terms = q.split(/\s+/);
    var hits = corpus.filter(function (post) {
      var hay = (post.title + ' ' + post.subtitle + ' ' + post.tags).toLowerCase();
      return terms.every(function (t) { return hay.indexOf(t) !== -1; });
    });
    renderResults(hits.slice(0, 12));
  }

  function renderResults(items) {
    if (!results) return;
    results.textContent = '';
    items.forEach(function (post) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = post.url;
      a.textContent = post.title;
      var small = document.createElement('small');
      small.textContent = post.date + (post.tags ? '  ' + post.tags : '');
      a.appendChild(small);
      li.appendChild(a);
      results.appendChild(li);
    });
  }

  var openButton = byId('search-open');
  var closeButton = byId('search-close');
  if (openButton) openButton.addEventListener('click', openSearch);
  if (closeButton) closeButton.addEventListener('click', closeSearch);
  if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) closeSearch(); });
  if (input) input.addEventListener('input', function () { search(input.value); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeSearch(); closeLightbox(); }
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && document.activeElement && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && overlay && overlay.hidden) {
      e.preventDefault();
      openSearch();
    }
  });

  // Contents list for posts with headings.
  var body = byId('post-content');
  var toc = byId('post-toc');
  var list = byId('post-toc-list');
  if (body && toc && list) {
    var headings = body.querySelectorAll('h2, h3');
    if (headings.length >= 3) {
      headings.forEach(function (h, i) {
        if (!h.id) h.id = 'section-' + i;
        var li = document.createElement('li');
        li.className = 'toc-' + h.tagName.toLowerCase();
        var a = document.createElement('a');
        a.href = '#' + h.id;
        a.textContent = h.textContent;
        li.appendChild(a);
        list.appendChild(li);
      });
      toc.hidden = false;
      if ('IntersectionObserver' in window) {
        var links = list.querySelectorAll('a');
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            links.forEach(function (a) {
              if (a.getAttribute('href') === '#' + entry.target.id) a.classList.toggle('active', entry.isIntersecting);
            });
          });
        }, { rootMargin: '0px 0px -70% 0px' });
        headings.forEach(function (h) { observer.observe(h); });
      }
    }
  }

  // Lightbox for the gallery.
  var lightbox = byId('lightbox');
  var lightboxImg = byId('lightbox-img');
  var lightboxCaption = byId('lightbox-caption');

  function closeLightbox() {
    if (lightbox) lightbox.hidden = true;
  }

  if (lightbox && lightboxImg) {
    document.querySelectorAll('a[data-lightbox]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        lightboxImg.src = a.getAttribute('href');
        lightboxImg.alt = a.getAttribute('data-title') || '';
        if (lightboxCaption) {
          lightboxCaption.textContent = '';
          var title = a.getAttribute('data-title');
          var post = a.getAttribute('data-post');
          if (post) {
            var link = document.createElement('a');
            link.href = post;
            link.textContent = title || 'The post';
            lightboxCaption.appendChild(link);
          } else if (title) {
            lightboxCaption.textContent = title;
          }
        }
        lightbox.hidden = false;
      });
    });
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox || e.target.classList.contains('lightbox-close')) closeLightbox();
    });
  }
})();

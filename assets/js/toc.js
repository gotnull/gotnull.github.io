
(function() {
  const postContent = document.getElementById('post-content');
  const postToc = document.getElementById('post-toc');

  if (!postContent || !postToc) {
    return; // Exit if elements not found
  }

  const headings = postContent.querySelectorAll('h2, h3, h4, h5, h6');
  if (headings.length === 0) {
    return; // Exit if no headings found
  }

  let tocHtml = '<h3>Table of Contents</h3><ul class="toc-list">';
  let currentLevel = 0;

  headings.forEach((heading, index) => {
    const level = parseInt(heading.tagName.substring(1));
    const id = heading.id || `section-${index}`; // Ensure heading has an ID
    heading.id = id; // Assign ID if not present

    if (level > currentLevel) {
      tocHtml += '<ul>'.repeat(level - currentLevel);
    } else if (level < currentLevel) {
      tocHtml += '</ul>'.repeat(currentLevel - level);
    }

    tocHtml += `<li><a href="#${id}">${heading.textContent}</a></li>`;
    currentLevel = level;
  });

  tocHtml += '</ul>'.repeat(currentLevel) + '</ul>';
  postToc.innerHTML = tocHtml;

  // Smooth scrolling
  postToc.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();

      document.querySelector(this.getAttribute('href')).scrollIntoView({
        behavior: 'smooth'
      });
    });
  });

  // Optional: Highlight active TOC link on scroll
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const id = entry.target.getAttribute('id');
      const tocLink = postToc.querySelector(`a[href="#${id}"]`);

      if (tocLink) {
        if (entry.isIntersecting) {
          tocLink.classList.add('active');
        } else {
          tocLink.classList.remove('active');
        }
      }
    });
  }, {
    rootMargin: '0px 0px -70% 0px' // Adjust this value as needed
  });

  headings.forEach(heading => {
    observer.observe(heading);
  });

})();

const sectionLinks = [...document.querySelectorAll('.sidebar-sections a[href^="#"]')];
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) sectionLinks.forEach(link => {
      const active = link.hash === '#' + entry.target.id;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  });
}, { rootMargin: '-15% 0px -65% 0px' });
sectionLinks.forEach(link => {
  const target = document.getElementById(link.hash.slice(1));
  if (target) observer.observe(target);
});

// Keep section navigation visible and move focus to the chosen content.
const projectNavigation = document.getElementById('project-navigation');
if (projectNavigation) {
  projectNavigation.addEventListener('click', event => {
    const link = event.target.closest('.sidebar-sections a');
    if (!link) return;
    const target = document.getElementById(link.hash.slice(1));
    if (target) {
      target.setAttribute('tabindex', '-1');
      target.focus();
    }
  });
}

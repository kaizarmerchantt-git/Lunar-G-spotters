'use strict';
(() => {
  const links=[...document.querySelectorAll('.console-rail a')];
  const sections=links.map(a=>document.querySelector(a.getAttribute('href')));
  const select=id=>links.forEach(a=>{if(a.getAttribute('href')==='#'+id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)select(entry.target.id);},{rootMargin:'-5% 0px -65% 0px',threshold:0});
  sections.forEach(s=>observer.observe(s));
  links.forEach(a=>a.addEventListener('click',()=>select(a.getAttribute('href').slice(1))));
  select('explore');
})();

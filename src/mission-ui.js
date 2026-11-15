'use strict';
(() => {
  const byId = id => document.getElementById(id);
  const scrub = byId('scrub');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let state = null, toastTimer;

  function seek(index) {
    scrub.value = Math.max(0, Math.min(Number(scrub.max), index));
    scrub.dispatchEvent(new Event('input', {bubbles: true}));
  }
  function announce(message) {
    const toast = byId('mission-toast');
    toast.textContent = message;
    toast.classList.add('is-open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-open'), 3200);
  }
  function syncPlayback() {
    const playing = byId('play').getAttribute('aria-pressed') === 'true';
    byId('transport-play').setAttribute('aria-pressed', String(playing));
    byId('transport-play').setAttribute('aria-label', playing ? 'Pause observation' : 'Play observation');
    byId('transport-play').textContent = playing ? 'Ⅱ' : '▶';
    byId('transport-state').textContent = playing ? 'PLAYING' : 'PAUSED';
    document.querySelector('.mission-stage').classList.toggle('is-playing', playing);
  }
  function update(next) {
    state = next;
    const {samples, index, name} = state;
    const now = samples[index];
    const timeline = byId('mission-scrub');
    timeline.max = samples.length - 1;
    timeline.value = index;
    timeline.setAttribute('aria-valuetext', new Date(now.time).toISOString());
    byId('transport-time').textContent = new Date(now.time).toISOString().slice(11, 16) + ' UTC';
    byId('transport-date').textContent = new Date(now.time).toISOString().slice(0, 10);
    byId('transport-sample').textContent = String(index + 1).padStart(2, '0') + ' / ' + samples.length;
    byId('window-start').textContent = new Date(samples[0].time).toISOString().slice(5, 16).replace('T', ' / ');
    byId('window-end').textContent = new Date(samples.at(-1).time).toISOString().slice(5, 16).replace('T', ' / ');
    byId('mission-scrub').style.setProperty('--progress', `${index / (samples.length - 1) * 100}%`);
    byId('window-duration').textContent = `${((samples.at(-1).time - samples[0].time) / 3600000).toFixed(0)} h window`;
    byId('mission-reference').textContent = name;
    const source=state.mode==='nasa'?'NASA/JPL Horizons':state.mode==='synthetic'?'Synthetic / not NASA':'User supplied / unverified';
    document.querySelector('.data-stamp').textContent=`${source} · ${new Date(samples[0].time).toISOString().slice(0,16).replace('T',' ')} → ${new Date(samples.at(-1).time).toISOString().slice(0,16).replace('T',' ')} UTC`;
    for(const option of byId('mission-speed').options)option.textContent=(1000/Number(option.value))+' samples / s';
    byId('current-clearance').textContent = (Math.min(now.sun_el, now.earth_el) - next.threshold).toFixed(2) + '°';
    byId('clearance-label').textContent = now.sun && now.earth ? 'Both centers clear threshold' : 'Lowest body-center clearance';
    byId('current-clearance').classList.toggle('is-clear', now.sun && now.earth);
    const upcoming = samples.findIndex((s, i) => i > index && i < samples.length - 1 && s.sun && s.earth);
    const jump = byId('next-window');
    jump.disabled = upcoming < 0;
    jump.textContent = upcoming < 0 ? 'No later joint-visible interval' : 'Jump to next joint-visible sample →';
    jump.onclick = () => seek(upcoming);
    const start = samples[0].time, span = samples.at(-1).time - start;
    for (const key of ['sun', 'earth']) {
      const band = byId(key + '-availability');
      band.replaceChildren();
      // Each segment uses the state at its left sample, exactly like LunarModel.
      for (let i = 0; i < samples.length - 1; i++) {
        if (!samples[i][key]) continue;
        const segment = document.createElement('i');
        segment.style.left = `${(samples[i].time - start) / span * 100}%`;
        segment.style.width = `${(samples[i + 1].time - samples[i].time) / span * 100}%`;
        band.append(segment);
      }
      band.setAttribute('aria-label', `${key === 'sun' ? 'Sun' : 'Earth'} above threshold for ${next.fractions[key]} of the sampled window`);
    }
    byId('availability-cursor').style.left = `${(now.time - start) / span * 100}%`;
    byId('step-back').disabled = index === 0;
    byId('step-forward').disabled = index === samples.length - 1;
    syncPlayback();
  }
  byId('transport-play').onclick = () => byId('play').click();
  byId('step-back').onclick = () => seek(Number(scrub.value) - 1);
  byId('step-forward').onclick = () => seek(Number(scrub.value) + 1);
  byId('mission-scrub').oninput = e => seek(Number(e.target.value));
  byId('mission-speed').onchange = e => {
    byId('speed').value = e.target.value;
    byId('speed').dispatchEvent(new Event('change'));
  };
  byId('speed').addEventListener('change', () => { byId('mission-speed').value = byId('speed').value; });
  new MutationObserver(syncPlayback).observe(byId('play'), {attributes: true, attributeFilter: ['aria-pressed']});
  document.addEventListener('observation-change', e => update(e.detail));
  if (window.SeleneObservation) update(window.SeleneObservation);

  // Measured sliding selection, based on the transitions-dev tabs recipe.
  const switcher = document.querySelector('.view-switch');
  const pill = document.querySelector('.view-pill');
  function positionPill() {
    const active = switcher.querySelector('[aria-pressed="true"]');
    if (!active) return;
    pill.style.width = active.offsetWidth + 'px';
    pill.style.height = active.offsetHeight + 'px';
    pill.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
  }
  new MutationObserver(positionPill).observe(switcher, {subtree: true, attributes: true, attributeFilter: ['aria-pressed']});
  new ResizeObserver(positionPill).observe(switcher);
  positionPill();

  const stage = document.querySelector('.mission-stage');
  const focusButton = byId('focus-stage');
  function focusStage(value) {
    stage.classList.toggle('is-focused', value);
    document.body.classList.toggle('stage-focused', value);
    focusButton.textContent = value ? 'Exit focus ↙' : 'Focus view ↗';
    focusButton.setAttribute('aria-pressed', String(value));
    if (value) {
      stage.setAttribute('role', 'dialog');
      stage.setAttribute('aria-modal', 'true');
      stage.setAttribute('aria-label', 'Interactive lunar workspace');
    } else {
      stage.removeAttribute('role');
      stage.removeAttribute('aria-modal');
      stage.removeAttribute('aria-label');
    }
    window.dispatchEvent(new Event('resize'));
    if (!value) focusButton.focus();
  }
  focusButton.onclick = () => focusStage(!stage.classList.contains('is-focused'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && stage.classList.contains('is-focused')) focusStage(false);
    if (e.key === 'Tab' && stage.classList.contains('is-focused')) {
      const elements = [...stage.querySelectorAll('a[href], button, input, select, canvas[tabindex]')].filter(el => !el.disabled && el.getClientRects().length);
      const first = elements[0], last = elements.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  byId('pin-observation').onclick = () => {
    if (!state) return;
    const sample = state.samples[state.index];
    byId('pinned-name').textContent = state.name;
    byId('pinned-epoch').textContent = new Date(sample.time).toISOString().replace('T', ' / ').replace('.000Z', ' UTC');
    byId('pinned-values').textContent = `Sun ${sample.sun_el.toFixed(2)}° · Earth ${sample.earth_el.toFixed(2)}° · threshold ${state.threshold.toFixed(2)}°`;
    byId('pinned-observation').hidden = false;
    announce('Observation pinned for comparison in this session.');
  };
  byId('unpin-observation').onclick = () => { byId('pinned-observation').hidden = true; announce('Pinned observation cleared.'); };

  // Click the scientific plot to inspect the nearest actual sample, not a fabricated value.
  byId('chart').addEventListener('click', e => {
    const svg = byId('chart').querySelector('svg');
    if (!svg || !state) return;
    const bounds = svg.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, ((e.clientX - bounds.left) / bounds.width * 750 - 42) / 690));
    const target = state.samples[0].time + fraction * (state.samples.at(-1).time - state.samples[0].time);
    let nearest = 0;
    state.samples.forEach((s, i) => { if (Math.abs(s.time - target) < Math.abs(state.samples[nearest].time - target)) nearest = i; });
    seek(nearest);
  });
  if (!reduced.matches) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('has-entered'); observer.unobserve(entry.target); }
    }), {threshold: 0.06});
    document.querySelectorAll('.workspace, .import-section, .method').forEach(el => observer.observe(el));
  }
})();

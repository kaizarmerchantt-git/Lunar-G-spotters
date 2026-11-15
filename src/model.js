(function (root) {
  'use strict';
  function evaluate(rows, horizon, margin) {
    const samples = rows.map(r => ({...r, sun: r.sun_el > horizon + margin, earth: r.earth_el > horizon + margin}));
    let total = 0, sun = 0, earth = 0, both = 0, outage = 0, longest = 0;
    for (let i = 0; i < samples.length - 1; i++) {
      const hours = (samples[i + 1].time - samples[i].time) / 3600000;
      const s = samples[i]; total += hours;
      if (s.sun) sun += hours;
      if (s.earth) { earth += hours; outage = 0; } else { outage += hours; longest = Math.max(longest, outage); }
      if (s.sun && s.earth) both += hours;
    }
    return {samples, total, sun, earth, both, longest};
  }
  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 3 || lines.length > 10001) throw new Error('Provide 2–10,000 samples plus the header.');
    if (lines[0].trim() !== 'time_utc,sun_az,sun_el,earth_az,earth_el') throw new Error('Header must be time_utc,sun_az,sun_el,earth_az,earth_el');
    return lines.slice(1).map((line, i, all) => {
      const p = line.split(',').map(s => s.trim());
      if (p.length !== 5 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(p[0]) || p.slice(1).some(v => v === '')) throw new Error(`Invalid fields or UTC timestamp at row ${i + 2}. Use millisecond precision or coarser.`);
      const time = Date.parse(p[0]), values = p.slice(1).map(Number);
      if (!Number.isFinite(time) || values.some(v => !Number.isFinite(v)) || values[0] < 0 || values[0] >= 360 || values[2] < 0 || values[2] >= 360 || Math.abs(values[1]) > 90 || Math.abs(values[3]) > 90) throw new Error(`Out-of-range value at row ${i + 2}.`);
      if(new Date(time).toISOString().slice(0,19)!==p[0].slice(0,19))throw new Error(`Invalid calendar date at row ${i + 2}.`);
      if (i && time <= Date.parse(all[i - 1].split(',')[0])) throw new Error('Timestamps must be strictly increasing.');
      return {time, sun_az: values[0], sun_el: values[1], earth_az: values[2], earth_el: values[3]};
    });
  }
  function fixture(start, variant) {
    return Array.from({length: 73}, (_, i) => ({time: start + i * 3600000, sun_az: (i * 5 + variant * 25) % 360, sun_el: 2 + variant * 0.7 + 3 * Math.sin(i / 11 + variant), earth_az: (180 + 12 * Math.sin(i / 16) + variant * 10) % 360, earth_el: 3 + 4 * Math.sin(i / 8 + variant * 0.4)}));
  }
  const api = {evaluate, parseCSV, fixture};
  if (typeof module !== 'undefined') module.exports = api; else root.LunarModel = api;
})(typeof window !== 'undefined' ? window : globalThis);

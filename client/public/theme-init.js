// Applies the saved theme before first paint (external file so a strict CSP can block inline scripts).
try {
  var t = localStorage.getItem('dwmt-theme') || 'system';
  var dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
} catch (e) {}

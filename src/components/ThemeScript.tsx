export default function ThemeScript() {
  const script = `
    (function() {
      try {
        var stored = localStorage.getItem('cda.theme');
        var theme = stored ? JSON.parse(stored).data : null;
        if (!theme) {
          theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', theme);
      } catch(e) {}
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

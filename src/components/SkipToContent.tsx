export default function SkipToContent() {
  return (
    <a
      href="#main-content"
      style={{
        position: 'absolute',
        top: '-100%',
        left: 0,
        background: 'var(--blue)',
        color: '#fff',
        padding: '8px 16px',
        zIndex: 9999,
        fontSize: 14,
        fontWeight: 600,
      }}
      onFocus={e => { (e.currentTarget as HTMLElement).style.top = '0'; }}
      onBlur={e => { (e.currentTarget as HTMLElement).style.top = '-100%'; }}
    >
      Skip to main content
    </a>
  );
}

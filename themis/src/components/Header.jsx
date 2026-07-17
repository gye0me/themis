import './Header.css';

export function Header({ title, onMenuClick }) {
  return (
    <header className="header">
      <div className="header-content">
        <h1 className="header-title">{title}</h1>
        {onMenuClick && (
          <button className="header-menu-btn" onClick={onMenuClick}>
            ☰
          </button>
        )}
      </div>
    </header>
  );
}

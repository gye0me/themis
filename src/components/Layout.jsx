import './Layout.css';

export function Layout({ children }) {
  return (
    <div className="layout">
      <main className="layout-main">
        {children}
      </main>
    </div>
  );
}

export default function TopBar() {
  return (
    <div className="ip-topbar py-1">
      <div className="container d-flex justify-content-end gap-3">
        <a href="https://wa.link/eooqv5" target="_blank" rel="noreferrer" className="text-white text-decoration-none">
          <i className="bi bi-whatsapp me-1" /> WhatsApp
        </a>
        <a href="https://www.linkedin.com" target="_blank" rel="noreferrer" className="text-white text-decoration-none">
          <i className="bi bi-linkedin me-1" /> LinkedIn
        </a>
        <a href="https://www.instagram.com" target="_blank" rel="noreferrer" className="text-white text-decoration-none">
          <i className="bi bi-instagram me-1" /> Instagram
        </a>
      </div>
    </div>
  );
}

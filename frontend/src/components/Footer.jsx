import { ExternalLinkIcon } from './Icons.jsx';

export default function Footer() {
  return (
    <footer className="footer">
      <p className="footer-legal">
        Payments and billing are handled by Agnic. You contract directly with
        Agnic; PixelForge never receives or holds your funds.
      </p>
      <p className="footer-meta">
        <a href="https://app.agnic.ai/topup" target="_blank" rel="noreferrer">
          Top up at app.agnic.ai/topup <ExternalLinkIcon className="ico" width="12" height="12" />
        </a>
      </p>
    </footer>
  );
}

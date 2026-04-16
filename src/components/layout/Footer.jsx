import { Link } from 'react-router';

export default function Footer() {
  return (
    <footer className="bg-pyqp-text text-white/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* Project identity */}
          <div>
            <h2 className="font-heading font-bold text-lg text-white">Quarchive</h2>
            <p className="text-sm mt-1 max-w-md">
              An open-source archive of previous year university exam question papers.
            </p>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm">
            <Link to="/about" className="hover:text-white transition-colors">
              About
            </Link>
            <a href="#" className="hover:text-white transition-colors">
              Contribute
            </a>
            <a
              href="#"
              className="hover:text-white transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </div>
        </div>

        {/* Attribution */}
        <div className="mt-8 pt-6 border-t border-white/10 text-xs text-white/50">
          Powered by Internet Archive &middot; Institution data from Wikidata
        </div>
      </div>
    </footer>
  );
}

import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="border-t-4 border-gray-200 py-4 px-8 mt-auto">
      <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-700 mb-2">
        <Link to="/about" className="hover:underline">About</Link>
        <Link to="/help" className="hover:underline">Help</Link>
        <Link to="/privacy" className="hover:underline">Privacy</Link>
        <Link to="/terms" className="hover:underline">Terms</Link>
        <Link to="/legal" className="hover:underline">Legal</Link>
        <Link to="/locations" className="hover:underline">Locations</Link>
        <Link to="/contact" className="hover:underline">Contact</Link>
      </div>
      <p className="text-center text-xs text-gray-700">© 2026 Erovians. All rights reserved.</p>
    </footer>
  );
};

export default Footer;

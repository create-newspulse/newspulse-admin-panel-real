// ✅ Fixed: remove auto-redirect to /auth to stop loop; /login is canonical now.
import { Link } from 'react-router-dom';

export default function LoginPage() {
  return (
    <div style={{ padding: 24 }}>
      <h2>Login</h2>
      <p>
        Use the primary login page.
        {' '}<Link to="/login">Go to /login</Link>
        {' '}or use the advanced auth at <Link to="/auth">/auth</Link>.
      </p>
    </div>
  );
}

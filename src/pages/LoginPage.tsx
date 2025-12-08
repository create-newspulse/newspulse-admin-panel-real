// ✅ Fixed: remove auto-redirect to /auth to stop loop; /login is canonical now.
export default function LoginPage() {
  return (
    <div style={{ padding: 24 }}>
      <h2>Login</h2>
      <p>
        Use the primary login page.
        {' '}<a href="/login">Go to /login</a>
        {' '}or use the advanced auth at <a href="/auth">/auth</a>.
      </p>
    </div>
  );
}

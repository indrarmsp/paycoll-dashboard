import { redirectIfAuthed } from '../../lib/server-auth';
import { LoginClient } from '../../components/login-client';

export default async function LoginPage() {
  await redirectIfAuthed();

  return <LoginClient />;
}
import { getSession } from './tenant';

export async function isAdmin() {
  const session = await getSession();
  if (!session) return false;
  
  // Default admin bootstrapping
  const adminEmail = "duyongquan@gmail.com";
  
  // In a real app, we would check the user's role in the DB or their email from the auth provider
  return session.role === 'admin' || session.userId === 'admin-user-id';
}

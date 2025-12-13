// AUTHENTICATION DISABLED FOR DEVELOPMENT
// This service simulates authentication functions without actual authentication

// Simulate a fake user for development
const DEFAULT_USER = {
  id: 'default-user-id',
  email: 'default@example.com',
  user_metadata: {
    full_name: 'Default User'
  }
};

export async function signInWithEmail(email, password) {
  // Simulate successful sign in
  return { data: { user: DEFAULT_USER }, error: null };
}

export async function signUpWithEmail(email, password) {
  // Simulate successful sign up
  return { data: { user: DEFAULT_USER }, error: null };
}

export async function signOut() {
  // Simulate sign out
  return { error: null };
}

export function getCurrentUser() {
  // Return the default user
  return Promise.resolve({ data: { user: DEFAULT_USER } });
}

export function onAuthStateChange(callback) {
  // Immediately call back with default user
  setTimeout(() => callback('SIGNED_IN', { user: DEFAULT_USER }), 0);
  
  // Return a mock unsubscribe function
  return { data: { unsubscribe: () => {} } };
}
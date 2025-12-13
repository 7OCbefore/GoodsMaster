// TEMPORARY DEVELOPMENT AUTH SERVICE - NOT FOR PRODUCTION USE
// This service bypasses all authentication for streamlined development/testing
// WARNING: This completely disables authentication and should never be used in production

// Simulate a fake user for development
const DEV_USER = {
  id: 'dev-user-id',
  email: 'developer@example.com',
  user_metadata: {
    full_name: 'Development User'
  }
};

// Flag to enable/disable dev auth mode
const DEV_AUTH_ENABLED = import.meta.env.VITE_DEV_AUTH_ENABLED === 'true';

export async function signInWithEmail(email, password) {
  // In dev mode, bypass authentication completely
  if (DEV_AUTH_ENABLED) {
    console.warn('⚠️ DEVELOPMENT MODE: Authentication bypassed - ignoring credentials');
    return { data: { user: DEV_USER }, error: null };
  }
  
  // Fallback to real authentication if dev mode is disabled
  const { data, error } = await import('./authService').then(module => 
    module.signInWithEmail(email, password)
  );
  return { data, error };
}

export async function signUpWithEmail(email, password) {
  // In dev mode, simulate successful signup
  if (DEV_AUTH_ENABLED) {
    console.warn('⚠️ DEVELOPMENT MODE: Signup simulated - ignoring credentials');
    return { data: { user: DEV_USER }, error: null };
  }
  
  // Fallback to real signup if dev mode is disabled
  const { data, error } = await import('./authService').then(module => 
    module.signUpWithEmail(email, password)
  );
  return { data, error };
}

export async function signOut() {
  // In dev mode, simulate signout
  if (DEV_AUTH_ENABLED) {
    console.warn('⚠️ DEVELOPMENT MODE: Signout simulated');
    return { error: null };
  }
  
  // Fallback to real signout if dev mode is disabled
  const { error } = await import('./authService').then(module => 
    module.signOut()
  );
  return { error };
}

export function getCurrentUser() {
  // In dev mode, return the dev user
  if (DEV_AUTH_ENABLED) {
    console.warn('⚠️ DEVELOPMENT MODE: Returning mock user');
    return Promise.resolve({ data: { user: DEV_USER } });
  }
  
  // Fallback to real getCurrentUser if dev mode is disabled
  return import('./authService').then(module => module.getCurrentUser());
}

export function onAuthStateChange(callback) {
  // In dev mode, immediately call back with dev user
  if (DEV_AUTH_ENABLED) {
    console.warn('⚠️ DEVELOPMENT MODE: Simulating auth state change');
    // Call the callback immediately with the dev user
    setTimeout(() => callback('SIGNED_IN', { user: DEV_USER }), 0);
    
    // Return a mock unsubscribe function
    return { data: { unsubscribe: () => {} } };
  }
  
  // Fallback to real onAuthStateChange if dev mode is disabled
  return import('./authService').then(module => module.onAuthStateChange(callback));
}

// Export the dev mode flag for conditional UI rendering
export { DEV_AUTH_ENABLED };
import { describe, it, expect, vi } from 'vitest'
import * as AuthService from '../../../src/services/authService'

describe('AuthService', () => {
  it('should have signInWithEmail function', () => {
    expect(typeof AuthService.signInWithEmail).toBe('function')
  })

  it('should have signUpWithEmail function', () => {
    expect(typeof AuthService.signUpWithEmail).toBe('function')
  })

  it('should have signOut function', () => {
    expect(typeof AuthService.signOut).toBe('function')
  })

  it('should have getCurrentUser function', () => {
    expect(typeof AuthService.getCurrentUser).toBe('function')
  })

  it('should have onAuthStateChange function', () => {
    expect(typeof AuthService.onAuthStateChange).toBe('function')
  })
})
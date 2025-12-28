function fallbackUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const rand = Math.random() * 16 | 0;
    const value = ch === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return fallbackUuid();
}

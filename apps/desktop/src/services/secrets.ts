/**
 * SecretsService — stores API keys and sensitive values using Electron safeStorage.
 * Keys are encrypted with the OS credential store (DPAPI on Windows, Keychain on macOS,
 * libsecret on Linux). The ciphertext is stored as a hex string in a JSON file in userData.
 *
 * SECURITY:
 * - Full plaintext secrets are NEVER written to SQLite, logs, localStorage, or IPC responses.
 * - The renderer process only receives a boolean (has/doesn't-have) or can set/delete.
 * - Internal use (e.g. AI providers) calls getSecret() directly from main process.
 */

import path from 'node:path';
import fs from 'node:fs';
import { app, safeStorage } from 'electron';
import log from 'electron-log/main';

const VAULT_FILE = 'secrets.vault';

type Vault = Record<string, string>; // key → hex-encoded ciphertext

function getVaultPath(): string {
  return path.join(app.getPath('userData'), VAULT_FILE);
}

function loadVault(): Vault {
  try {
    const raw = fs.readFileSync(getVaultPath(), 'utf8');
    return JSON.parse(raw) as Vault;
  } catch {
    return {};
  }
}

function saveVault(vault: Vault): void {
  fs.writeFileSync(getVaultPath(), JSON.stringify(vault), { encoding: 'utf8', mode: 0o600 });
}

function isAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

/**
 * Validate key format: alphanumeric, dots, underscores, hyphens, max 128 chars.
 */
function validateKey(key: string): void {
  if (typeof key !== 'string' || !/^[a-zA-Z0-9._-]{1,128}$/.test(key)) {
    throw new Error('Invalid secret key format');
  }
}

export const SecretsService = {
  /**
   * Encrypt and persist a secret. If safeStorage is unavailable (rare CI edge case),
   * we refuse to store — never fall back to plaintext.
   */
  setSecret(key: string, value: string): void {
    validateKey(key);
    if (!isAvailable()) {
      throw new Error('OS encryption unavailable — cannot store secret');
    }
    const cipherBuf = safeStorage.encryptString(value);
    const vault = loadVault();
    vault[key] = cipherBuf.toString('hex');
    saveVault(vault);
    log.info('[secrets] Stored key:', key);
  },

  /**
   * Decrypt and return a secret. Returns null if key not found or decryption fails.
   * NEVER log the returned value.
   */
  getSecret(key: string): string | null {
    validateKey(key);
    if (!isAvailable()) {
      log.warn('[secrets] OS encryption unavailable, cannot read secret');
      return null;
    }
    const vault = loadVault();
    const hex = vault[key];
    if (!hex) return null;
    try {
      return safeStorage.decryptString(Buffer.from(hex, 'hex'));
    } catch (err) {
      log.error('[secrets] Decryption failed for key:', key, err instanceof Error ? err.message : '');
      return null;
    }
  },

  deleteSecret(key: string): void {
    validateKey(key);
    const vault = loadVault();
    delete vault[key];
    saveVault(vault);
    log.info('[secrets] Deleted key:', key);
  },

  hasSecret(key: string): boolean {
    validateKey(key);
    const vault = loadVault();
    return key in vault;
  },

  /** Returns the list of stored key names (no values). Safe to expose to renderer. */
  listKeys(): string[] {
    return Object.keys(loadVault());
  },
};

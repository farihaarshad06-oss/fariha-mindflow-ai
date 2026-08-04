/**
 * SettingsService — reads/writes the singleton Settings row in SQLite.
 * Provides typed defaults and upserts on first access.
 */

import { getPrisma } from './database';
import log from 'electron-log/main';
import type { Settings } from '../generated/prisma';

export type SettingsUpdate = Partial<Omit<Settings, 'id' | 'updatedAt'>>;

export const SettingsService = {
  async get(): Promise<Settings> {
    const db = getPrisma();
    const existing = await db.settings.findUnique({ where: { id: 'default' } });
    if (existing) return existing;
    // Create defaults on first access
    return db.settings.create({ data: { id: 'default' } });
  },

  async update(data: SettingsUpdate): Promise<Settings> {
    const db = getPrisma();
    const updated = await db.settings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...data },
      update: data,
    });
    log.info('[settings] Updated:', Object.keys(data).join(', '));
    return updated;
  },

  async getStoragePath(): Promise<string> {
    const { app } = await import('electron');
    const settings = await this.get();
    return settings.storagePath ?? app.getPath('userData');
  },
};

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Config } from '../shared/types';

const CONFIG_DIR = join(homedir(), '.mute-border');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: Config = {
  obs: {
    enabled: false,
    host: '127.0.0.1',
    port: 4455,
    password: '',
    inputName: null,
  },
  waveLink: {
    enabled: true,
  },
};

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function createDefaultConfig(): Config {
  try {
    ensureConfigDir();
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
  } catch (error) {
    console.error('[Config] Failed to create default config file, using defaults in memory:', error);
  }
  return DEFAULT_CONFIG;
}

export function loadConfig(): Config {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return createDefaultConfig();
    }

    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<Config>;

    return {
      obs: { ...DEFAULT_CONFIG.obs, ...(parsed.obs ?? {}) },
      waveLink: { ...DEFAULT_CONFIG.waveLink, ...(parsed.waveLink ?? {}) },
    };
  } catch (error) {
    console.error('[Config] Failed to load config, using defaults:', error);
    return DEFAULT_CONFIG;
  }
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

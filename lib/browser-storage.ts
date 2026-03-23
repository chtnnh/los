"use client";

import Dexie, { type Table } from "dexie";

export const LEGACY_STORAGE_KEY = "life-os-data-v1";
export const LEGACY_SETTINGS_STORAGE_KEY = "life-os-settings-v1";

type DataRecord = {
  id: number;
  payload: string;
  updatedAt: number;
};

type SettingsRecord = {
  id: number;
  payload: string;
  updatedAt: number;
};

class LifeOsDexie extends Dexie {
  lifeData!: Table<DataRecord, number>;
  appSettings!: Table<SettingsRecord, number>;

  constructor() {
    super("life-os-db");
    this.version(1).stores({
      lifeData: "id, updatedAt",
      appSettings: "id, updatedAt",
    });
  }
}

const db = new LifeOsDexie();
const ACTIVE_RECORD_ID = 1;

export async function loadPersistedData(): Promise<string | null> {
  const row = await db.lifeData.get(ACTIVE_RECORD_ID);
  return row?.payload ?? null;
}

export async function loadPersistedSettings(): Promise<string | null> {
  const row = await db.appSettings.get(ACTIVE_RECORD_ID);
  return row?.payload ?? null;
}

export async function persistData(payload: string): Promise<void> {
  await db.lifeData.put({
    id: ACTIVE_RECORD_ID,
    payload,
    updatedAt: Date.now(),
  });
}

export async function persistSettings(payload: string): Promise<void> {
  await db.appSettings.put({
    id: ACTIVE_RECORD_ID,
    payload,
    updatedAt: Date.now(),
  });
}

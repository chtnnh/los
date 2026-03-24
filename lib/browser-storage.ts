"use client";

import Dexie, { type Table, type Transaction } from "dexie";

export const LEGACY_STORAGE_KEY = "life-os-data-v1";
export const LEGACY_SETTINGS_STORAGE_KEY = "life-os-settings-v1";

type LegacyBlobRecord = {
  id: number;
  payload: string;
  updatedAt: number;
};

type MetaRecord = {
  key: string;
  value: string;
  updatedAt: number;
};

type MigrationBackupRecord = {
  id: string;
  dataPayload: string;
  settingsPayload: string | null;
  source: string;
  createdAt: number;
};

type GoalType = "daily" | "weekly" | "monthly";
type PriorityTag = "low" | "medium" | "high" | "";
type TimelineTag = "day" | "week" | "month" | "quarter" | "year" | "decade" | "";

type GoalRow = {
  id: string;
  goalType: GoalType;
  title: string;
  titleLower: string;
  description: string;
  completed: 0 | 1;
  dueDate: string;
  priorityRank: number;
  timelineRank: number;
  areaTags: string[];
  projectIds: string[];
  position: number;
  updatedAt: number;
};

type SubGoalRow = {
  id: string;
  goalId: string;
  parentSubGoalId: string | null;
  title: string;
  description: string;
  completed: 0 | 1;
  dueDate: string;
  priorityRank: number;
  timelineRank: number;
  position: number;
  updatedAt: number;
};

type ProjectRow = {
  id: string;
  title: string;
  titleLower: string;
  description: string;
  dueDate: string;
  priorityRank: number;
  timelineRank: number;
  areaTags: string[];
  position: number;
  updatedAt: number;
};

type AttachmentOwnerType = "goal" | "project" | "subGoal";

type AttachmentRow = {
  id: string;
  ownerType: AttachmentOwnerType;
  ownerId: string;
  label: string;
  url: string;
  source: "url" | "local-file-ref" | "embedded-file";
  position: number;
  updatedAt: number;
};

type KeyArea = "health" | "work" | "relationships" | "financial" | "learning" | "soul";

type KeyAreaRow = {
  area: KeyArea;
  vision: string;
  description: string;
  updatedAt: number;
};

type TodayAlignmentRow = {
  id: "today";
  todayGoalRef: string;
  todayProjectId: string;
  todayFocus: string;
  energyPlan: string;
  updatedAt: number;
};

type SettingsRow = {
  id: "settings";
  payload: string;
  updatedAt: number;
};

class LifeOsDexie extends Dexie {
  lifeData!: Table<LegacyBlobRecord, number>;
  appSettings!: Table<LegacyBlobRecord, number>;
  goals!: Table<GoalRow, string>;
  subGoals!: Table<SubGoalRow, string>;
  projects!: Table<ProjectRow, string>;
  attachments!: Table<AttachmentRow, string>;
  keyAreas!: Table<KeyAreaRow, KeyArea>;
  todayAlignment!: Table<TodayAlignmentRow, "today">;
  settings!: Table<SettingsRow, "settings">;
  meta!: Table<MetaRecord, string>;
  migrationBackups!: Table<MigrationBackupRecord, string>;

  constructor() {
    super("life-os-db");
    this.version(1).stores({
      lifeData: "id, updatedAt",
      appSettings: "id, updatedAt",
    });
    this.version(2)
      .stores({
        lifeData: "id, updatedAt",
        appSettings: "id, updatedAt",
        goals:
          "id, goalType, [goalType+position], [goalType+dueDate], [goalType+priorityRank], [goalType+timelineRank], [goalType+titleLower], dueDate, priorityRank, timelineRank, titleLower, *areaTags, *projectIds, updatedAt",
        subGoals:
          "id, goalId, parentSubGoalId, [goalId+position], [goalId+parentSubGoalId+position], [goalId+completed], dueDate, priorityRank, timelineRank, updatedAt",
        projects: "id, position, dueDate, priorityRank, timelineRank, titleLower, *areaTags, updatedAt",
        attachments: "id, [ownerType+ownerId+position], [ownerType+ownerId], source, updatedAt",
        keyAreas: "area, updatedAt",
        todayAlignment: "id, updatedAt",
        settings: "id, updatedAt",
        meta: "key, updatedAt",
        migrationBackups: "id, createdAt",
      })
      .upgrade(async (tx) => {
        const legacyData = (await tx.table("lifeData").get(1)) as LegacyBlobRecord | undefined;
        const legacySettings = (await tx.table("appSettings").get(1)) as LegacyBlobRecord | undefined;
        if (!legacyData?.payload) {
          await putMeta(tx, "schemaVersion", "2");
          return;
        }

        await tx.table("migrationBackups").put({
          id: `backup-v1-${Date.now()}`,
          dataPayload: legacyData.payload,
          settingsPayload: legacySettings?.payload ?? null,
          source: "dexie-v1-upgrade",
          createdAt: Date.now(),
        } as MigrationBackupRecord);

        await writeNormalizedFromPayloads(tx, legacyData.payload, legacySettings?.payload ?? null);
        await putMeta(tx, "schemaVersion", "2");
        await putMeta(tx, "lastMigrationSource", "dexie-v1-upgrade");
        await putMeta(tx, "lastMigrationAt", String(Date.now()));
      });
  }
}

const db = new LifeOsDexie();
const KEY_AREAS: KeyArea[] = ["health", "work", "relationships", "financial", "learning", "soul"];
const GOAL_TYPES: GoalType[] = ["daily", "weekly", "monthly"];
const TIMELINE_ORDER: TimelineTag[] = ["day", "week", "month", "quarter", "year", "decade", ""];
const PRIORITY_ORDER: PriorityTag[] = ["high", "medium", "low", ""];
const SETTINGS_ID: SettingsRow["id"] = "settings";
const TODAY_ID: TodayAlignmentRow["id"] = "today";

export type StorageMigrationStatus = {
  schemaVersion: number;
  hasRollbackBackup: boolean;
  lastMigrationAt: number | null;
  lastMigrationSource: string;
};

function parseJson(value: string | null): unknown {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function toPriorityRank(value: unknown): number {
  const idx = PRIORITY_ORDER.indexOf((typeof value === "string" ? value : "") as PriorityTag);
  return idx >= 0 ? idx : PRIORITY_ORDER.indexOf("");
}

function fromPriorityRank(rank: unknown): PriorityTag {
  if (typeof rank !== "number") {
    return "";
  }
  return PRIORITY_ORDER[rank] ?? "";
}

function toTimelineRank(value: unknown): number {
  const idx = TIMELINE_ORDER.indexOf((typeof value === "string" ? value : "") as TimelineTag);
  return idx >= 0 ? idx : TIMELINE_ORDER.indexOf("");
}

function fromTimelineRank(rank: unknown): TimelineTag {
  if (typeof rank !== "number") {
    return "";
  }
  return TIMELINE_ORDER[rank] ?? "";
}

async function putMeta(tx: Transaction, key: string, value: string): Promise<void> {
  await tx.table("meta").put({ key, value, updatedAt: Date.now() } as MetaRecord);
}

function flattenSubGoals(
  goalId: string,
  source: unknown,
  parentSubGoalId: string | null,
  rows: SubGoalRow[],
  attachments: AttachmentRow[]
) {
  if (!Array.isArray(source)) {
    return;
  }

  source.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      return;
    }
    const subGoal = entry as Record<string, unknown>;
    const subGoalId = normalizeString(subGoal.id) || `${goalId}-sub-${index + 1}`;
    rows.push({
      id: subGoalId,
      goalId,
      parentSubGoalId,
      title: normalizeString(subGoal.title),
      description: normalizeString(subGoal.description),
      completed: subGoal.completed ? 1 : 0,
      dueDate: normalizeString(subGoal.dueDate),
      priorityRank: toPriorityRank(subGoal.priority),
      timelineRank: toTimelineRank(subGoal.timeline),
      position: index,
      updatedAt: Date.now(),
    });

    if (Array.isArray(subGoal.attachments)) {
      subGoal.attachments.forEach((attachmentValue, attachmentIndex) => {
        if (!attachmentValue || typeof attachmentValue !== "object") {
          return;
        }
        const attachment = attachmentValue as Record<string, unknown>;
        attachments.push({
          id: normalizeString(attachment.id) || `${subGoalId}-attachment-${attachmentIndex + 1}`,
          ownerType: "subGoal",
          ownerId: subGoalId,
          label: normalizeString(attachment.label),
          url: normalizeString(attachment.url),
          source:
            attachment.source === "url" || attachment.source === "local-file-ref" || attachment.source === "embedded-file"
              ? attachment.source
              : "url",
          position: attachmentIndex,
          updatedAt: Date.now(),
        });
      });
    }

    flattenSubGoals(goalId, subGoal.children, subGoalId, rows, attachments);
  });
}

async function writeNormalizedFromPayloads(
  tx: Transaction,
  dataPayload: string,
  settingsPayload: string | null
): Promise<void> {
  const parsed = parseJson(dataPayload);
  if (!parsed || typeof parsed !== "object") {
    return;
  }
  const data = parsed as Record<string, unknown>;
  const now = Date.now();
  const goals: GoalRow[] = [];
  const subGoals: SubGoalRow[] = [];
  const projects: ProjectRow[] = [];
  const attachments: AttachmentRow[] = [];
  const keyAreas: KeyAreaRow[] = [];
  const today: TodayAlignmentRow = {
    id: TODAY_ID,
    todayGoalRef: normalizeString(data.todayGoalRef),
    todayProjectId: normalizeString(data.todayProjectId),
    todayFocus: normalizeString(data.todayFocus),
    energyPlan: normalizeString(data.energyPlan),
    updatedAt: now,
  };

  const visions = (data.visions && typeof data.visions === "object" ? data.visions : {}) as Record<string, unknown>;
  const descriptions = (data.keyAreaDescriptions && typeof data.keyAreaDescriptions === "object"
    ? data.keyAreaDescriptions
    : {}) as Record<string, unknown>;

  KEY_AREAS.forEach((area) => {
    keyAreas.push({
      area,
      vision: normalizeString(visions[area]),
      description: normalizeString(descriptions[area]),
      updatedAt: now,
    });
  });

  const goalsByType = (data.goals && typeof data.goals === "object" ? data.goals : {}) as Record<string, unknown>;
  GOAL_TYPES.forEach((goalType) => {
    const goalList = Array.isArray(goalsByType[goalType]) ? goalsByType[goalType] : [];
    goalList.forEach((goalValue, position) => {
      if (!goalValue || typeof goalValue !== "object") {
        return;
      }
      const goal = goalValue as Record<string, unknown>;
      const goalId = normalizeString(goal.id);
      if (!goalId) {
        return;
      }

      goals.push({
        id: goalId,
        goalType,
        title: normalizeString(goal.title),
        titleLower: normalizeString(goal.title).trim().toLowerCase(),
        description: normalizeString(goal.description),
        completed: goal.completed ? 1 : 0,
        dueDate: normalizeString(goal.dueDate),
        priorityRank: toPriorityRank(goal.priority),
        timelineRank: toTimelineRank(goal.timeline),
        areaTags: normalizeStringList(goal.areaTags),
        projectIds: normalizeStringList(goal.projectIds),
        position,
        updatedAt: now,
      });

      if (Array.isArray(goal.attachments)) {
        goal.attachments.forEach((attachmentValue, attachmentIndex) => {
          if (!attachmentValue || typeof attachmentValue !== "object") {
            return;
          }
          const attachment = attachmentValue as Record<string, unknown>;
          attachments.push({
            id: normalizeString(attachment.id) || `${goalId}-attachment-${attachmentIndex + 1}`,
            ownerType: "goal",
            ownerId: goalId,
            label: normalizeString(attachment.label),
            url: normalizeString(attachment.url),
            source:
              attachment.source === "url" || attachment.source === "local-file-ref" || attachment.source === "embedded-file"
                ? attachment.source
                : "url",
            position: attachmentIndex,
            updatedAt: now,
          });
        });
      }

      flattenSubGoals(goalId, goal.subGoals, null, subGoals, attachments);
    });
  });

  const projectList = Array.isArray(data.projects) ? data.projects : [];
  projectList.forEach((projectValue, position) => {
    if (!projectValue || typeof projectValue !== "object") {
      return;
    }
    const project = projectValue as Record<string, unknown>;
    const projectId = normalizeString(project.id);
    if (!projectId) {
      return;
    }

    projects.push({
      id: projectId,
      title: normalizeString(project.title),
      titleLower: normalizeString(project.title).trim().toLowerCase(),
      description: normalizeString(project.description),
      dueDate: normalizeString(project.dueDate),
      priorityRank: toPriorityRank(project.priority),
      timelineRank: toTimelineRank(project.timeline),
      areaTags: normalizeStringList(project.areaTags),
      position,
      updatedAt: now,
    });

    if (Array.isArray(project.attachments)) {
      project.attachments.forEach((attachmentValue, attachmentIndex) => {
        if (!attachmentValue || typeof attachmentValue !== "object") {
          return;
        }
        const attachment = attachmentValue as Record<string, unknown>;
        attachments.push({
          id: normalizeString(attachment.id) || `${projectId}-attachment-${attachmentIndex + 1}`,
          ownerType: "project",
          ownerId: projectId,
          label: normalizeString(attachment.label),
          url: normalizeString(attachment.url),
          source:
            attachment.source === "url" || attachment.source === "local-file-ref" || attachment.source === "embedded-file"
              ? attachment.source
              : "url",
          position: attachmentIndex,
          updatedAt: now,
        });
      });
    }
  });

  await tx.table("goals").clear();
  await tx.table("subGoals").clear();
  await tx.table("projects").clear();
  await tx.table("attachments").clear();
  await tx.table("keyAreas").clear();
  await tx.table("todayAlignment").clear();

  if (goals.length > 0) {
    await tx.table("goals").bulkPut(goals);
  }
  if (subGoals.length > 0) {
    await tx.table("subGoals").bulkPut(subGoals);
  }
  if (projects.length > 0) {
    await tx.table("projects").bulkPut(projects);
  }
  if (attachments.length > 0) {
    await tx.table("attachments").bulkPut(attachments);
  }
  if (keyAreas.length > 0) {
    await tx.table("keyAreas").bulkPut(keyAreas);
  }
  await tx.table("todayAlignment").put(today);

  if (settingsPayload) {
    await tx.table("settings").put({
      id: SETTINGS_ID,
      payload: settingsPayload,
      updatedAt: now,
    } as SettingsRow);
  }
}

async function hasNormalizedData(): Promise<boolean> {
  const [goalCount, projectCount, todayCount, areaCount] = await Promise.all([
    db.goals.count(),
    db.projects.count(),
    db.todayAlignment.count(),
    db.keyAreas.count(),
  ]);
  return goalCount > 0 || projectCount > 0 || todayCount > 0 || areaCount > 0;
}

export async function migrateLegacyPayloadIntoNormalizedStorage(
  dataPayload: string,
  settingsPayload: string | null,
  source = "manual-legacy-import"
): Promise<void> {
  await db.transaction(
    "rw",
    [db.goals, db.subGoals, db.projects, db.attachments, db.keyAreas, db.todayAlignment, db.settings, db.meta, db.migrationBackups],
    async (tx) => {
      await tx.table("migrationBackups").put({
        id: `backup-legacy-${Date.now()}`,
        dataPayload,
        settingsPayload,
        source,
        createdAt: Date.now(),
      } as MigrationBackupRecord);
      await writeNormalizedFromPayloads(tx, dataPayload, settingsPayload);
      await putMeta(tx, "schemaVersion", "2");
      await putMeta(tx, "lastMigrationSource", source);
      await putMeta(tx, "lastMigrationAt", String(Date.now()));
    }
  );
}

export async function loadPersistedData(): Promise<string | null> {
  const hasData = await hasNormalizedData();
  if (!hasData) {
    const legacy = await db.lifeData.get(1);
    return legacy?.payload ?? null;
  }

  const [goalRows, subGoalRows, projectRows, attachmentRows, areaRows, todayRow] = await Promise.all([
    db.goals.orderBy("[goalType+position]").toArray(),
    db.subGoals.orderBy("[goalId+position]").toArray(),
    db.projects.orderBy("position").toArray(),
    db.attachments.orderBy("[ownerType+ownerId+position]").toArray(),
    db.keyAreas.toArray(),
    db.todayAlignment.get(TODAY_ID),
  ]);

  const areaMap = new Map<KeyArea, KeyAreaRow>();
  areaRows.forEach((row) => areaMap.set(row.area, row));

  const attachmentsByOwner = new Map<string, AttachmentRow[]>();
  attachmentRows.forEach((row) => {
    const key = `${row.ownerType}:${row.ownerId}`;
    const existing = attachmentsByOwner.get(key) ?? [];
    existing.push(row);
    attachmentsByOwner.set(key, existing);
  });

  const subGoalsByGoal = new Map<string, SubGoalRow[]>();
  subGoalRows.forEach((row) => {
    const existing = subGoalsByGoal.get(row.goalId) ?? [];
    existing.push(row);
    subGoalsByGoal.set(row.goalId, existing);
  });

  const goalsByType: Record<GoalType, unknown[]> = {
    daily: [],
    weekly: [],
    monthly: [],
  };

  goalRows.forEach((goalRow) => {
    const allSubRows = subGoalsByGoal.get(goalRow.id) ?? [];
    const subGoalNodeById = new Map<string, Record<string, unknown>>();
    const subGoalChildrenByParent = new Map<string | null, Record<string, unknown>[]>();

    allSubRows.forEach((subRow) => {
      const node: Record<string, unknown> = {
        id: subRow.id,
        title: subRow.title,
        completed: Boolean(subRow.completed),
        description: subRow.description,
        dueDate: subRow.dueDate,
        priority: fromPriorityRank(subRow.priorityRank),
        timeline: fromTimelineRank(subRow.timelineRank),
        attachments: (attachmentsByOwner.get(`subGoal:${subRow.id}`) ?? []).map((a) => ({
          id: a.id,
          label: a.label,
          url: a.url,
          source: a.source,
        })),
        children: [],
      };
      subGoalNodeById.set(subRow.id, node);
      const siblingList = subGoalChildrenByParent.get(subRow.parentSubGoalId) ?? [];
      siblingList.push(node);
      subGoalChildrenByParent.set(subRow.parentSubGoalId, siblingList);
    });

    allSubRows.forEach((subRow) => {
      const node = subGoalNodeById.get(subRow.id);
      const children = subGoalChildrenByParent.get(subRow.id) ?? [];
      if (node) {
        node.children = children;
      }
    });

    goalsByType[goalRow.goalType].push({
      id: goalRow.id,
      title: goalRow.title,
      completed: Boolean(goalRow.completed),
      description: goalRow.description,
      dueDate: goalRow.dueDate,
      priority: fromPriorityRank(goalRow.priorityRank),
      timeline: fromTimelineRank(goalRow.timelineRank),
      areaTags: goalRow.areaTags,
      projectIds: goalRow.projectIds,
      attachments: (attachmentsByOwner.get(`goal:${goalRow.id}`) ?? []).map((a) => ({
        id: a.id,
        label: a.label,
        url: a.url,
        source: a.source,
      })),
      subGoals: subGoalChildrenByParent.get(null) ?? [],
    });
  });

  const projects = projectRows.map((projectRow) => ({
    id: projectRow.id,
    title: projectRow.title,
    description: projectRow.description,
    dueDate: projectRow.dueDate,
    priority: fromPriorityRank(projectRow.priorityRank),
    timeline: fromTimelineRank(projectRow.timelineRank),
    areaTags: projectRow.areaTags,
    attachments: (attachmentsByOwner.get(`project:${projectRow.id}`) ?? []).map((a) => ({
      id: a.id,
      label: a.label,
      url: a.url,
      source: a.source,
    })),
  }));

  const payload = {
    visions: {
      health: areaMap.get("health")?.vision ?? "",
      work: areaMap.get("work")?.vision ?? "",
      relationships: areaMap.get("relationships")?.vision ?? "",
      financial: areaMap.get("financial")?.vision ?? "",
      learning: areaMap.get("learning")?.vision ?? "",
      soul: areaMap.get("soul")?.vision ?? "",
    },
    keyAreaDescriptions: {
      health: areaMap.get("health")?.description ?? "",
      work: areaMap.get("work")?.description ?? "",
      relationships: areaMap.get("relationships")?.description ?? "",
      financial: areaMap.get("financial")?.description ?? "",
      learning: areaMap.get("learning")?.description ?? "",
      soul: areaMap.get("soul")?.description ?? "",
    },
    goals: goalsByType,
    projects,
    todayGoalRef: todayRow?.todayGoalRef ?? "",
    todayProjectId: todayRow?.todayProjectId ?? "",
    todayFocus: todayRow?.todayFocus ?? "",
    energyPlan: todayRow?.energyPlan ?? "",
  };

  return JSON.stringify(payload);
}

export async function loadPersistedSettings(): Promise<string | null> {
  const normalized = await db.settings.get(SETTINGS_ID);
  if (normalized?.payload) {
    return normalized.payload;
  }

  const legacy = await db.appSettings.get(1);
  return legacy?.payload ?? null;
}

export async function persistData(payload: string): Promise<void> {
  await db.transaction(
    "rw",
    [db.goals, db.subGoals, db.projects, db.attachments, db.keyAreas, db.todayAlignment, db.meta],
    async (tx) => {
      await writeNormalizedFromPayloads(tx, payload, null);
      await putMeta(tx, "schemaVersion", "2");
      await putMeta(tx, "lastWriteAt", String(Date.now()));
    }
  );
}

export async function persistSettings(payload: string): Promise<void> {
  await db.settings.put({
    id: SETTINGS_ID,
    payload,
    updatedAt: Date.now(),
  });
}

export async function getStorageMigrationStatus(): Promise<StorageMigrationStatus> {
  const [schemaVersionMeta, lastMigrationAtMeta, lastMigrationSourceMeta, backupCount] = await Promise.all([
    db.meta.get("schemaVersion"),
    db.meta.get("lastMigrationAt"),
    db.meta.get("lastMigrationSource"),
    db.migrationBackups.count(),
  ]);

  return {
    schemaVersion: Number.parseInt(schemaVersionMeta?.value ?? "2", 10) || 2,
    hasRollbackBackup: backupCount > 0,
    lastMigrationAt: lastMigrationAtMeta?.value ? Number.parseInt(lastMigrationAtMeta.value, 10) : null,
    lastMigrationSource: lastMigrationSourceMeta?.value ?? "unknown",
  };
}

export async function rollbackLatestMigration(): Promise<boolean> {
  const backup = await db.migrationBackups.orderBy("createdAt").last();
  if (!backup) {
    return false;
  }

  await db.transaction(
    "rw",
    [db.goals, db.subGoals, db.projects, db.attachments, db.keyAreas, db.todayAlignment, db.settings, db.meta],
    async (tx) => {
      await writeNormalizedFromPayloads(tx, backup.dataPayload, backup.settingsPayload);
      await putMeta(tx, "schemaVersion", "2");
      await putMeta(tx, "lastMigrationSource", `rollback:${backup.source}`);
      await putMeta(tx, "lastMigrationAt", String(Date.now()));
    }
  );
  return true;
}

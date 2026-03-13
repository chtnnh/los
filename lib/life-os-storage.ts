"use client";

export type LifeArea = "health" | "work" | "relationships" | "financial" | "learning" | "soul";
export type GoalType = "daily" | "weekly" | "monthly";
export type PriorityTag = "low" | "medium" | "high";
export type TimelineTag = "day" | "week" | "month" | "quarter" | "year" | "decade";
export type AttachmentSource = "url" | "local-file-ref" | "embedded-file";

export type AttachmentLink = {
  id: string;
  label: string;
  url: string;
  source: AttachmentSource;
};

export type SubGoalEntry = {
  id: string;
  title: string;
  completed: boolean;
  description: string;
  dueDate: string;
  priority: PriorityTag | "";
  timeline: TimelineTag | "";
  attachments: AttachmentLink[];
  children: SubGoalEntry[];
};

export type GoalEntry = {
  id: string;
  title: string;
  completed: boolean;
  description: string;
  dueDate: string;
  priority: PriorityTag | "";
  timeline: TimelineTag | "";
  areaTags: LifeArea[];
  projectIds: string[];
  attachments: AttachmentLink[];
  subGoals: SubGoalEntry[];
};

export type ProjectEntry = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: PriorityTag | "";
  timeline: TimelineTag | "";
  areaTags: LifeArea[];
  attachments: AttachmentLink[];
};

export type LifeData = {
  visions: Record<LifeArea, string>;
  goals: Record<GoalType, GoalEntry[]>;
  projects: ProjectEntry[];
  todayGoalRef: string;
  todayProjectId: string;
  todayFocus: string;
  energyPlan: string;
};

export const STORAGE_KEY = "life-os-data-v1";

export const AREA_LABELS: Record<LifeArea, string> = {
  health: "Health",
  work: "Work",
  relationships: "Relationships",
  financial: "Financial",
  learning: "Learning",
  soul: "Soul",
};

export const AREA_TAG_CLASSES: Record<LifeArea, string> = {
  health: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
  work: "bg-sky-500/20 text-sky-300 border border-sky-500/40",
  relationships: "bg-rose-500/20 text-rose-300 border border-rose-500/40",
  financial: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
  learning: "bg-violet-500/20 text-violet-300 border border-violet-500/40",
  soul: "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40",
};

export const PRIORITY_LABELS: Record<PriorityTag, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const TIMELINE_LABELS: Record<TimelineTag, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
  decade: "Decade",
};

export const PRIORITY_TAG_CLASSES: Record<PriorityTag, string> = {
  low: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40",
  medium: "bg-amber-500/15 text-amber-300 border border-amber-500/40",
  high: "bg-rose-500/15 text-rose-300 border border-rose-500/40",
};

export const TIMELINE_TAG_CLASS = "bg-indigo-500/15 text-indigo-300 border border-indigo-500/40";

export const defaultLifeData: LifeData = {
  visions: {
    health: "",
    work: "",
    relationships: "",
    financial: "",
    learning: "",
    soul: "",
  },
  goals: {
    daily: [],
    weekly: [],
    monthly: [],
  },
  projects: [],
  todayGoalRef: "",
  todayProjectId: "",
  todayFocus: "",
  energyPlan: "",
};

const LIFE_AREAS: LifeArea[] = ["health", "work", "relationships", "financial", "learning", "soul"];
const GOAL_TYPES: GoalType[] = ["daily", "weekly", "monthly"];

function normalizeAreaTags(value: unknown): LifeArea[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is LifeArea => typeof item === "string" && LIFE_AREAS.includes(item as LifeArea));
}

function normalizeAttachments(value: unknown): AttachmentLink[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): AttachmentLink | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const attachment = item as Partial<AttachmentLink>;
      if (typeof attachment.id !== "string" || typeof attachment.label !== "string" || typeof attachment.url !== "string") {
        return null;
      }

      const source =
        attachment.source === "url" || attachment.source === "local-file-ref" || attachment.source === "embedded-file"
          ? attachment.source
          : "url";

      return {
        id: attachment.id,
        label: attachment.label,
        url: attachment.url,
        source,
      };
    })
    .filter((item): item is AttachmentLink => item !== null);
}

function normalizeGoalEntries(value: unknown): GoalEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizeSubGoals = (subGoalValue: unknown, path = "sub"): SubGoalEntry[] => {
    if (!Array.isArray(subGoalValue)) {
      return [];
    }

    return subGoalValue
      .map((item, index): SubGoalEntry | null => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const subGoal = item as Partial<SubGoalEntry>;
        const priority = subGoal.priority;
        const timeline = subGoal.timeline;
        return {
          id: typeof subGoal.id === "string" && subGoal.id.length > 0 ? subGoal.id : `${path}-${index + 1}`,
          title: typeof subGoal.title === "string" ? subGoal.title : "",
          completed: Boolean(subGoal.completed),
          description: typeof subGoal.description === "string" ? subGoal.description : "",
          dueDate: typeof subGoal.dueDate === "string" ? subGoal.dueDate : "",
          priority: priority === "low" || priority === "medium" || priority === "high" ? priority : "",
          timeline:
            timeline === "day" ||
            timeline === "week" ||
            timeline === "month" ||
            timeline === "quarter" ||
            timeline === "year" ||
            timeline === "decade"
              ? timeline
              : "",
          attachments: normalizeAttachments(subGoal.attachments),
          children: normalizeSubGoals(subGoal.children, `${path}-${index + 1}`),
        };
      })
      .filter((subGoal): subGoal is SubGoalEntry => subGoal !== null);
  };

  return value
    .map((item): GoalEntry | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const goal = item as Partial<GoalEntry>;
      return {
        id: typeof goal.id === "string" ? goal.id : "",
        title: typeof goal.title === "string" ? goal.title : "",
        completed: Boolean(goal.completed),
        description: typeof goal.description === "string" ? goal.description : "",
        dueDate: typeof goal.dueDate === "string" ? goal.dueDate : "",
        priority: goal.priority === "low" || goal.priority === "medium" || goal.priority === "high" ? goal.priority : "",
        timeline:
          goal.timeline === "day" ||
          goal.timeline === "week" ||
          goal.timeline === "month" ||
          goal.timeline === "quarter" ||
          goal.timeline === "year" ||
          goal.timeline === "decade"
            ? goal.timeline
            : "",
        areaTags: normalizeAreaTags(goal.areaTags),
        projectIds: Array.isArray(goal.projectIds)
          ? goal.projectIds.filter((projectId): projectId is string => typeof projectId === "string")
          : [],
        attachments: normalizeAttachments(goal.attachments),
        subGoals: normalizeSubGoals(goal.subGoals, `${typeof goal.id === "string" && goal.id.length > 0 ? goal.id : "goal"}-sub`),
      };
    })
    .filter((goal): goal is GoalEntry => goal !== null && goal.id.length > 0);
}

function normalizeProjectEntries(value: unknown): ProjectEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): ProjectEntry | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const project = item as Partial<ProjectEntry>;
      return {
        id: typeof project.id === "string" ? project.id : "",
        title: typeof project.title === "string" ? project.title : "",
        description: typeof project.description === "string" ? project.description : "",
        dueDate: typeof project.dueDate === "string" ? project.dueDate : "",
        priority:
          project.priority === "low" || project.priority === "medium" || project.priority === "high" ? project.priority : "",
        timeline:
          project.timeline === "day" ||
          project.timeline === "week" ||
          project.timeline === "month" ||
          project.timeline === "quarter" ||
          project.timeline === "year" ||
          project.timeline === "decade"
            ? project.timeline
            : "",
        areaTags: normalizeAreaTags(project.areaTags),
        attachments: normalizeAttachments(project.attachments),
      };
    })
    .filter((project): project is ProjectEntry => project !== null && project.id.length > 0);
}

export function normalizeLifeData(parsed: unknown): LifeData {
  if (!parsed || typeof parsed !== "object") {
    return defaultLifeData;
  }

  const value = parsed as Partial<LifeData>;
  const visionsFromStorage = value.visions && typeof value.visions === "object" ? value.visions : {};
  const goalsFromStorage = value.goals && typeof value.goals === "object" ? value.goals : {};

  const visions = LIFE_AREAS.reduce<Record<LifeArea, string>>((acc, area) => {
    const raw = (visionsFromStorage as Record<string, unknown>)[area];
    acc[area] = typeof raw === "string" ? raw : "";
    return acc;
  }, {} as Record<LifeArea, string>);

  const goals = GOAL_TYPES.reduce<Record<GoalType, GoalEntry[]>>((acc, goalType) => {
    const raw = (goalsFromStorage as Record<string, unknown>)[goalType];
    acc[goalType] = normalizeGoalEntries(raw);
    return acc;
  }, {} as Record<GoalType, GoalEntry[]>);

  return {
    visions,
    goals,
    projects: normalizeProjectEntries(value.projects),
    todayGoalRef: typeof value.todayGoalRef === "string" ? value.todayGoalRef : "",
    todayProjectId: typeof value.todayProjectId === "string" ? value.todayProjectId : "",
    todayFocus: typeof value.todayFocus === "string" ? value.todayFocus : "",
    energyPlan: typeof value.energyPlan === "string" ? value.energyPlan : "",
  };
}

export function loadLifeDataFromStorage(): LifeData {
  if (typeof window === "undefined") {
    return defaultLifeData;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultLifeData;
    }
    return normalizeLifeData(JSON.parse(raw) as unknown);
  } catch {
    return defaultLifeData;
  }
}

export function saveLifeDataToStorage(data: LifeData): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptySubGoal(id: string): SubGoalEntry {
  return {
    id,
    title: "",
    completed: false,
    description: "",
    dueDate: "",
    priority: "",
    timeline: "",
    attachments: [],
    children: [],
  };
}

export function countSubGoalsProgress(subGoals: SubGoalEntry[]): { total: number; completed: number } {
  return subGoals.reduce(
    (acc, subGoal) => {
      const nested = countSubGoalsProgress(subGoal.children);
      return {
        total: acc.total + 1 + nested.total,
        completed: acc.completed + (subGoal.completed ? 1 : 0) + nested.completed,
      };
    },
    { total: 0, completed: 0 }
  );
}

export function syncGoalCompletedWithSubGoals(goal: GoalEntry): GoalEntry {
  const progress = countSubGoalsProgress(goal.subGoals);
  if (progress.total === 0) {
    return goal;
  }
  const allDone = progress.completed === progress.total;
  if (goal.completed === allDone) {
    return goal;
  }
  return { ...goal, completed: allDone };
}

export function updateSubGoalById(subGoals: SubGoalEntry[], subGoalId: string, updater: (subGoal: SubGoalEntry) => SubGoalEntry): SubGoalEntry[] {
  let changed = false;
  const next = subGoals.map((subGoal) => {
    if (subGoal.id === subGoalId) {
      changed = true;
      return updater(subGoal);
    }

    const nextChildren = updateSubGoalById(subGoal.children, subGoalId, updater);
    if (nextChildren !== subGoal.children) {
      changed = true;
      return {
        ...subGoal,
        children: nextChildren,
      };
    }

    return subGoal;
  });

  return changed ? next : subGoals;
}

export function addChildSubGoalById(subGoals: SubGoalEntry[], parentId: string, child: SubGoalEntry): SubGoalEntry[] {
  let changed = false;
  const next = subGoals.map((subGoal) => {
    if (subGoal.id === parentId) {
      changed = true;
      return {
        ...subGoal,
        children: [...subGoal.children, child],
      };
    }

    const nextChildren = addChildSubGoalById(subGoal.children, parentId, child);
    if (nextChildren !== subGoal.children) {
      changed = true;
      return {
        ...subGoal,
        children: nextChildren,
      };
    }
    return subGoal;
  });

  return changed ? next : subGoals;
}

export function removeSubGoalById(subGoals: SubGoalEntry[], subGoalId: string): SubGoalEntry[] {
  let changed = false;
  const next: SubGoalEntry[] = [];

  for (const subGoal of subGoals) {
    if (subGoal.id === subGoalId) {
      changed = true;
      continue;
    }

    const nextChildren = removeSubGoalById(subGoal.children, subGoalId);
    if (nextChildren !== subGoal.children) {
      changed = true;
      next.push({
        ...subGoal,
        children: nextChildren,
      });
      continue;
    }

    next.push(subGoal);
  }

  return changed ? next : subGoals;
}

"use client";

import { Button as HeroButton, Card, CardBody, CardHeader, Chip, Input, Select, SelectItem, Switch, Tab, Tabs, Textarea } from "@heroui/react";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ComponentProps, type KeyboardEvent, type MouseEvent } from "react";

type SafeButtonProps = ComponentProps<typeof HeroButton> & {
  type?: "button" | "submit" | "reset";
};

function Button({ type, ...props }: SafeButtonProps) {
  return <HeroButton {...props} type={type ?? "button"} />;
}

type LifeArea = "health" | "work" | "relationships" | "financial" | "learning" | "soul";
type GoalType = "daily" | "weekly" | "monthly";
type PriorityTag = "low" | "medium" | "high";
type TimelineTag = "week" | "month" | "quarter" | "year" | "decade";
type GoalSortOption = "manual" | "title-asc" | "due-soon" | "priority-high" | "status";
type ProjectSortOption = "manual" | "title-asc" | "due-soon";
type AttachmentSource = "url" | "local-file-ref" | "embedded-file";

type AttachmentLink = {
  id: string;
  label: string;
  url: string;
  source: AttachmentSource;
};

type GoalEntry = {
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
};

type ProjectEntry = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  areaTags: LifeArea[];
  attachments: AttachmentLink[];
};

type GoalFilters = {
  areaTags: LifeArea[];
  projectIds: string[];
};

type AttachmentDraft = {
  label: string;
  url: string;
};

type ProjectDraft = {
  title: string;
  description: string;
  dueDate: string;
  areaTags: LifeArea[];
  attachments: AttachmentLink[];
  attachmentDraft: AttachmentDraft;
};

type UploadTarget =
  | { entity: "goal"; kind: GoalType; goalId: string }
  | { entity: "project"; projectId: string }
  | { entity: "project-draft" }
  | null;

type LifeData = {
  visions: Record<LifeArea, string>;
  goals: Record<GoalType, GoalEntry[]>;
  projects: ProjectEntry[];
  todayGoalRef: string;
  todayProjectId: string;
  todayFocus: string;
  energyPlan: string;
};

const STORAGE_KEY = "life-os-data-v1";
const SETTINGS_STORAGE_KEY = "life-os-settings-v1";
const MAX_SINGLE_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const MAX_UPLOAD_BATCH_BYTES = 3 * 1024 * 1024;

type AppSettings = {
  autosaveEnabled: boolean;
  autosaveSeconds: number;
  showAutosaveToast: boolean;
};
type SectionKey = "vision" | "goals" | "today" | "projects" | "note";

const AREA_LABELS: Record<LifeArea, string> = {
  health: "Health",
  work: "Work",
  relationships: "Relationships",
  financial: "Financial",
  learning: "Learning",
  soul: "Soul",
};

const AREA_TAG_CLASSES: Record<LifeArea, string> = {
  health: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
  work: "bg-sky-500/20 text-sky-300 border border-sky-500/40",
  relationships: "bg-rose-500/20 text-rose-300 border border-rose-500/40",
  financial: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
  learning: "bg-violet-500/20 text-violet-300 border border-violet-500/40",
  soul: "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40",
};

const PRIORITY_LABELS: Record<PriorityTag, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const TIMELINE_LABELS: Record<TimelineTag, string> = {
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
  decade: "Decade",
};

const GOAL_LABELS: Record<GoalType, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const GOAL_SORT_LABELS: Record<GoalSortOption, string> = {
  manual: "Manual",
  "title-asc": "Title (A-Z)",
  "due-soon": "Due date (soonest)",
  "priority-high": "Priority (high first)",
  status: "Status (open first)",
};

const PROJECT_SORT_LABELS: Record<ProjectSortOption, string> = {
  manual: "Manual",
  "title-asc": "Title (A-Z)",
  "due-soon": "Due date (soonest)",
};

const EMPTY_ATTACHMENT_DRAFT: AttachmentDraft = { label: "", url: "" };

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toggleInArray<T>(items: T[], value: T): T[] {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

function normalizeLocalFilePathToUrl(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return `file:///${encodeURI(normalized)}`;
  }
  return `file://${encodeURI(normalized)}`;
}

function normalizeAttachmentInput(raw: string): string {
  const value = raw.trim();
  if (!value) {
    return "";
  }

  const isUnixAbsolutePath = value.startsWith("/");
  const isWindowsAbsolutePath = /^[a-zA-Z]:[\\/]/.test(value);
  if (isUnixAbsolutePath || isWindowsAbsolutePath) {
    return normalizeLocalFilePathToUrl(value);
  }

  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
  if (hasScheme || value.startsWith("//")) {
    return value.startsWith("//") ? `https:${value}` : value;
  }

  // Accept plain domains like "example.com/path" by defaulting to https.
  const looksLikeDomain = /^[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(value);
  return looksLikeDomain ? `https://${value}` : value;
}

function isSafeDataUrl(value: string): boolean {
  const match = value.match(/^data:([^;,]+)(;base64)?,/i);
  if (!match) {
    return false;
  }

  const mime = match[1].toLowerCase();
  const isBase64 = Boolean(match[2]);
  const blockedMimeTypes = new Set(["text/html", "application/xhtml+xml", "image/svg+xml"]);

  return isBase64 && !blockedMimeTypes.has(mime);
}

function sanitizeAttachmentUrl(raw: string): string {
  const value = normalizeAttachmentInput(raw);
  if (!value) {
    return "";
  }

  const lower = value.toLowerCase();
  if (lower.startsWith("javascript:")) {
    return "";
  }

  if (lower.startsWith("data:")) {
    return isSafeDataUrl(value) ? value : "";
  }

  if (
    lower.startsWith("https://") ||
    lower.startsWith("http://") ||
    lower.startsWith("file://") ||
    lower.startsWith("local-file://")
  ) {
    return value;
  }

  return "";
}

function sanitizeAttachment(attachment: AttachmentLink): AttachmentLink | null {
  const safeUrl = sanitizeAttachmentUrl(attachment.url);
  const label = attachment.label.trim();

  if (!safeUrl || !label) {
    return null;
  }

  const source: AttachmentSource = safeUrl.startsWith("local-file://")
    ? "local-file-ref"
    : safeUrl.startsWith("data:")
      ? "embedded-file"
      : "url";

  return {
    id: attachment.id,
    label,
    url: safeUrl,
    source,
  };
}

function sanitizeAttachments(attachments: AttachmentLink[]): AttachmentLink[] {
  return attachments
    .map((attachment) => sanitizeAttachment(attachment))
    .filter((attachment): attachment is AttachmentLink => attachment !== null);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function fileToAttachment(file: File): Promise<AttachmentLink | null> {
  const dataUrl = await readFileAsDataUrl(file);
  const safeUrl = sanitizeAttachmentUrl(dataUrl);
  if (!safeUrl) {
    return null;
  }

  return {
    id: createId("attachment"),
    label: file.name,
    url: safeUrl,
    source: "embedded-file",
  };
}

function createEmptyGoal(id: string): GoalEntry {
  return {
    id,
    title: "",
    completed: false,
    description: "",
    dueDate: "",
    priority: "",
    timeline: "",
    areaTags: [],
    projectIds: [],
    attachments: [],
  };
}

function createDefaultGoals(kind: GoalType): GoalEntry[] {
  return [
    createEmptyGoal(`${kind}-1`),
    createEmptyGoal(`${kind}-2`),
    createEmptyGoal(`${kind}-3`),
  ];
}

function createEmptyProjectDraft(): ProjectDraft {
  return {
    title: "",
    description: "",
    dueDate: "",
    areaTags: [],
    attachments: [],
    attachmentDraft: { ...EMPTY_ATTACHMENT_DRAFT },
  };
}

const defaultData: LifeData = {
  visions: {
    health: "",
    work: "",
    relationships: "",
    financial: "",
    learning: "",
    soul: "",
  },
  goals: {
    daily: createDefaultGoals("daily"),
    weekly: createDefaultGoals("weekly"),
    monthly: createDefaultGoals("monthly"),
  },
  projects: [],
  todayGoalRef: "",
  todayProjectId: "",
  todayFocus: "",
  energyPlan: "",
};

const defaultSettings: AppSettings = {
  autosaveEnabled: true,
  autosaveSeconds: 60,
  showAutosaveToast: false,
};

function clampAutosaveSeconds(seconds: number): number {
  return Math.min(600, Math.max(15, seconds));
}

function compareDueDate(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

function sortGoalEntries(items: GoalEntry[], sortBy: GoalSortOption): GoalEntry[] {
  if (sortBy === "manual") {
    return items;
  }

  const priorityRank: Record<PriorityTag, number> = { high: 0, medium: 1, low: 2 };
  const copy = [...items];

  copy.sort((a, b) => {
    if (sortBy === "title-asc") {
      return a.title.localeCompare(b.title);
    }
    if (sortBy === "due-soon") {
      return compareDueDate(a.dueDate, b.dueDate);
    }
    if (sortBy === "priority-high") {
      const aRank = a.priority ? priorityRank[a.priority] : 99;
      const bRank = b.priority ? priorityRank[b.priority] : 99;
      if (aRank !== bRank) {
        return aRank - bRank;
      }
      return a.title.localeCompare(b.title);
    }
    if (sortBy === "status") {
      if (a.completed !== b.completed) {
        return Number(a.completed) - Number(b.completed);
      }
      return a.title.localeCompare(b.title);
    }
    return 0;
  });

  return copy;
}

function sortProjectEntries(items: ProjectEntry[], sortBy: ProjectSortOption): ProjectEntry[] {
  if (sortBy === "manual") {
    return items;
  }

  const copy = [...items];
  copy.sort((a, b) => {
    if (sortBy === "title-asc") {
      return a.title.localeCompare(b.title);
    }
    if (sortBy === "due-soon") {
      return compareDueDate(a.dueDate, b.dueDate);
    }
    return 0;
  });
  return copy;
}

function normalizeSettings(parsed: unknown): AppSettings {
  if (!parsed || typeof parsed !== "object") {
    return defaultSettings;
  }

  const value = parsed as {
    autosaveEnabled?: unknown;
    autosaveSeconds?: unknown;
    showAutosaveToast?: unknown;
  };

  const interval =
    typeof value.autosaveSeconds === "number" && Number.isFinite(value.autosaveSeconds)
      ? clampAutosaveSeconds(Math.round(value.autosaveSeconds))
      : defaultSettings.autosaveSeconds;

  return {
    autosaveEnabled: typeof value.autosaveEnabled === "boolean" ? value.autosaveEnabled : defaultSettings.autosaveEnabled,
    autosaveSeconds: interval,
    showAutosaveToast: typeof value.showAutosaveToast === "boolean" ? value.showAutosaveToast : defaultSettings.showAutosaveToast,
  };
}

function normalizeAttachment(attachment: unknown, index: number): AttachmentLink | null {
  if (typeof attachment === "string") {
    const safeUrl = sanitizeAttachmentUrl(attachment);
    if (!safeUrl) {
      return null;
    }

    return {
      id: `attachment-${index + 1}`,
      label: `attachment ${index + 1}`,
      url: safeUrl,
      source: safeUrl.startsWith("local-file://") ? "local-file-ref" : "url",
    };
  }

  if (!attachment || typeof attachment !== "object") {
    return null;
  }

  const value = attachment as {
    id?: string;
    label?: string;
    url?: string;
    source?: string;
  };

  const safeUrl = sanitizeAttachmentUrl(value.url ?? "");
  if (!safeUrl) {
    return null;
  }

  const source: AttachmentSource =
    value.source === "embedded-file" || safeUrl.startsWith("data:")
      ? "embedded-file"
      : value.source === "local-file-ref" || safeUrl.startsWith("local-file://")
        ? "local-file-ref"
        : "url";

  return {
    id: typeof value.id === "string" && value.id.length > 0 ? value.id : `attachment-${index + 1}`,
    label: typeof value.label === "string" && value.label.trim().length > 0 ? value.label.trim() : `attachment ${index + 1}`,
    url: safeUrl,
    source,
  };
}

function normalizeGoal(goal: unknown, kind: GoalType, index: number): GoalEntry {
  const fallbackId = `${kind}-${index + 1}`;

  if (typeof goal === "string") {
    return {
      ...createEmptyGoal(fallbackId),
      title: goal,
    };
  }

  if (!goal || typeof goal !== "object") {
    return createEmptyGoal(fallbackId);
  }

  const value = goal as {
    id?: string;
    title?: string;
    completed?: unknown;
    description?: string;
    dueDate?: string;
    priority?: string;
    timeline?: string;
    areaTags?: string[];
    projectIds?: string[];
    attachments?: unknown[];
  };

  const priority = value.priority;
  const timeline = value.timeline;

  return {
    id: typeof value.id === "string" && value.id.length > 0 ? value.id : fallbackId,
    title: typeof value.title === "string" ? value.title : "",
    completed: typeof value.completed === "boolean" ? value.completed : false,
    description: typeof value.description === "string" ? value.description : "",
    dueDate: typeof value.dueDate === "string" ? value.dueDate : "",
    priority: priority === "low" || priority === "medium" || priority === "high" ? priority : "",
    timeline:
      timeline === "week" || timeline === "month" || timeline === "quarter" || timeline === "year" || timeline === "decade"
        ? timeline
        : "",
    areaTags: Array.isArray(value.areaTags)
      ? value.areaTags.filter((tag): tag is LifeArea =>
          tag === "health" ||
          tag === "work" ||
          tag === "relationships" ||
          tag === "financial" ||
          tag === "learning" ||
          tag === "soul"
        )
      : [],
    projectIds: Array.isArray(value.projectIds)
      ? value.projectIds.filter((projectId): projectId is string => typeof projectId === "string")
      : [],
    attachments: Array.isArray(value.attachments)
      ? value.attachments
          .map((attachment, attachmentIndex) => normalizeAttachment(attachment, attachmentIndex))
          .filter((attachment): attachment is AttachmentLink => attachment !== null)
      : [],
  };
}

function normalizeGoals(source: unknown, kind: GoalType): GoalEntry[] {
  if (!Array.isArray(source)) {
    return createDefaultGoals(kind);
  }

  const items = source.map((goal, index) => normalizeGoal(goal, kind, index));
  return items.length > 0 ? items : [createEmptyGoal(`${kind}-1`)];
}

function normalizeProject(project: unknown, index: number): ProjectEntry | null {
  if (!project || typeof project !== "object") {
    return null;
  }

  const value = project as {
    id?: string;
    title?: string;
    description?: string;
    dueDate?: string;
    areaTags?: string[];
    attachments?: unknown[];
  };

  if (typeof value.title !== "string" || value.title.trim().length === 0) {
    return null;
  }

  return {
    id: typeof value.id === "string" && value.id.length > 0 ? value.id : `project-${index + 1}`,
    title: value.title,
    description: typeof value.description === "string" ? value.description : "",
    dueDate: typeof value.dueDate === "string" ? value.dueDate : "",
    areaTags: Array.isArray(value.areaTags)
      ? value.areaTags.filter((tag): tag is LifeArea =>
          tag === "health" ||
          tag === "work" ||
          tag === "relationships" ||
          tag === "financial" ||
          tag === "learning" ||
          tag === "soul"
        )
      : [],
    attachments: Array.isArray(value.attachments)
      ? value.attachments
          .map((attachment, attachmentIndex) => normalizeAttachment(attachment, attachmentIndex))
          .filter((attachment): attachment is AttachmentLink => attachment !== null)
      : [],
  };
}

function normalizeData(parsed: unknown): LifeData {
  if (!parsed || typeof parsed !== "object") {
    return defaultData;
  }

  const value = parsed as {
    visions?: Record<string, string>;
    goals?: Record<string, unknown>;
    projects?: unknown[];
    todayGoalRef?: string;
    todayProjectId?: string;
    todayFocus?: string;
    energyPlan?: string;
  };

  return {
    visions: {
      health: value.visions?.health ?? "",
      work: value.visions?.work ?? "",
      relationships: value.visions?.relationships ?? "",
      financial: value.visions?.financial ?? value.visions?.money ?? "",
      learning: value.visions?.learning ?? value.visions?.mind ?? "",
      soul: value.visions?.soul ?? "",
    },
    goals: {
      daily: normalizeGoals(value.goals?.daily, "daily"),
      weekly: normalizeGoals(value.goals?.weekly, "weekly"),
      monthly: normalizeGoals(value.goals?.monthly, "monthly"),
    },
    projects: Array.isArray(value.projects)
      ? value.projects
          .map((project, index) => normalizeProject(project, index))
          .filter((project): project is ProjectEntry => project !== null)
      : [],
    todayGoalRef: value.todayGoalRef ?? "",
    todayProjectId: value.todayProjectId ?? "",
    todayFocus: value.todayFocus ?? "",
    energyPlan: value.energyPlan ?? "",
  };
}

function sanitizeDataForStorage(data: LifeData): LifeData {
  return {
    visions: {
      health: data.visions.health.trim(),
      work: data.visions.work.trim(),
      relationships: data.visions.relationships.trim(),
      financial: data.visions.financial.trim(),
      learning: data.visions.learning.trim(),
      soul: data.visions.soul.trim(),
    },
    goals: {
      daily: data.goals.daily.map((goal) => ({
        ...goal,
        title: goal.title.trim(),
        description: goal.description.trim(),
        dueDate: goal.dueDate.trim(),
        attachments: sanitizeAttachments(goal.attachments),
      })),
      weekly: data.goals.weekly.map((goal) => ({
        ...goal,
        title: goal.title.trim(),
        description: goal.description.trim(),
        dueDate: goal.dueDate.trim(),
        attachments: sanitizeAttachments(goal.attachments),
      })),
      monthly: data.goals.monthly.map((goal) => ({
        ...goal,
        title: goal.title.trim(),
        description: goal.description.trim(),
        dueDate: goal.dueDate.trim(),
        attachments: sanitizeAttachments(goal.attachments),
      })),
    },
    projects: data.projects.map((project) => ({
      ...project,
      title: project.title.trim(),
      description: project.description.trim(),
      dueDate: project.dueDate.trim(),
      attachments: sanitizeAttachments(project.attachments),
    })),
    todayGoalRef: data.todayGoalRef.trim(),
    todayProjectId: data.todayProjectId.trim(),
    todayFocus: data.todayFocus.trim(),
    energyPlan: data.energyPlan.trim(),
  };
}

export default function Home() {
  const [data, setData] = useState<LifeData>(defaultData);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [filters, setFilters] = useState<GoalFilters>({ areaTags: [], projectIds: [] });
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(createEmptyProjectDraft);
  const [goalAttachmentDrafts, setGoalAttachmentDrafts] = useState<Record<string, AttachmentDraft>>({});
  const [projectAttachmentDrafts, setProjectAttachmentDrafts] = useState<Record<string, AttachmentDraft>>({});
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string>(JSON.stringify(defaultData));
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<UploadTarget>(null);
  const [goalsEditMode, setGoalsEditMode] = useState(false);
  const [activeGoalEditorRef, setActiveGoalEditorRef] = useState<string | null>(null);
  const [projectsEditMode, setProjectsEditMode] = useState(false);
  const [activeProjectEditorId, setActiveProjectEditorId] = useState<string | null>(null);
  const [goalSort, setGoalSort] = useState<GoalSortOption>("manual");
  const [projectSort, setProjectSort] = useState<ProjectSortOption>("manual");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<SectionKey, boolean>>({
    vision: false,
    goals: false,
    today: false,
    projects: false,
    note: false,
  });

  const filePickerRef = useRef<HTMLInputElement | null>(null);
  const dataRef = useRef<LifeData>(defaultData);
  const hasUnsavedRef = useRef(false);

  const toggleSection = useCallback((section: SectionKey) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const allSectionsCollapsed = useMemo(
    () => Object.values(collapsedSections).every(Boolean),
    [collapsedSections]
  );

  const toggleAllSections = useCallback(() => {
    const nextCollapsed = !allSectionsCollapsed;
    setCollapsedSections({
      vision: nextCollapsed,
      goals: nextCollapsed,
      today: nextCollapsed,
      projects: nextCollapsed,
      note: nextCollapsed,
    });
  }, [allSectionsCollapsed]);

  const preventEnterSubmit = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const loadedData = raw ? normalizeData(JSON.parse(raw) as unknown) : defaultData;
      setData(loadedData);
      dataRef.current = loadedData;
      setLastSavedSnapshot(JSON.stringify(loadedData));

      const rawSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      setSettings(rawSettings ? normalizeSettings(JSON.parse(rawSettings) as unknown) : defaultSettings);
    } catch {
      setData(defaultData);
      dataRef.current = defaultData;
      setLastSavedSnapshot(JSON.stringify(defaultData));
      setSettings(defaultSettings);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = setTimeout(() => setToastMessage(""), 2200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const hasUnsavedChanges = useMemo(() => {
    if (!isLoaded) {
      return false;
    }

    return JSON.stringify(data) !== lastSavedSnapshot;
  }, [data, isLoaded, lastSavedSnapshot]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    hasUnsavedRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [isLoaded, settings]);

  const filledCount = useMemo(() => {
    const visionCount = Object.values(data.visions).filter((v) => v.trim().length > 0).length;
    const goalCount = Object.values(data.goals)
      .flat()
      .filter((goal) => goal.title.trim().length > 0).length;
    const projectCount = data.projects.filter((project) => project.title.trim().length > 0).length;
    const otherCount = [data.todayFocus, data.energyPlan].filter((v) => v.trim().length > 0).length;
    return visionCount + goalCount + projectCount + otherCount;
  }, [data]);

  const filteredGoals = useMemo(() => {
    const matchesFilter = (goal: GoalEntry) => {
      const areaMatch =
        filters.areaTags.length === 0 || filters.areaTags.some((filterTag) => goal.areaTags.includes(filterTag));
      const projectMatch =
        filters.projectIds.length === 0 || filters.projectIds.some((filterTag) => goal.projectIds.includes(filterTag));
      return areaMatch && projectMatch;
    };

    return {
      daily: data.goals.daily.filter(matchesFilter),
      weekly: data.goals.weekly.filter(matchesFilter),
      monthly: data.goals.monthly.filter(matchesFilter),
    } satisfies Record<GoalType, GoalEntry[]>;
  }, [data.goals, filters]);

  const goalReferenceOptions = useMemo(
    () =>
      (Object.keys(GOAL_LABELS) as GoalType[]).flatMap((kind) =>
        data.goals[kind].map((goal) => ({
          ref: `${kind}:${goal.id}`,
          label: `${GOAL_LABELS[kind]} - ${goal.title.trim() || "untitled goal"}`,
        }))
      ),
    [data.goals]
  );

  const sortedGoals = useMemo(
    () => ({
      daily: sortGoalEntries(filteredGoals.daily, goalSort),
      weekly: sortGoalEntries(filteredGoals.weekly, goalSort),
      monthly: sortGoalEntries(filteredGoals.monthly, goalSort),
    }),
    [filteredGoals, goalSort]
  );

  const sortedProjects = useMemo(() => sortProjectEntries(data.projects, projectSort), [data.projects, projectSort]);

  const updateGoal = (kind: GoalType, goalId: string, updater: (goal: GoalEntry) => GoalEntry) => {
    setData((prev) => ({
      ...prev,
      goals: {
        ...prev.goals,
        [kind]: prev.goals[kind].map((goal) => (goal.id === goalId ? updater(goal) : goal)),
      },
    }));
  };

  const updateProject = (projectId: string, updater: (project: ProjectEntry) => ProjectEntry) => {
    setData((prev) => ({
      ...prev,
      projects: prev.projects.map((project) => (project.id === projectId ? updater(project) : project)),
    }));
  };

  const addGoal = (kind: GoalType) => {
    const id = createId(`goal-${kind}`);
    setData((prev) => ({
      ...prev,
      goals: {
        ...prev.goals,
        [kind]: [...prev.goals[kind], createEmptyGoal(id)],
      },
    }));
  };

  const removeGoal = (kind: GoalType, goalId: string) => {
    const refToRemove = `${kind}:${goalId}`;
    setData((prev) => ({
      ...prev,
      goals: {
        ...prev.goals,
        [kind]:
          prev.goals[kind].length === 1 ? prev.goals[kind] : prev.goals[kind].filter((goal) => goal.id !== goalId),
      },
      todayGoalRef: prev.todayGoalRef === refToRemove ? "" : prev.todayGoalRef,
    }));
  };

  const addProject = () => {
    if (projectDraft.title.trim().length === 0) {
      return;
    }

    const projectId = createId("project");

    setData((prev) => ({
      ...prev,
      projects: [
        ...prev.projects,
        {
          id: projectId,
          title: projectDraft.title.trim(),
          description: projectDraft.description.trim(),
          dueDate: projectDraft.dueDate,
          areaTags: projectDraft.areaTags,
          attachments: sanitizeAttachments(projectDraft.attachments),
        },
      ],
    }));

    setProjectDraft(createEmptyProjectDraft());
    setShowProjectForm(false);
  };

  const removeProject = (projectId: string) => {
    setData((prev) => ({
      ...prev,
      projects: prev.projects.filter((project) => project.id !== projectId),
      goals: {
        daily: prev.goals.daily.map((goal) => ({
          ...goal,
          projectIds: goal.projectIds.filter((id) => id !== projectId),
        })),
        weekly: prev.goals.weekly.map((goal) => ({
          ...goal,
          projectIds: goal.projectIds.filter((id) => id !== projectId),
        })),
        monthly: prev.goals.monthly.map((goal) => ({
          ...goal,
          projectIds: goal.projectIds.filter((id) => id !== projectId),
        })),
      },
      todayProjectId: prev.todayProjectId === projectId ? "" : prev.todayProjectId,
    }));

    setFilters((prev) => ({
      ...prev,
      projectIds: prev.projectIds.filter((id) => id !== projectId),
    }));
  };

  const persistData = useCallback(
    (sourceData: LifeData, mode: "manual" | "autosave") => {
      try {
        const safeData = sanitizeDataForStorage(sourceData);
        const serialized = JSON.stringify(safeData);

        localStorage.setItem(STORAGE_KEY, serialized);
        setData(safeData);
        dataRef.current = safeData;
        setLastSavedSnapshot(serialized);
        setLastSavedAt(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        );

        if (mode === "manual") {
          setToastMessage("saved to your browser storage");
        } else if (settings.showAutosaveToast) {
          setToastMessage("autosaved");
        }
      } catch {
        setToastMessage("save failed. storage is full or blocked.");
      }
    },
    [settings.showAutosaveToast]
  );

  const saveChanges = () => {
    persistData(dataRef.current, "manual");
  };

  useEffect(() => {
    if (!isLoaded || !settings.autosaveEnabled) {
      return;
    }

    const timer = setInterval(() => {
      if (!hasUnsavedRef.current) {
        return;
      }

      persistData(dataRef.current, "autosave");
    }, settings.autosaveSeconds * 1000);

    return () => clearInterval(timer);
  }, [isLoaded, persistData, settings.autosaveEnabled, settings.autosaveSeconds]);

  const goalDraftKey = (kind: GoalType, goalId: string) => `${kind}:${goalId}`;

  const setGoalAttachmentDraft = (kind: GoalType, goalId: string, updater: (draft: AttachmentDraft) => AttachmentDraft) => {
    const key = goalDraftKey(kind, goalId);
    setGoalAttachmentDrafts((prev) => ({
      ...prev,
      [key]: updater(prev[key] ?? { ...EMPTY_ATTACHMENT_DRAFT }),
    }));
  };

  const addGoalAttachmentLink = (kind: GoalType, goalId: string) => {
    const key = goalDraftKey(kind, goalId);
    const draft = goalAttachmentDrafts[key] ?? EMPTY_ATTACHMENT_DRAFT;
    const safeUrl = sanitizeAttachmentUrl(draft.url);

    if (!safeUrl) {
      setToastMessage("enter a valid link (https/file) or a plain domain like example.com");
      return;
    }

    const label = draft.label.trim() || safeUrl.replace(/^https?:\/\//, "").slice(0, 40);
    updateGoal(kind, goalId, (goal) => ({
      ...goal,
      attachments: [
        ...goal.attachments,
        {
          id: createId("goal-attachment"),
          label,
          url: safeUrl,
          source: safeUrl.startsWith("data:")
            ? "embedded-file"
            : safeUrl.startsWith("local-file://")
              ? "local-file-ref"
              : "url",
        },
      ],
    }));

    setGoalAttachmentDrafts((prev) => ({
      ...prev,
      [key]: { ...EMPTY_ATTACHMENT_DRAFT },
    }));
  };

  const removeGoalAttachment = (kind: GoalType, goalId: string, attachmentId: string) => {
    updateGoal(kind, goalId, (goal) => ({
      ...goal,
      attachments: goal.attachments.filter((attachment) => attachment.id !== attachmentId),
    }));
  };

  const addProjectAttachmentLink = (projectId: string) => {
    const draft = projectAttachmentDrafts[projectId] ?? EMPTY_ATTACHMENT_DRAFT;
    const safeUrl = sanitizeAttachmentUrl(draft.url);

    if (!safeUrl) {
      setToastMessage("enter a valid link (https/file) or a plain domain like example.com");
      return;
    }

    const label = draft.label.trim() || safeUrl.replace(/^https?:\/\//, "").slice(0, 40);
    updateProject(projectId, (project) => ({
      ...project,
      attachments: [
        ...project.attachments,
        {
          id: createId("project-attachment"),
          label,
          url: safeUrl,
          source: safeUrl.startsWith("data:")
            ? "embedded-file"
            : safeUrl.startsWith("local-file://")
              ? "local-file-ref"
              : "url",
        },
      ],
    }));

    setProjectAttachmentDrafts((prev) => ({
      ...prev,
      [projectId]: { ...EMPTY_ATTACHMENT_DRAFT },
    }));
  };

  const removeProjectAttachment = (projectId: string, attachmentId: string) => {
    updateProject(projectId, (project) => ({
      ...project,
      attachments: project.attachments.filter((attachment) => attachment.id !== attachmentId),
    }));
  };

  const addProjectDraftAttachmentLink = () => {
    const safeUrl = sanitizeAttachmentUrl(projectDraft.attachmentDraft.url);

    if (!safeUrl) {
      setToastMessage("enter a valid link (https/file) or a plain domain like example.com");
      return;
    }

    const label = projectDraft.attachmentDraft.label.trim() || safeUrl.replace(/^https?:\/\//, "").slice(0, 40);

    setProjectDraft((prev) => ({
      ...prev,
      attachments: [
        ...prev.attachments,
        {
          id: createId("project-draft-attachment"),
          label,
          url: safeUrl,
          source: safeUrl.startsWith("data:")
            ? "embedded-file"
            : safeUrl.startsWith("local-file://")
              ? "local-file-ref"
              : "url",
        },
      ],
      attachmentDraft: { ...EMPTY_ATTACHMENT_DRAFT },
    }));
  };

  const removeProjectDraftAttachment = (attachmentId: string) => {
    setProjectDraft((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((attachment) => attachment.id !== attachmentId),
    }));
  };

  const openFileUpload = (target: UploadTarget) => {
    setUploadTarget(target);
    filePickerRef.current?.click();
  };

  const handleAttachmentFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";

    if (!uploadTarget || files.length === 0) {
      return;
    }

    try {
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      if (totalBytes > MAX_UPLOAD_BATCH_BYTES) {
        setToastMessage("upload batch is too large for browser storage");
        return;
      }

      const oversized = files.find((file) => file.size > MAX_SINGLE_ATTACHMENT_BYTES);
      if (oversized) {
        setToastMessage(`${oversized.name} is too large. keep files under 2MB.`);
        return;
      }

      const converted = await Promise.all(files.map((file) => fileToAttachment(file)));
      const attachments = converted.filter((attachment): attachment is AttachmentLink => attachment !== null);
      if (attachments.length === 0) {
        setToastMessage("those files couldn’t be attached");
        return;
      }

      if (uploadTarget.entity === "goal") {
        updateGoal(uploadTarget.kind, uploadTarget.goalId, (goal) => ({
          ...goal,
          attachments: [...goal.attachments, ...attachments],
        }));
      }

      if (uploadTarget.entity === "project") {
        updateProject(uploadTarget.projectId, (project) => ({
          ...project,
          attachments: [...project.attachments, ...attachments],
        }));
      }

      if (uploadTarget.entity === "project-draft") {
        setProjectDraft((prev) => ({
          ...prev,
          attachments: [...prev.attachments, ...attachments],
        }));
      }

      setToastMessage(`${attachments.length} attachment${attachments.length > 1 ? "s" : ""} added`);
    } catch {
      setToastMessage("couldn’t attach file. try a smaller file or link.");
    } finally {
      setUploadTarget(null);
    }
  };

  const openAttachment = (attachment: AttachmentLink) => {
    const openFileUrl = (rawUrl: string) => {
      const normalizedUrl = rawUrl.startsWith("file:///")
        ? rawUrl
        : rawUrl.startsWith("file://")
          ? `file:///${rawUrl.replace(/^file:\/+/, "")}`
          : rawUrl;

      const opened = window.open(normalizedUrl, "_blank", "noopener,noreferrer");
      if (!opened) {
        setToastMessage("browser blocked local-file opening. allow popups for localhost.");
      }
    };

    if (attachment.url.startsWith("https://") || attachment.url.startsWith("http://") || attachment.url.startsWith("data:")) {
      window.open(attachment.url, "_blank", "noopener,noreferrer");
      return;
    }

    if (attachment.url.startsWith("file://")) {
      openFileUrl(attachment.url);
      return;
    }

    if (attachment.url.startsWith("local-file://")) {
      const guessedPath = decodeURIComponent(attachment.url.replace("local-file://", ""));
      openFileUrl(`file:///${guessedPath.replace(/^\/+/, "")}`);
      return;
    }

    setToastMessage("this attachment format cannot be opened yet");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-[family-name:var(--font-space-grotesk)]">
      <input ref={filePickerRef} type="file" multiple className="hidden" onChange={handleAttachmentFileUpload} />
      {toastMessage && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-5 right-5 z-50 rounded-xl border border-teal-500/40 bg-zinc-900 px-4 py-2 text-sm text-teal-200 shadow-lg"
        >
          {toastMessage}
        </motion.div>
      )}

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="mb-8 flex flex-wrap items-center justify-between gap-4"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">carbon&apos;s system</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">life operating system</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Chip variant="flat" className="bg-zinc-800 text-zinc-200">
              {filledCount} entries filled
            </Chip>
            <Chip
              variant="flat"
              className={
                hasUnsavedChanges
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              }
            >
              {hasUnsavedChanges ? "unsaved changes" : "all saved"}
            </Chip>
            <Button
              size="sm"
              variant="flat"
              className="bg-teal-500/20 text-teal-300"
              isDisabled={!hasUnsavedChanges}
              onPress={saveChanges}
            >
              save changes
            </Button>
            <Button
              size="sm"
              variant="flat"
              className="bg-zinc-800 text-zinc-200"
              onPress={toggleAllSections}
            >
              {allSectionsCollapsed ? "expand all" : "collapse all"}
            </Button>
            {/* 
            <Button
              size="sm"
              variant="flat"
              className="bg-zinc-800 text-zinc-200"
              onPress={() => setData(defaultData)}
            >
              reset
            </Button>
            */}
            <div className="relative">
              <Button
                size="md"
                variant="flat"
                isIconOnly
                aria-label="settings"
                className="h-12 w-12 border-0 bg-zinc-700 text-zinc-100 shadow-none"
                onPress={() => setShowSettingsMenu((prev) => !prev)}
              >
                <span className="text-2xl leading-none">⚙</span>
              </Button>

              {showSettingsMenu && (
                <div className="absolute right-0 top-11 z-40 w-80 space-y-4 rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-xl">
                  <p className="text-sm font-medium text-zinc-200">settings</p>

                  <Switch
                    isSelected={settings.autosaveEnabled}
                    onValueChange={(value) => setSettings((prev) => ({ ...prev, autosaveEnabled: value }))}
                    classNames={{ label: "text-zinc-200" }}
                  >
                    autosave enabled
                  </Switch>

                  <Select
                    label="autosave interval"
                    labelPlacement="outside"
                    variant="bordered"
                    selectedKeys={[String(settings.autosaveSeconds)]}
                    renderValue={(items) => (
                      <span className="text-zinc-100">{items.map((item) => item.textValue).join(", ")}</span>
                    )}
                    onSelectionChange={(keys) => {
                      const selected = Array.from(keys as Set<string>)[0]?.toString() ?? String(defaultSettings.autosaveSeconds);
                      const parsed = Number.parseInt(selected, 10);
                      if (!Number.isNaN(parsed)) {
                        setSettings((prev) => ({ ...prev, autosaveSeconds: clampAutosaveSeconds(parsed) }));
                      }
                    }}
                    classNames={{
                      trigger: "!bg-zinc-950 !text-zinc-100 border-zinc-700 data-[hover=true]:border-zinc-500",
                      value: "!text-zinc-100",
                      label: "text-zinc-400",
                      selectorIcon: "text-zinc-400",
                      listboxWrapper: "bg-zinc-900 text-zinc-100",
                      popoverContent: "bg-zinc-900 border border-zinc-700",
                    }}
                  >
                    <SelectItem key="30" className="text-zinc-100">every 30 seconds</SelectItem>
                    <SelectItem key="60" className="text-zinc-100">every 1 minute</SelectItem>
                    <SelectItem key="120" className="text-zinc-100">every 2 minutes</SelectItem>
                    <SelectItem key="300" className="text-zinc-100">every 5 minutes</SelectItem>
                  </Select>

                  <Switch
                    isSelected={settings.showAutosaveToast}
                    onValueChange={(value) => setSettings((prev) => ({ ...prev, showAutosaveToast: value }))}
                    classNames={{ label: "text-zinc-200" }}
                  >
                    show autosave toasts
                  </Switch>
                </div>
              )}
            </div>
            {lastSavedAt && <span className="text-xs text-zinc-500">last saved {lastSavedAt}</span>}
          </div>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
            className="space-y-6"
          >
            <Card className="border border-zinc-800 bg-zinc-900/80 text-zinc-100">
              <CardHeader className="py-4">
                <div className="flex w-full items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-medium">vision dashboard</h2>
                    <p className="mt-1 text-sm text-zinc-400">all key areas in one view</p>
                  </div>
                  <Button
                    size="sm"
                    variant="light"
                    className="text-zinc-400"
                    onPress={() => toggleSection("vision")}
                  >
                    {collapsedSections.vision ? "expand" : "collapse"}
                  </Button>
                </div>
              </CardHeader>
              {!collapsedSections.vision && (
                <CardBody className="pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {(Object.keys(AREA_LABELS) as LifeArea[]).map((area) => (
                    <Card key={area} className="border border-zinc-800 bg-zinc-950/60 shadow-none">
                      <CardHeader className="pb-2">
                        <Chip variant="flat" className={AREA_TAG_CLASSES[area]}>
                          {AREA_LABELS[area]}
                        </Chip>
                      </CardHeader>
                      <CardBody>
                        <Textarea
                          minRows={3}
                          variant="bordered"
                          value={data.visions[area]}
                          onValueChange={(value) =>
                            setData((prev) => ({
                              ...prev,
                              visions: { ...prev.visions, [area]: value },
                            }))
                          }
                          classNames={{
                            inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
                            input: "text-zinc-100 placeholder:text-zinc-500",
                          }}
                          placeholder={`vision for ${AREA_LABELS[area].toLowerCase()}`}
                        />
                      </CardBody>
                    </Card>
                  ))}
                </div>
                </CardBody>
              )}
            </Card>

            <Card className="border border-zinc-800 bg-zinc-900/80 text-zinc-100">
              <CardHeader className="py-4">
                <div className="flex w-full items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-medium">goals knowledge base</h2>
                    <p className="mt-1 text-sm text-zinc-400">tag by key area + project, then filter your view</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="flat"
                      className={goalsEditMode ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "bg-zinc-800 text-zinc-300"}
                      onPress={() => setGoalsEditMode((prev) => !prev)}
                    >
                      {goalsEditMode ? "edit mode" : "view mode"}
                    </Button>
                    <Button
                      size="sm"
                      variant="light"
                      className="text-zinc-400"
                      onPress={() => toggleSection("goals")}
                    >
                      {collapsedSections.goals ? "expand" : "collapse"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {!collapsedSections.goals && (
                <CardBody className="space-y-4 pt-4">
                <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-zinc-300">filter goals</p>
                    <Button
                      size="sm"
                      variant="light"
                      className="text-zinc-400"
                      onPress={() => setFilters({ areaTags: [], projectIds: [] })}
                    >
                      clear
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(AREA_LABELS) as LifeArea[]).map((area) => {
                      const selected = filters.areaTags.includes(area);
                      return (
                        <Button
                          key={`filter-area-${area}`}
                          size="sm"
                          variant={selected ? "flat" : "bordered"}
                          className={selected ? AREA_TAG_CLASSES[area] : "border-zinc-700 text-zinc-300"}
                          onPress={() =>
                            setFilters((prev) => ({
                              ...prev,
                              areaTags: toggleInArray(prev.areaTags, area),
                            }))
                          }
                        >
                          {AREA_LABELS[area]}
                        </Button>
                      );
                    })}
                  </div>
                  {data.projects.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {data.projects.map((project) => {
                        const selected = filters.projectIds.includes(project.id);
                        return (
                          <Button
                            key={`filter-project-${project.id}`}
                            size="sm"
                            variant={selected ? "flat" : "bordered"}
                            className={
                              selected
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                : "border-zinc-700 text-zinc-300"
                            }
                            onPress={() =>
                              setFilters((prev) => ({
                                ...prev,
                                projectIds: toggleInArray(prev.projectIds, project.id),
                              }))
                            }
                          >
                            {project.title}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                  <div className="max-w-xs">
                    <Select
                      label="sort goals"
                      labelPlacement="outside"
                      variant="bordered"
                      selectedKeys={[goalSort]}
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys as Set<string>)[0] as GoalSortOption | undefined;
                        if (selected) {
                          setGoalSort(selected);
                        }
                      }}
                      classNames={{
                        trigger: "!bg-zinc-950 !text-zinc-100 border-zinc-700 data-[hover=true]:border-zinc-500",
                        value: "!text-zinc-100",
                        label: "text-zinc-400",
                        selectorIcon: "text-zinc-400",
                        listboxWrapper: "bg-zinc-900 text-zinc-100",
                        popoverContent: "bg-zinc-900 border border-zinc-700",
                      }}
                    >
                      {(Object.keys(GOAL_SORT_LABELS) as GoalSortOption[]).map((option) => (
                        <SelectItem key={option} className="text-zinc-100">
                          {GOAL_SORT_LABELS[option]}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                </div>

                <Tabs variant="underlined" color="primary">
                  {(Object.keys(GOAL_LABELS) as GoalType[]).map((kind) => (
                    <Tab key={kind} title={GOAL_LABELS[kind]}>
                      <div className="mb-3 mt-1 flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
                          showing {sortedGoals[kind].length} of {data.goals[kind].length}
                        </p>
                        <Button size="sm" variant="flat" className="bg-zinc-800 text-zinc-200" onPress={() => addGoal(kind)}>
                          add goal
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {sortedGoals[kind].map((goal, idx) => {
                          const draftKey = goalDraftKey(kind, goal.id);
                          const draft = goalAttachmentDrafts[draftKey] ?? EMPTY_ATTACHMENT_DRAFT;
                          const goalRef = `${kind}:${goal.id}`;
                          const isGoalEditing = goalsEditMode || activeGoalEditorRef === goalRef;
                          const handleGoalCardClick = (event: MouseEvent<HTMLElement>) => {
                            if (goalsEditMode || isGoalEditing) {
                              return;
                            }
                            const target = event.target as HTMLElement;
                            if (target.closest("button, input, textarea")) {
                              return;
                            }
                            setActiveGoalEditorRef(goalRef);
                          };

                          return (
                            <Card key={goal.id} className={`border border-zinc-800 bg-zinc-950/70 shadow-none ${!isGoalEditing ? "cursor-pointer" : ""}`}>
                              <CardHeader className="flex items-center justify-between gap-3 pb-2" onClick={handleGoalCardClick}>
                                <div className="flex min-w-0 items-center gap-3">
                                  <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    className={
                                      goal.completed
                                        ? "h-9 w-9 min-w-9 rounded-full border-0 bg-transparent p-0 text-2xl font-black leading-none text-emerald-300 shadow-none data-[hover=true]:bg-transparent"
                                        : "h-9 w-9 min-w-9 rounded-full border-0 bg-transparent p-0 text-2xl font-black leading-none text-zinc-300 shadow-none data-[hover=true]:bg-transparent"
                                    }
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      updateGoal(kind, goal.id, (prev) => ({
                                        ...prev,
                                        completed: !prev.completed,
                                      }));
                                    }}
                                  >
                                    {goal.completed ? "✓" : "◯"}
                                  </Button>
                                  <p
                                    className={`truncate text-sm ${goal.completed ? "text-zinc-500 line-through" : "text-zinc-300"}`}
                                    title={goal.title.trim() || `${GOAL_LABELS[kind]} goal #${idx + 1}`}
                                  >
                                    {goal.title.trim() || `${GOAL_LABELS[kind]} goal #${idx + 1}`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {!goalsEditMode && isGoalEditing && (
                                    <Button
                                      size="sm"
                                      variant="light"
                                      className="text-zinc-500"
                                      onPress={() => setActiveGoalEditorRef(null)}
                                    >
                                      done
                                    </Button>
                                  )}
                                  {isGoalEditing && (
                                    <Button
                                      size="sm"
                                      variant="light"
                                      className="text-zinc-500"
                                      isDisabled={data.goals[kind].length === 1}
                                      onPress={() => removeGoal(kind, goal.id)}
                                    >
                                      remove
                                    </Button>
                                  )}
                                </div>
                              </CardHeader>
                              <CardBody className="space-y-3" onClick={handleGoalCardClick}>
                                {!isGoalEditing && (
                                  <>
                                    {goal.description.trim().length > 0 && (
                                      <p className="text-sm leading-relaxed text-zinc-300">{goal.description}</p>
                                    )}
                                    <div className="flex flex-wrap gap-2">
                                      {goal.dueDate.length > 0 && (
                                        <Chip variant="flat" className="bg-zinc-800 text-zinc-300">
                                          due {goal.dueDate}
                                        </Chip>
                                      )}
                                      {goal.priority && (
                                        <Chip
                                          variant="flat"
                                          className="bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                        >
                                          {PRIORITY_LABELS[goal.priority]}
                                        </Chip>
                                      )}
                                      {goal.timeline && (
                                        <Chip
                                          variant="flat"
                                          className="bg-blue-500/20 text-blue-300 border border-blue-500/40"
                                        >
                                          {TIMELINE_LABELS[goal.timeline]}
                                        </Chip>
                                      )}
                                      {goal.areaTags.map((area) => (
                                        <Chip key={`${goal.id}-view-area-${area}`} variant="flat" className={AREA_TAG_CLASSES[area]}>
                                          {AREA_LABELS[area]}
                                        </Chip>
                                      ))}
                                      {goal.projectIds.map((projectId) => {
                                        const project = data.projects.find((item) => item.id === projectId);
                                        if (!project) {
                                          return null;
                                        }
                                        return (
                                          <Chip
                                            key={`${goal.id}-view-project-${project.id}`}
                                            variant="flat"
                                            className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                          >
                                            {project.title}
                                          </Chip>
                                        );
                                      })}
                                    </div>
                                    {goal.attachments.length > 0 && (
                                      <div className="flex flex-wrap gap-2">
                                        {goal.attachments.map((attachment) => (
                                          <button
                                            key={attachment.id}
                                            type="button"
                                            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 underline decoration-zinc-600"
                                            onClick={(event) => {
                                              event.preventDefault();
                                              event.stopPropagation();
                                              openAttachment(attachment);
                                            }}
                                          >
                                            {attachment.label}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                )}
                                {isGoalEditing && (
                                  <>
                                <Input
                                  variant="bordered"
                                  value={goal.title}
                                  onValueChange={(value) => updateGoal(kind, goal.id, (prev) => ({ ...prev, title: value }))}
                                  placeholder="title"
                                  classNames={{
                                    inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
                                    input: "text-zinc-100 placeholder:text-zinc-500",
                                  }}
                                />
                                <Textarea
                                  minRows={2}
                                  variant="bordered"
                                  value={goal.description}
                                  onValueChange={(value) => updateGoal(kind, goal.id, (prev) => ({ ...prev, description: value }))}
                                  placeholder="description"
                                  classNames={{
                                    inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
                                    input: "text-zinc-100 placeholder:text-zinc-500",
                                  }}
                                />

                                <Input
                                  type="date"
                                  label="due date"
                                  labelPlacement="outside"
                                  variant="bordered"
                                  value={goal.dueDate}
                                  onValueChange={(value) => updateGoal(kind, goal.id, (prev) => ({ ...prev, dueDate: value }))}
                                  classNames={{
                                    inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
                                    input: "text-zinc-100",
                                    label: "text-zinc-400",
                                  }}
                                />

                                <div className="space-y-2">
                                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">priority</p>
                                  <div className="flex flex-wrap gap-2">
                                    {(Object.keys(PRIORITY_LABELS) as PriorityTag[]).map((priority) => {
                                      const selected = goal.priority === priority;
                                      return (
                                        <Button
                                          key={`${goal.id}-priority-${priority}`}
                                          size="sm"
                                          variant={selected ? "flat" : "bordered"}
                                          className={
                                            selected
                                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                              : "border-zinc-700 text-zinc-300"
                                          }
                                          onPress={() =>
                                            updateGoal(kind, goal.id, (prev) => ({
                                              ...prev,
                                              priority: prev.priority === priority ? "" : priority,
                                            }))
                                          }
                                        >
                                          {PRIORITY_LABELS[priority]}
                                        </Button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">timeline</p>
                                  <div className="flex flex-wrap gap-2">
                                    {(Object.keys(TIMELINE_LABELS) as TimelineTag[]).map((timeline) => {
                                      const selected = goal.timeline === timeline;
                                      return (
                                        <Button
                                          key={`${goal.id}-timeline-${timeline}`}
                                          size="sm"
                                          variant={selected ? "flat" : "bordered"}
                                          className={
                                            selected
                                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                                              : "border-zinc-700 text-zinc-300"
                                          }
                                          onPress={() =>
                                            updateGoal(kind, goal.id, (prev) => ({
                                              ...prev,
                                              timeline: prev.timeline === timeline ? "" : timeline,
                                            }))
                                          }
                                        >
                                          {TIMELINE_LABELS[timeline]}
                                        </Button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">key areas</p>
                                  <div className="flex flex-wrap gap-2">
                                    {(Object.keys(AREA_LABELS) as LifeArea[]).map((area) => {
                                      const selected = goal.areaTags.includes(area);
                                      return (
                                        <Button
                                          key={`${goal.id}-area-${area}`}
                                          size="sm"
                                          variant={selected ? "flat" : "bordered"}
                                          className={selected ? AREA_TAG_CLASSES[area] : "border-zinc-700 text-zinc-300"}
                                          onPress={() =>
                                            updateGoal(kind, goal.id, (prev) => ({
                                              ...prev,
                                              areaTags: toggleInArray(prev.areaTags, area),
                                            }))
                                          }
                                        >
                                          {AREA_LABELS[area]}
                                        </Button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">projects</p>
                                  {data.projects.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {data.projects.map((project) => {
                                        const selected = goal.projectIds.includes(project.id);
                                        return (
                                          <Button
                                            key={`${goal.id}-project-${project.id}`}
                                            size="sm"
                                            variant={selected ? "flat" : "bordered"}
                                            className={
                                              selected
                                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                                : "border-zinc-700 text-zinc-300"
                                            }
                                            onPress={() =>
                                              updateGoal(kind, goal.id, (prev) => ({
                                                ...prev,
                                                projectIds: toggleInArray(prev.projectIds, project.id),
                                              }))
                                            }
                                          >
                                            {project.title}
                                          </Button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-zinc-500">add a project first to tag goals here.</p>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">attachments</p>
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <Input
                                      variant="bordered"
                                      value={draft.label}
                                      onKeyDown={preventEnterSubmit}
                                      onValueChange={(value) =>
                                        setGoalAttachmentDraft(kind, goal.id, (prev) => ({ ...prev, label: value }))
                                      }
                                      placeholder="attachment label"
                                      classNames={{
                                        inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
                                        input: "text-zinc-100 placeholder:text-zinc-500",
                                      }}
                                    />
                                    <Input
                                      variant="bordered"
                                      value={draft.url}
                                      onKeyDown={preventEnterSubmit}
                                      onValueChange={(value) =>
                                        setGoalAttachmentDraft(kind, goal.id, (prev) => ({ ...prev, url: value }))
                                      }
                                      placeholder="https://... or /Users/.../file.pdf"
                                      classNames={{
                                        inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
                                        input: "text-zinc-100 placeholder:text-zinc-500",
                                      }}
                                    />
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="flat"
                                      className="bg-zinc-800 text-zinc-200"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        addGoalAttachmentLink(kind, goal.id);
                                      }}
                                    >
                                      add link
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="flat"
                                      className="bg-zinc-800 text-zinc-200"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        openFileUpload({ entity: "goal", kind, goalId: goal.id });
                                      }}
                                    >
                                      upload file
                                    </Button>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {goal.attachments.map((attachment) => (
                                      <div
                                        key={attachment.id}
                                        className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1"
                                      >
                                        <button
                                          type="button"
                                          className="text-xs text-zinc-200 underline decoration-zinc-600"
                                          onClick={() => openAttachment(attachment)}
                                        >
                                          {attachment.label}
                                        </button>
                                        <Button
                                          size="sm"
                                          variant="light"
                                          className="min-w-0 px-1 text-zinc-500"
                                          onPress={() => removeGoalAttachment(kind, goal.id, attachment.id)}
                                        >
                                          x
                                        </Button>
                                      </div>
                                    ))}
                                    {goal.attachments.length === 0 && (
                                      <span className="text-xs text-zinc-500">no attachments yet</span>
                                    )}
                                  </div>
                                </div>
                                  </>
                                )}
                              </CardBody>
                            </Card>
                          );
                        })}

                        {sortedGoals[kind].length === 0 && (
                          <p className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-400">
                            no goals match your current filters.
                          </p>
                        )}
                      </div>
                    </Tab>
                  ))}
                </Tabs>
                </CardBody>
              )}
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15, ease: "easeOut" }}
            className="flex flex-col gap-6"
          >
            <Card className="order-2 border border-zinc-800 bg-zinc-900/80 text-zinc-100">
              <CardHeader className="py-4">
                <div className="flex w-full items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-medium">projects</h2>
                    <p className="mt-1 text-sm text-zinc-400">group related goals under projects</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="flat"
                      className={projectsEditMode ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "bg-zinc-800 text-zinc-300"}
                      onPress={() => setProjectsEditMode((prev) => !prev)}
                    >
                      {projectsEditMode ? "edit mode" : "view mode"}
                    </Button>
                    <Button
                      size="sm"
                      variant="light"
                      className="text-zinc-400"
                      onPress={() => toggleSection("projects")}
                    >
                      {collapsedSections.projects ? "expand" : "collapse"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {!collapsedSections.projects && (
                <CardBody className="space-y-4 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <Button
                    variant="flat"
                    className="bg-cyan-500/20 text-cyan-300"
                    onPress={() => {
                      if (!projectsEditMode) {
                        setProjectsEditMode(true);
                        setShowProjectForm(true);
                        return;
                      }
                      setShowProjectForm((prev) => !prev);
                    }}
                  >
                    {showProjectForm ? "close new project" : "new project"}
                  </Button>
                  {showProjectForm && <span className="text-xs text-zinc-500">fill details and click add project</span>}
                </div>

                {projectsEditMode && showProjectForm && (
                  <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                    <Input
                      variant="bordered"
                      value={projectDraft.title}
                      onValueChange={(value) => setProjectDraft((prev) => ({ ...prev, title: value }))}
                      placeholder="project title"
                      classNames={{
                        inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
                        input: "text-zinc-100 placeholder:text-zinc-500",
                      }}
                    />
                    <Textarea
                      minRows={2}
                      variant="bordered"
                      value={projectDraft.description}
                      onValueChange={(value) => setProjectDraft((prev) => ({ ...prev, description: value }))}
                      placeholder="project description"
                      classNames={{
                        inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
                        input: "text-zinc-100 placeholder:text-zinc-500",
                      }}
                    />
                    <Input
                      type="date"
                      label="project due date"
                      labelPlacement="outside"
                      variant="bordered"
                      value={projectDraft.dueDate}
                      onValueChange={(value) => setProjectDraft((prev) => ({ ...prev, dueDate: value }))}
                      classNames={{
                        inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
                        input: "text-zinc-100",
                        label: "text-zinc-400",
                      }}
                    />
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">project key areas</p>
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(AREA_LABELS) as LifeArea[]).map((area) => {
                          const selected = projectDraft.areaTags.includes(area);
                          return (
                            <Button
                              key={`draft-area-${area}`}
                              size="sm"
                              variant={selected ? "flat" : "bordered"}
                              className={selected ? AREA_TAG_CLASSES[area] : "border-zinc-700 text-zinc-300"}
                              onPress={() =>
                                setProjectDraft((prev) => ({
                                  ...prev,
                                  areaTags: toggleInArray(prev.areaTags, area),
                                }))
                              }
                            >
                              {AREA_LABELS[area]}
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">project attachments</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          variant="bordered"
                          value={projectDraft.attachmentDraft.label}
                          onKeyDown={preventEnterSubmit}
                          onValueChange={(value) =>
                            setProjectDraft((prev) => ({
                              ...prev,
                              attachmentDraft: { ...prev.attachmentDraft, label: value },
                            }))
                          }
                          placeholder="attachment label"
                          classNames={{
                            inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
                            input: "text-zinc-100 placeholder:text-zinc-500",
                          }}
                        />
                        <Input
                          variant="bordered"
                          value={projectDraft.attachmentDraft.url}
                          onKeyDown={preventEnterSubmit}
                          onValueChange={(value) =>
                            setProjectDraft((prev) => ({
                              ...prev,
                              attachmentDraft: { ...prev.attachmentDraft, url: value },
                            }))
                          }
                          placeholder="https://... or /Users/.../file.pdf"
                          classNames={{
                            inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
                            input: "text-zinc-100 placeholder:text-zinc-500",
                          }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="flat"
                          className="bg-zinc-800 text-zinc-200"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            addProjectDraftAttachmentLink();
                          }}
                        >
                          add link
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="flat"
                          className="bg-zinc-800 text-zinc-200"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openFileUpload({ entity: "project-draft" });
                          }}
                        >
                          upload file
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {projectDraft.attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1"
                          >
                            <button
                              type="button"
                              className="text-xs text-zinc-200 underline decoration-zinc-600"
                              onClick={() => openAttachment(attachment)}
                            >
                              {attachment.label}
                            </button>
                            <Button
                              size="sm"
                              variant="light"
                              className="min-w-0 px-1 text-zinc-500"
                              onPress={() => removeProjectDraftAttachment(attachment.id)}
                            >
                              x
                            </Button>
                          </div>
                        ))}
                        {projectDraft.attachments.length === 0 && (
                          <span className="text-xs text-zinc-500">no attachments yet</span>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="flat"
                      className="bg-cyan-500/20 text-cyan-300"
                      isDisabled={projectDraft.title.trim().length === 0}
                      onPress={addProject}
                    >
                      add project
                    </Button>
                  </div>
                )}

                <div className="max-w-xs">
                  <Select
                    label="sort projects"
                    labelPlacement="outside"
                    variant="bordered"
                    selectedKeys={[projectSort]}
                    onSelectionChange={(keys) => {
                      const selected = Array.from(keys as Set<string>)[0] as ProjectSortOption | undefined;
                      if (selected) {
                        setProjectSort(selected);
                      }
                    }}
                    classNames={{
                      trigger: "!bg-zinc-950 !text-zinc-100 border-zinc-700 data-[hover=true]:border-zinc-500",
                      value: "!text-zinc-100",
                      label: "text-zinc-400",
                      selectorIcon: "text-zinc-400",
                      listboxWrapper: "bg-zinc-900 text-zinc-100",
                      popoverContent: "bg-zinc-900 border border-zinc-700",
                    }}
                  >
                    {(Object.keys(PROJECT_SORT_LABELS) as ProjectSortOption[]).map((option) => (
                      <SelectItem key={option} className="text-zinc-100">
                        {PROJECT_SORT_LABELS[option]}
                      </SelectItem>
                    ))}
                  </Select>
                </div>

                <div className="space-y-3 border-t border-zinc-800 pt-4">
                  {sortedProjects.length === 0 && <p className="text-sm text-zinc-500">no projects yet.</p>}
                  {sortedProjects.map((project) => {
                    const draft = projectAttachmentDrafts[project.id] ?? EMPTY_ATTACHMENT_DRAFT;
                    const isProjectEditing = projectsEditMode || activeProjectEditorId === project.id;
                    const handleProjectCardClick = (event: MouseEvent<HTMLElement>) => {
                      if (projectsEditMode || isProjectEditing) {
                        return;
                      }
                      const target = event.target as HTMLElement;
                      if (target.closest("button, input, textarea")) {
                        return;
                      }
                      setActiveProjectEditorId(project.id);
                    };

                    return (
                      <Card
                        key={project.id}
                        className={`border border-zinc-800 bg-zinc-950/70 shadow-none ${!isProjectEditing ? "cursor-pointer" : ""}`}
                      >
                        <CardHeader className="flex items-start justify-between gap-3 pb-2" onClick={handleProjectCardClick}>
                          <div>
                            <h3 className="text-sm font-medium text-zinc-100">{project.title}</h3>
                            {project.description.length > 0 && (
                              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{project.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!projectsEditMode && isProjectEditing && (
                              <Button
                                size="sm"
                                variant="light"
                                className="text-zinc-500"
                                onPress={() => setActiveProjectEditorId(null)}
                              >
                                done
                              </Button>
                            )}
                            {isProjectEditing && (
                              <Button size="sm" variant="light" className="text-zinc-500" onPress={() => removeProject(project.id)}>
                                remove
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardBody className="space-y-3 pt-0" onClick={handleProjectCardClick}>
                          {!isProjectEditing && (
                            <>
                              <div className="flex flex-wrap gap-2">
                                {project.dueDate.length > 0 && (
                                  <Chip variant="flat" className="bg-zinc-800 text-zinc-300">
                                    due {project.dueDate}
                                  </Chip>
                                )}
                                {project.areaTags.map((area) => (
                                  <Chip key={`${project.id}-view-area-${area}`} variant="flat" className={AREA_TAG_CLASSES[area]}>
                                    {AREA_LABELS[area]}
                                  </Chip>
                                ))}
                              </div>
                              {project.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {project.attachments.map((attachment) => (
                                    <button
                                      key={attachment.id}
                                      type="button"
                                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 underline decoration-zinc-600"
                                      onClick={() => openAttachment(attachment)}
                                    >
                                      {attachment.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                          {isProjectEditing && (
                            <>
                          <div className="flex flex-wrap gap-2">
                            {project.dueDate.length > 0 && (
                              <Chip variant="flat" className="bg-zinc-800 text-zinc-300">
                                due {project.dueDate}
                              </Chip>
                            )}
                            {project.areaTags.map((area) => (
                              <Chip key={`${project.id}-${area}`} variant="flat" className={AREA_TAG_CLASSES[area]}>
                                {AREA_LABELS[area]}
                              </Chip>
                            ))}
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">attachments</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <Input
                                variant="bordered"
                                value={draft.label}
                                onKeyDown={preventEnterSubmit}
                                onValueChange={(value) =>
                                  setProjectAttachmentDrafts((prev) => ({
                                    ...prev,
                                    [project.id]: { ...draft, label: value },
                                  }))
                                }
                                placeholder="attachment label"
                                classNames={{
                                  inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
                                  input: "text-zinc-100 placeholder:text-zinc-500",
                                }}
                              />
                              <Input
                                variant="bordered"
                                value={draft.url}
                                onKeyDown={preventEnterSubmit}
                                onValueChange={(value) =>
                                  setProjectAttachmentDrafts((prev) => ({
                                    ...prev,
                                    [project.id]: { ...draft, url: value },
                                  }))
                                }
                                placeholder="https://... or /Users/.../file.pdf"
                                classNames={{
                                  inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
                                  input: "text-zinc-100 placeholder:text-zinc-500",
                                }}
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="flat"
                                className="bg-zinc-800 text-zinc-200"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  addProjectAttachmentLink(project.id);
                                }}
                              >
                                add link
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="flat"
                                className="bg-zinc-800 text-zinc-200"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openFileUpload({ entity: "project", projectId: project.id });
                                }}
                              >
                                upload file
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {project.attachments.map((attachment) => (
                                <div
                                  key={attachment.id}
                                  className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1"
                                >
                                  <button
                                    type="button"
                                    className="text-xs text-zinc-200 underline decoration-zinc-600"
                                    onClick={() => openAttachment(attachment)}
                                  >
                                    {attachment.label}
                                  </button>
                                  <Button
                                    size="sm"
                                    variant="light"
                                    className="min-w-0 px-1 text-zinc-500"
                                    onPress={() => removeProjectAttachment(project.id, attachment.id)}
                                  >
                                    x
                                  </Button>
                                </div>
                              ))}
                              {project.attachments.length === 0 && (
                                <span className="text-xs text-zinc-500">no attachments yet</span>
                              )}
                            </div>
                          </div>
                            </>
                          )}
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>
                </CardBody>
              )}
            </Card>

            <Card className="order-1 border border-zinc-800 bg-zinc-900/80 text-zinc-100">
              <CardHeader className="py-4">
                <div className="flex w-full items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-medium">today alignment</h2>
                    <p className="mt-1 text-sm text-zinc-400">what actually matters right now</p>
                  </div>
                  <Button
                    size="sm"
                    variant="light"
                    className="text-zinc-400"
                    onPress={() => toggleSection("today")}
                  >
                    {collapsedSections.today ? "expand" : "collapse"}
                  </Button>
                </div>
              </CardHeader>
              {!collapsedSections.today && (
                <CardBody className="pt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    label="linked goal"
                    labelPlacement="outside"
                    placeholder="select a goal"
                    variant="bordered"
                    selectedKeys={data.todayGoalRef ? [data.todayGoalRef] : []}
                    renderValue={(items) => (
                      <span className="text-zinc-100">{items.map((item) => item.textValue).join(", ")}</span>
                    )}
                    onSelectionChange={(keys) => {
                      const selected = Array.from(keys as Set<string>)[0]?.toString() ?? "";
                      setData((prev) => ({ ...prev, todayGoalRef: selected }));
                    }}
                    classNames={{
                      trigger: "!bg-zinc-950 !text-zinc-100 border-zinc-700 data-[hover=true]:border-zinc-500",
                      value: "!text-zinc-100",
                      label: "text-zinc-400",
                      selectorIcon: "text-zinc-400",
                      listboxWrapper: "bg-zinc-900 text-zinc-100",
                      popoverContent: "bg-zinc-900 border border-zinc-700",
                    }}
                  >
                    {goalReferenceOptions.map((goalOption) => (
                      <SelectItem key={goalOption.ref} className="text-zinc-100">
                        {goalOption.label}
                      </SelectItem>
                    ))}
                  </Select>

                  <Select
                    label="linked project"
                    labelPlacement="outside"
                    placeholder="select a project"
                    variant="bordered"
                    selectedKeys={data.todayProjectId ? [data.todayProjectId] : []}
                    renderValue={(items) => (
                      <span className="text-zinc-100">{items.map((item) => item.textValue).join(", ")}</span>
                    )}
                    onSelectionChange={(keys) => {
                      const selected = Array.from(keys as Set<string>)[0]?.toString() ?? "";
                      setData((prev) => ({ ...prev, todayProjectId: selected }));
                    }}
                    classNames={{
                      trigger: "!bg-zinc-950 !text-zinc-100 border-zinc-700 data-[hover=true]:border-zinc-500",
                      value: "!text-zinc-100",
                      label: "text-zinc-400",
                      selectorIcon: "text-zinc-400",
                      listboxWrapper: "bg-zinc-900 text-zinc-100",
                      popoverContent: "bg-zinc-900 border border-zinc-700",
                    }}
                  >
                    {data.projects.map((project) => (
                      <SelectItem key={project.id} className="text-zinc-100">
                        {project.title}
                      </SelectItem>
                    ))}
                  </Select>
                </div>

                <Textarea
                  minRows={4}
                  variant="bordered"
                  value={data.todayFocus}
                  onValueChange={(value) => setData((prev) => ({ ...prev, todayFocus: value }))}
                  classNames={{
                    inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
                    input: "text-zinc-100 placeholder:text-zinc-500",
                  }}
                  placeholder="what 1-3 things move your life forward today?"
                />
                <Textarea
                  minRows={4}
                  variant="bordered"
                  value={data.energyPlan}
                  onValueChange={(value) => setData((prev) => ({ ...prev, energyPlan: value }))}
                  classNames={{
                    inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
                    input: "text-zinc-100 placeholder:text-zinc-500",
                  }}
                  placeholder="how are you protecting your energy today?"
                />
                </CardBody>
              )}
            </Card>

            <Card className="order-3 border border-zinc-800 bg-zinc-900/80 text-zinc-100">
              <CardHeader className="py-4">
                <div className="flex w-full items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-medium">system note</h2>
                    <p className="mt-1 text-sm text-zinc-400">keep your execution loop tight</p>
                  </div>
                  <Button
                    size="sm"
                    variant="light"
                    className="text-zinc-400"
                    onPress={() => toggleSection("note")}
                  >
                    {collapsedSections.note ? "expand" : "collapse"}
                  </Button>
                </div>
              </CardHeader>
              {!collapsedSections.note && (
                <CardBody>
                  <p className="text-sm leading-relaxed text-zinc-300">
                    loop: review vision, tag the next action, then schedule it where your energy is strongest.
                  </p>
                </CardBody>
              )}
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

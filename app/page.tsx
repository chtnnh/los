"use client";

import { Button, Card, CardBody, CardHeader, Chip, Input, Tab, Tabs, Textarea } from "@heroui/react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

type LifeArea = "health" | "work" | "relationships" | "financial" | "learning" | "soul";
type GoalType = "daily" | "weekly" | "monthly";
type PriorityTag = "low" | "medium" | "high";
type TimelineTag = "week" | "month" | "quarter" | "year" | "decade";

type GoalEntry = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: PriorityTag | "";
  timeline: TimelineTag | "";
  areaTags: LifeArea[];
  projectIds: string[];
};

type ProjectEntry = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  areaTags: LifeArea[];
};

type GoalFilters = {
  areaTags: LifeArea[];
  projectIds: string[];
};

type LifeData = {
  visions: Record<LifeArea, string>;
  goals: Record<GoalType, GoalEntry[]>;
  projects: ProjectEntry[];
  todayFocus: string;
  energyPlan: string;
};

const STORAGE_KEY = "life-os-data-v1";

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

function toggleInArray<T>(items: T[], value: T): T[] {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

function createEmptyGoal(id: string): GoalEntry {
  return {
    id,
    title: "",
    description: "",
    dueDate: "",
    priority: "",
    timeline: "",
    areaTags: [],
    projectIds: [],
  };
}

function createDefaultGoals(kind: GoalType): GoalEntry[] {
  return [
    createEmptyGoal(`${kind}-1`),
    createEmptyGoal(`${kind}-2`),
    createEmptyGoal(`${kind}-3`),
  ];
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
  todayFocus: "",
  energyPlan: "",
};

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
    description?: string;
    dueDate?: string;
    priority?: string;
    timeline?: string;
    areaTags?: string[];
    projectIds?: string[];
  };

  const priority = value.priority;
  const timeline = value.timeline;

  return {
    id: typeof value.id === "string" && value.id.length > 0 ? value.id : fallbackId,
    title: typeof value.title === "string" ? value.title : "",
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
    todayFocus: value.todayFocus ?? "",
    energyPlan: value.energyPlan ?? "",
  };
}

export default function Home() {
  const [data, setData] = useState<LifeData>(defaultData);
  const [filters, setFilters] = useState<GoalFilters>({ areaTags: [], projectIds: [] });
  const [projectDraft, setProjectDraft] = useState({
    title: "",
    description: "",
    dueDate: "",
    areaTags: [] as LifeArea[],
  });

  const hasLoadedFromStorage = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        hasLoadedFromStorage.current = true;
        return;
      }

      setData(normalizeData(JSON.parse(raw) as unknown));
    } catch {
      // keep defaults if storage is missing or malformed
    } finally {
      hasLoadedFromStorage.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedFromStorage.current) {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

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

  const updateGoal = (kind: GoalType, goalId: string, updater: (goal: GoalEntry) => GoalEntry) => {
    setData((prev) => ({
      ...prev,
      goals: {
        ...prev.goals,
        [kind]: prev.goals[kind].map((goal) => (goal.id === goalId ? updater(goal) : goal)),
      },
    }));
  };

  const addGoal = (kind: GoalType) => {
    const id = `goal-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setData((prev) => ({
      ...prev,
      goals: {
        ...prev.goals,
        [kind]: [...prev.goals[kind], createEmptyGoal(id)],
      },
    }));
  };

  const removeGoal = (kind: GoalType, goalId: string) => {
    setData((prev) => ({
      ...prev,
      goals: {
        ...prev.goals,
        [kind]:
          prev.goals[kind].length === 1 ? prev.goals[kind] : prev.goals[kind].filter((goal) => goal.id !== goalId),
      },
    }));
  };

  const addProject = () => {
    if (projectDraft.title.trim().length === 0) {
      return;
    }

    const projectId = `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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
        },
      ],
    }));

    setProjectDraft({
      title: "",
      description: "",
      dueDate: "",
      areaTags: [],
    });
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
    }));

    setFilters((prev) => ({
      ...prev,
      projectIds: prev.projectIds.filter((id) => id !== projectId),
    }));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-[family-name:var(--font-space-grotesk)]">
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
          <div className="flex items-center gap-3">
            <Chip variant="flat" className="bg-zinc-800 text-zinc-200">
              {filledCount} entries filled
            </Chip>
            <Button
              size="sm"
              variant="flat"
              className="bg-teal-500/20 text-teal-300"
              onPress={() => setData(defaultData)}
            >
              reset
            </Button>
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
              <CardHeader className="pb-0">
                <div>
                  <h2 className="text-xl font-medium">vision dashboard</h2>
                  <p className="mt-1 text-sm text-zinc-400">all key areas in one view</p>
                </div>
              </CardHeader>
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
            </Card>

            <Card className="border border-zinc-800 bg-zinc-900/80 text-zinc-100">
              <CardHeader className="pb-0">
                <div>
                  <h2 className="text-xl font-medium">goals knowledge base</h2>
                  <p className="mt-1 text-sm text-zinc-400">tag by key area + project, then filter your view</p>
                </div>
              </CardHeader>
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
                </div>

                <Tabs variant="underlined" color="primary">
                  {(Object.keys(GOAL_LABELS) as GoalType[]).map((kind) => (
                    <Tab key={kind} title={GOAL_LABELS[kind]}>
                      <div className="mb-3 mt-1 flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
                          showing {filteredGoals[kind].length} of {data.goals[kind].length}
                        </p>
                        <Button size="sm" variant="flat" className="bg-zinc-800 text-zinc-200" onPress={() => addGoal(kind)}>
                          add goal
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {filteredGoals[kind].map((goal, idx) => (
                          <Card key={goal.id} className="border border-zinc-800 bg-zinc-950/70 shadow-none">
                            <CardHeader className="flex items-center justify-between gap-3 pb-2">
                              <p className="text-sm text-zinc-400">{GOAL_LABELS[kind]} goal #{idx + 1}</p>
                              <Button
                                size="sm"
                                variant="light"
                                className="text-zinc-500"
                                isDisabled={data.goals[kind].length === 1}
                                onPress={() => removeGoal(kind, goal.id)}
                              >
                                remove
                              </Button>
                            </CardHeader>
                            <CardBody className="space-y-3">
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
                                onValueChange={(value) =>
                                  updateGoal(kind, goal.id, (prev) => ({ ...prev, description: value }))
                                }
                                placeholder="description"
                                classNames={{
                                  inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
                                  input: "text-zinc-100 placeholder:text-zinc-500",
                                }}
                              />

                              <div className="grid gap-3 sm:grid-cols-2">
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
                              </div>

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
                            </CardBody>
                          </Card>
                        ))}

                        {filteredGoals[kind].length === 0 && (
                          <p className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-400">
                            no goals match your current filters.
                          </p>
                        )}
                      </div>
                    </Tab>
                  ))}
                </Tabs>
              </CardBody>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15, ease: "easeOut" }}
            className="space-y-6"
          >
            <Card className="border border-zinc-800 bg-zinc-900/80 text-zinc-100">
              <CardHeader className="pb-0">
                <div>
                  <h2 className="text-xl font-medium">projects</h2>
                  <p className="mt-1 text-sm text-zinc-400">group related goals under projects</p>
                </div>
              </CardHeader>
              <CardBody className="space-y-4 pt-4">
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
                <Button
                  variant="flat"
                  className="bg-cyan-500/20 text-cyan-300"
                  isDisabled={projectDraft.title.trim().length === 0}
                  onPress={addProject}
                >
                  add project
                </Button>

                <div className="space-y-3 border-t border-zinc-800 pt-4">
                  {data.projects.length === 0 && <p className="text-sm text-zinc-500">no projects yet.</p>}
                  {data.projects.map((project) => (
                    <Card key={project.id} className="border border-zinc-800 bg-zinc-950/70 shadow-none">
                      <CardHeader className="flex items-start justify-between gap-3 pb-2">
                        <div>
                          <h3 className="text-sm font-medium text-zinc-100">{project.title}</h3>
                          {project.description.length > 0 && (
                            <p className="mt-1 text-xs leading-relaxed text-zinc-400">{project.description}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="light"
                          className="text-zinc-500"
                          onPress={() => removeProject(project.id)}
                        >
                          remove
                        </Button>
                      </CardHeader>
                      <CardBody className="pt-0">
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
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card className="border border-zinc-800 bg-zinc-900/80 text-zinc-100">
              <CardHeader className="pb-0">
                <div>
                  <h2 className="text-xl font-medium">today alignment</h2>
                  <p className="mt-1 text-sm text-zinc-400">what actually matters right now</p>
                </div>
              </CardHeader>
              <CardBody className="pt-4 space-y-4">
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
            </Card>

            <Card className="border border-zinc-800 bg-zinc-900/80 text-zinc-100">
              <CardBody>
                <p className="text-sm leading-relaxed text-zinc-300">
                  loop: review vision, tag the next action, then schedule it where your energy is strongest.
                </p>
              </CardBody>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

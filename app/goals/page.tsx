"use client";

import Link from "next/link";
import { Button, Card, CardBody, CardHeader, Chip, Input, Progress, Select, SelectItem, Textarea } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import {
  AREA_LABELS,
  AREA_TAG_CLASSES,
  PRIORITY_LABELS,
  PRIORITY_TAG_CLASSES,
  TIMELINE_LABELS,
  TIMELINE_TAG_CLASS,
  countSubGoalsProgress,
  createEmptySubGoal,
  createId,
  defaultLifeData,
  syncGoalCompletedWithSubGoals,
  loadLifeDataFromStorage,
  saveLifeDataToStorage,
  type GoalEntry,
  type GoalType,
  type LifeArea,
  type PriorityTag,
  type SubGoalEntry,
  type TimelineTag,
} from "@/lib/life-os-storage";
import SubGoalItem from "@/components/SubGoalItem";

type GoalWithType = GoalEntry & { goalType: GoalType };

function getGoalRef(goal: GoalWithType): string {
  return `${goal.goalType}:${goal.id}`;
}

export default function GoalsPage() {
  const [data, setData] = useState(defaultLifeData);
  const [selectedGoalRef, setSelectedGoalRef] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editingSubGoalId, setEditingSubGoalId] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const loaded = loadLifeDataFromStorage();
      setData(loaded);

      const requestedGoalRef = new URLSearchParams(window.location.search).get("goalRef")?.trim() ?? "";
      const availableGoalRefs = (["daily", "weekly", "monthly"] as const).flatMap((goalType) =>
        loaded.goals[goalType].map((goal) => `${goalType}:${goal.id}`),
      );
      if (requestedGoalRef && availableGoalRefs.includes(requestedGoalRef)) {
        setSelectedGoalRef(requestedGoalRef);
        return;
      }

      const firstGoal = loaded.goals.daily[0] ?? loaded.goals.weekly[0] ?? loaded.goals.monthly[0];
      if (firstGoal) {
        const firstType: GoalType =
          loaded.goals.daily[0]?.id === firstGoal.id ? "daily" : loaded.goals.weekly[0]?.id === firstGoal.id ? "weekly" : "monthly";
        setSelectedGoalRef(`${firstType}:${firstGoal.id}`);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const allGoals = useMemo<GoalWithType[]>(
    () =>
      (["daily", "weekly", "monthly"] as const).flatMap((goalType) =>
        data.goals[goalType].map((goal) => ({
          ...goal,
          goalType,
        })),
      ),
    [data.goals],
  );

  const selectedGoal = useMemo(
    () => allGoals.find((goal) => getGoalRef(goal) === selectedGoalRef) ?? null,
    [allGoals, selectedGoalRef],
  );

  const updateSelectedGoal = (updater: (goal: GoalEntry) => GoalEntry) => {
    if (!selectedGoal) {
      return;
    }
    setData((prev) => ({
      ...prev,
      goals: {
        ...prev.goals,
        [selectedGoal.goalType]: prev.goals[selectedGoal.goalType].map((goal) =>
          goal.id === selectedGoal.id ? updater(goal) : goal,
        ),
      },
    }));
  };

  const handleUpdateSubGoals = (updater: (subGoals: SubGoalEntry[]) => SubGoalEntry[]) => {
    updateSelectedGoal((goal) =>
      syncGoalCompletedWithSubGoals({ ...goal, subGoals: updater(goal.subGoals) }),
    );
  };

  const subGoalsSection = selectedGoal && (() => {
    const subGoalProgress = countSubGoalsProgress(selectedGoal.subGoals);
    const hasSubGoals = subGoalProgress.total > 0;
    const percent = hasSubGoals ? Math.round((subGoalProgress.completed / subGoalProgress.total) * 100) : 0;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">sub-goals</p>
          <Button
            size="sm"
            variant="flat"
            className="bg-zinc-800 text-zinc-200"
            onPress={() => {
              const newId = createId("subgoal");
              updateSelectedGoal((goal) => ({
                ...goal,
                subGoals: [
                  ...goal.subGoals,
                  { ...createEmptySubGoal(newId), title: "new sub-goal" },
                ],
              }));
              setEditingSubGoalId(newId);
            }}
          >
            add sub-goal
          </Button>
        </div>
        {hasSubGoals && (
          <>
            <Progress
              size="sm"
              aria-label={`sub-goal progress for ${selectedGoal.title || "goal"}`}
              value={percent}
              classNames={{ track: "bg-zinc-800", indicator: "bg-emerald-500" }}
            />
            <p className="text-xs text-zinc-400">
              {subGoalProgress.completed}/{subGoalProgress.total} sub-goals done
            </p>
            <div className="space-y-2">
              {selectedGoal.subGoals.map((subGoal) => (
                <SubGoalItem
                  key={subGoal.id}
                  subGoal={subGoal}
                  onUpdateSubGoals={handleUpdateSubGoals}
                  editingSubGoalId={editingSubGoalId}
                  onSetEditingSubGoalId={setEditingSubGoalId}
                />
              ))}
            </div>
          </>
        )}
        {!hasSubGoals && <p className="text-sm text-zinc-500">no sub-goals yet.</p>}
      </div>
    );
  })();

  return (
    <div className="min-h-screen bg-zinc-950 px-5 py-8 text-zinc-100 sm:px-8 sm:py-10 font-[family-name:var(--font-space-grotesk)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">entity view</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">goals</h1>
          </div>
          <Button as={Link} href="/" variant="flat" className="bg-zinc-800 text-zinc-200">
            back to dashboard
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="border border-zinc-800 bg-zinc-900/80 text-zinc-100">
            <CardHeader className="pb-2">
              <h2 className="text-lg font-medium">all goals</h2>
            </CardHeader>
            <CardBody className="space-y-3 pt-2">
              {allGoals.map((goal) => {
                const active = getGoalRef(goal) === selectedGoalRef;
                return (
                  <button
                    type="button"
                    key={goal.id}
                    onClick={() => {
                      setSelectedGoalRef(getGoalRef(goal));
                      setEditMode(false);
                      setEditingSubGoalId("");
                    }}
                    className={`w-full rounded-xl border p-3 text-left transition ${active ? "border-cyan-500/60 bg-zinc-900" : "border-zinc-800 bg-zinc-950/50 hover:border-zinc-600"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-100">{goal.title || "untitled goal"}</p>
                      <Chip size="sm" variant="flat" className="bg-zinc-800 text-zinc-300">
                        {goal.goalType}
                      </Chip>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {goal.areaTags.map((tag) => (
                        <Chip key={`${goal.id}-${tag}`} size="sm" variant="flat" className={AREA_TAG_CLASSES[tag]}>
                          {AREA_LABELS[tag]}
                        </Chip>
                      ))}
                    </div>
                  </button>
                );
              })}
              {allGoals.length === 0 && <p className="text-sm text-zinc-400">no goals yet.</p>}
            </CardBody>
          </Card>

          <Card className="border border-zinc-800 bg-zinc-900/80 text-zinc-100">
            <CardHeader className="flex items-center justify-between gap-2 pb-2">
              <h2 className="text-lg font-medium">goal details</h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="flat"
                  className={editMode ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "bg-zinc-800 text-zinc-300"}
                  isDisabled={!selectedGoal}
                  onPress={() => setEditMode((prev) => !prev)}
                >
                  {editMode ? "edit mode" : "view mode"}
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  className="bg-teal-500/20 text-teal-300"
                  isDisabled={!selectedGoal}
                  onPress={() => saveLifeDataToStorage(data)}
                >
                  save goal
                </Button>
              </div>
            </CardHeader>
            <CardBody className="space-y-4 pt-2">
              {!selectedGoal && <p className="text-sm text-zinc-400">pick a goal from the left.</p>}

              {selectedGoal && !editMode && (
                <>
                  <h3 className="text-2xl font-semibold">{selectedGoal.title || "untitled goal"}</h3>
                  {selectedGoal.description && <p className="text-sm text-zinc-300">{selectedGoal.description}</p>}
                  <div className="flex flex-wrap gap-2">
                    {selectedGoal.priority && (
                      <Chip size="sm" variant="flat" className={PRIORITY_TAG_CLASSES[selectedGoal.priority]}>
                        {PRIORITY_LABELS[selectedGoal.priority]}
                      </Chip>
                    )}
                    {selectedGoal.timeline && (
                      <Chip size="sm" variant="flat" className={TIMELINE_TAG_CLASS}>
                        {TIMELINE_LABELS[selectedGoal.timeline]}
                      </Chip>
                    )}
                    {selectedGoal.areaTags.map((tag) => (
                      <Chip key={`${selectedGoal.id}-${tag}`} size="sm" variant="flat" className={AREA_TAG_CLASSES[tag]}>
                        {AREA_LABELS[tag]}
                      </Chip>
                    ))}
                    {selectedGoal.projectIds.map((projectId) => {
                      const project = data.projects.find((item) => item.id === projectId);
                      if (!project) {
                        return null;
                      }
                      return (
                        <Chip key={`${selectedGoal.id}-${project.id}`} size="sm" variant="flat" className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                          {project.title}
                        </Chip>
                      );
                    })}
                    {selectedGoal.dueDate && (
                      <Chip size="sm" variant="flat" className="bg-zinc-700 text-zinc-200">
                        due {selectedGoal.dueDate}
                      </Chip>
                    )}
                  </div>
                  {subGoalsSection}
                </>
              )}

              {selectedGoal && editMode && (
                <>
                  <Input
                    label="title"
                    labelPlacement="outside"
                    value={selectedGoal.title}
                    onValueChange={(value) => updateSelectedGoal((goal) => ({ ...goal, title: value }))}
                    variant="bordered"
                    classNames={{
                      inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
                      input: "text-zinc-100",
                      label: "text-zinc-400",
                    }}
                  />
                  <Textarea
                    label="description"
                    labelPlacement="outside"
                    minRows={3}
                    value={selectedGoal.description}
                    onValueChange={(value) => updateSelectedGoal((goal) => ({ ...goal, description: value }))}
                    variant="bordered"
                    classNames={{
                      inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
                      input: "text-zinc-100",
                      label: "text-zinc-400",
                    }}
                  />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      type="date"
                      label="due date"
                      labelPlacement="outside"
                      value={selectedGoal.dueDate}
                      onValueChange={(value) => updateSelectedGoal((goal) => ({ ...goal, dueDate: value }))}
                      variant="bordered"
                      classNames={{
                        inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
                        input: "text-zinc-100",
                        label: "text-zinc-400",
                      }}
                    />
                    <Select
                      label="priority"
                      labelPlacement="outside"
                      variant="bordered"
                      selectedKeys={selectedGoal.priority ? [selectedGoal.priority] : []}
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys as Set<string>)[0] as PriorityTag | undefined;
                        updateSelectedGoal((goal) => ({ ...goal, priority: selected ?? "" }));
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
                      {(Object.keys(PRIORITY_LABELS) as PriorityTag[]).map((priority) => (
                        <SelectItem key={priority} className="text-zinc-100">
                          {PRIORITY_LABELS[priority]}
                        </SelectItem>
                      ))}
                    </Select>
                    <Select
                      label="timeline"
                      labelPlacement="outside"
                      variant="bordered"
                      selectedKeys={selectedGoal.timeline ? [selectedGoal.timeline] : []}
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys as Set<string>)[0] as TimelineTag | undefined;
                        updateSelectedGoal((goal) => ({ ...goal, timeline: selected ?? "" }));
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
                      {(Object.keys(TIMELINE_LABELS) as TimelineTag[]).map((timeline) => (
                        <SelectItem key={timeline} className="text-zinc-100">
                          {TIMELINE_LABELS[timeline]}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">key areas</p>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(AREA_LABELS) as LifeArea[]).map((area) => {
                        const selected = selectedGoal.areaTags.includes(area);
                        return (
                          <Button
                            key={`${selectedGoal.id}-${area}`}
                            size="sm"
                            variant={selected ? "flat" : "bordered"}
                            className={
                              selected
                                ? AREA_TAG_CLASSES[area]
                                : "border-zinc-700 text-zinc-300 bg-zinc-900 hover:bg-zinc-800"
                            }
                            onPress={() =>
                              updateSelectedGoal((goal) => ({
                                ...goal,
                                areaTags: selected ? goal.areaTags.filter((tag) => tag !== area) : [...goal.areaTags, area],
                              }))
                            }
                          >
                            {AREA_LABELS[area]}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  {subGoalsSection}
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

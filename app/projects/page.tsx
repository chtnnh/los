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
  defaultLifeData,
  loadLifeDataFromStorage,
  saveLifeDataToStorage,
  type LifeArea,
  type PriorityTag,
  type TimelineTag,
} from "@/lib/life-os-storage";

export default function ProjectsPage() {
  const [data, setData] = useState(defaultLifeData);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const loaded = loadLifeDataFromStorage();
      setData(loaded);
      if (loaded.projects[0]) {
        setSelectedProjectId(loaded.projects[0].id);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const selectedProject = useMemo(
    () => data.projects.find((project) => project.id === selectedProjectId) ?? null,
    [data.projects, selectedProjectId],
  );

  const goalsForProject = useMemo(() => {
    if (!selectedProject) {
      return [];
    }
    return [...data.goals.daily, ...data.goals.weekly, ...data.goals.monthly].filter((goal) =>
      goal.projectIds.includes(selectedProject.id),
    );
  }, [data.goals, selectedProject]);

  const completionPercent = useMemo(() => {
    if (goalsForProject.length === 0) {
      return 0;
    }
    const done = goalsForProject.filter((goal) => goal.completed).length;
    return Math.round((done / goalsForProject.length) * 100);
  }, [goalsForProject]);

  const updateSelectedProject = (
    updater: (project: (typeof data.projects)[number]) => (typeof data.projects)[number],
  ) => {
    if (!selectedProject) {
      return;
    }
    setData((prev) => ({
      ...prev,
      projects: prev.projects.map((project) => (project.id === selectedProject.id ? updater(project) : project)),
    }));
  };

  return (
    <div className="min-h-screen bg-zinc-950 px-5 py-8 text-zinc-100 sm:px-8 sm:py-10 font-[family-name:var(--font-space-grotesk)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">entity view</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">projects</h1>
          </div>
          <Button as={Link} href="/" variant="flat" className="bg-zinc-800 text-zinc-200">
            back to dashboard
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="border border-zinc-800 bg-zinc-900/80 text-zinc-100">
            <CardHeader className="pb-2">
              <h2 className="text-lg font-medium">all projects</h2>
            </CardHeader>
            <CardBody className="space-y-3 pt-2">
              {data.projects.map((project) => {
                const linkedGoals = [...data.goals.daily, ...data.goals.weekly, ...data.goals.monthly].filter((goal) =>
                  goal.projectIds.includes(project.id),
                );
                const done = linkedGoals.filter((goal) => goal.completed).length;
                const projectProgress = linkedGoals.length === 0 ? 0 : Math.round((done / linkedGoals.length) * 100);
                const active = project.id === selectedProjectId;
                return (
                  <button
                    type="button"
                    key={project.id}
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setEditMode(false);
                    }}
                    className={`w-full rounded-xl border p-3 text-left transition ${active ? "border-cyan-500/60 bg-zinc-900" : "border-zinc-800 bg-zinc-950/50 hover:border-zinc-600"}`}
                  >
                    <p className="text-sm font-medium text-zinc-100">{project.title || "untitled project"}</p>
                    <Progress
                      aria-label={`progress ${project.title || "project"}`}
                      className="mt-2"
                      value={projectProgress}
                      size="sm"
                      color="primary"
                    />
                    <p className="mt-1 text-xs text-zinc-400">{done}/{linkedGoals.length} goals done</p>
                  </button>
                );
              })}
              {data.projects.length === 0 && <p className="text-sm text-zinc-400">no projects yet.</p>}
            </CardBody>
          </Card>

          <Card className="border border-zinc-800 bg-zinc-900/80 text-zinc-100">
            <CardHeader className="flex items-center justify-between gap-2 pb-2">
              <h2 className="text-lg font-medium">project details</h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="flat"
                  className={editMode ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "bg-zinc-800 text-zinc-300"}
                  isDisabled={!selectedProject}
                  onPress={() => setEditMode((prev) => !prev)}
                >
                  {editMode ? "edit mode" : "view mode"}
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  className="bg-teal-500/20 text-teal-300"
                  isDisabled={!selectedProject}
                  onPress={() => saveLifeDataToStorage(data)}
                >
                  save project
                </Button>
              </div>
            </CardHeader>
            <CardBody className="space-y-4 pt-2">
              {!selectedProject && <p className="text-sm text-zinc-400">pick a project from the left.</p>}

              {selectedProject && (
                <>
                  <Progress aria-label="selected project progress" value={completionPercent} size="sm" color="primary" />
                  <p className="text-xs text-zinc-400">{goalsForProject.filter((goal) => goal.completed).length}/{goalsForProject.length} linked goals done</p>
                </>
              )}

              {selectedProject && !editMode && (
                <>
                  <h3 className="text-2xl font-semibold">{selectedProject.title || "untitled project"}</h3>
                  {selectedProject.description && <p className="text-sm text-zinc-300">{selectedProject.description}</p>}
                  <div className="flex flex-wrap gap-2">
                    {selectedProject.priority && (
                      <Chip size="sm" variant="flat" className={PRIORITY_TAG_CLASSES[selectedProject.priority]}>
                        {PRIORITY_LABELS[selectedProject.priority]}
                      </Chip>
                    )}
                    {selectedProject.timeline && (
                      <Chip size="sm" variant="flat" className={TIMELINE_TAG_CLASS}>
                        {TIMELINE_LABELS[selectedProject.timeline]}
                      </Chip>
                    )}
                    {selectedProject.areaTags.map((tag) => (
                      <Chip key={`${selectedProject.id}-${tag}`} size="sm" variant="flat" className={AREA_TAG_CLASSES[tag]}>
                        {AREA_LABELS[tag]}
                      </Chip>
                    ))}
                    {selectedProject.dueDate && (
                      <Chip size="sm" variant="flat" className="bg-zinc-700 text-zinc-200">
                        due {selectedProject.dueDate}
                      </Chip>
                    )}
                  </div>
                </>
              )}

              {selectedProject && editMode && (
                <>
                  <Input
                    label="title"
                    labelPlacement="outside"
                    value={selectedProject.title}
                    onValueChange={(value) => updateSelectedProject((project) => ({ ...project, title: value }))}
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
                    value={selectedProject.description}
                    onValueChange={(value) => updateSelectedProject((project) => ({ ...project, description: value }))}
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
                      value={selectedProject.dueDate}
                      onValueChange={(value) => updateSelectedProject((project) => ({ ...project, dueDate: value }))}
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
                      selectedKeys={selectedProject.priority ? [selectedProject.priority] : []}
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys as Set<string>)[0] as PriorityTag | undefined;
                        updateSelectedProject((project) => ({ ...project, priority: selected ?? "" }));
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
                      selectedKeys={selectedProject.timeline ? [selectedProject.timeline] : []}
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys as Set<string>)[0] as TimelineTag | undefined;
                        updateSelectedProject((project) => ({ ...project, timeline: selected ?? "" }));
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
                        const selected = selectedProject.areaTags.includes(area);
                        return (
                          <Button
                            key={`${selectedProject.id}-${area}`}
                            size="sm"
                            variant={selected ? "flat" : "bordered"}
                            className={
                              selected
                                ? AREA_TAG_CLASSES[area]
                                : "border-zinc-700 text-zinc-300 bg-zinc-900 hover:bg-zinc-800"
                            }
                            onPress={() =>
                              updateSelectedProject((project) => ({
                                ...project,
                                areaTags: selected
                                  ? project.areaTags.filter((tag) => tag !== area)
                                  : [...project.areaTags, area],
                              }))
                            }
                          >
                            {AREA_LABELS[area]}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

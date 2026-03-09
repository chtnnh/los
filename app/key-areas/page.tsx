"use client";

import Link from "next/link";
import { Button, Card, CardBody, CardHeader, Chip, Progress } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { AREA_LABELS, AREA_TAG_CLASSES, defaultLifeData, loadLifeDataFromStorage, type LifeArea } from "@/lib/life-os-storage";

export default function KeyAreasPage() {
  const [data, setData] = useState(defaultLifeData);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setData(loadLifeDataFromStorage());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const areas = useMemo(() => Object.keys(AREA_LABELS) as LifeArea[], []);

  return (
    <div className="min-h-screen bg-zinc-950 px-5 py-8 text-zinc-100 sm:px-8 sm:py-10 font-[family-name:var(--font-space-grotesk)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">entity view</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">key areas</h1>
          </div>
          <Button as={Link} href="/" variant="flat" className="bg-zinc-800 text-zinc-200">
            back to dashboard
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((area) => {
            const linkedGoals = [...data.goals.daily, ...data.goals.weekly, ...data.goals.monthly].filter((goal) =>
              goal.areaTags.includes(area),
            );
            const goalsCount = linkedGoals.length;
            const completedGoals = linkedGoals.filter((goal) => goal.completed).length;
            const completionPercent = goalsCount === 0 ? 0 : Math.round((completedGoals / goalsCount) * 100);

            const projectsCount = data.projects.filter((project) => project.areaTags.includes(area)).length;

            return (
              <Card key={area} className="border border-zinc-800 bg-zinc-900/80 text-zinc-100">
                <CardHeader className="pb-1">
                  <div className="flex items-center gap-2">
                    <Chip size="sm" variant="flat" className={AREA_TAG_CLASSES[area]}>
                      {AREA_LABELS[area]}
                    </Chip>
                  </div>
                </CardHeader>
                <CardBody className="space-y-3 pt-1">
                  <p className="min-h-16 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-sm leading-relaxed text-zinc-300">
                    {data.visions[area].trim() || "no vision written yet."}
                  </p>
                  <Progress
                    aria-label={`${AREA_LABELS[area]} progress`}
                    value={completionPercent}
                    size="sm"
                    color="primary"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Chip size="sm" variant="flat" className="bg-zinc-700 text-zinc-200">
                      {completedGoals}/{goalsCount} goals done
                    </Chip>
                    <Chip size="sm" variant="flat" className="bg-zinc-700 text-zinc-200">
                      {projectsCount} projects
                    </Chip>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

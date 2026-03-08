"use client";

import { Button, Card, CardBody, CardHeader, Chip, Input, Tab, Tabs, Textarea } from "@heroui/react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

type LifeArea = "health" | "work" | "relationships" | "financial" | "learning" | "soul";
type GoalType = "daily" | "weekly" | "monthly";

type LifeData = {
  visions: Record<LifeArea, string>;
  goals: Record<GoalType, string[]>;
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

const GOAL_LABELS: Record<GoalType, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

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
    daily: ["", "", ""],
    weekly: ["", "", ""],
    monthly: ["", "", ""],
  },
  todayFocus: "",
  energyPlan: "",
};

function normalizeData(parsed: unknown): LifeData {
  if (!parsed || typeof parsed !== "object") {
    return defaultData;
  }

  const value = parsed as {
    visions?: Record<string, string>;
    goals?: Record<string, string[]>;
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
      daily: Array.isArray(value.goals?.daily) ? value.goals?.daily.slice(0, 3) : ["", "", ""],
      weekly: Array.isArray(value.goals?.weekly) ? value.goals?.weekly.slice(0, 3) : ["", "", ""],
      monthly: Array.isArray(value.goals?.monthly) ? value.goals?.monthly.slice(0, 3) : ["", "", ""],
    },
    todayFocus: value.todayFocus ?? "",
    energyPlan: value.energyPlan ?? "",
  };
}

export default function Home() {
  const [data, setData] = useState<LifeData>(defaultData);
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
      // keep default data if parsing fails
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
      .filter((g) => g.trim().length > 0).length;
    const otherCount = [data.todayFocus, data.energyPlan].filter((v) => v.trim().length > 0).length;
    return visionCount + goalCount + otherCount;
  }, [data]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-[family-name:var(--font-space-grotesk)]">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
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
              {filledCount} fields filled
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

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
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
                  <h2 className="text-xl font-medium">goal stack</h2>
                  <p className="mt-1 text-sm text-zinc-400">daily, weekly, monthly targets</p>
                </div>
              </CardHeader>
              <CardBody className="pt-4">
                <Tabs variant="underlined" color="primary">
                  {(Object.keys(GOAL_LABELS) as GoalType[]).map((kind) => (
                    <Tab key={kind} title={GOAL_LABELS[kind]}>
                      <div className="space-y-3">
                        {[0, 1, 2].map((idx) => (
                          <Input
                            key={`${kind}-${idx}`}
                            value={data.goals[kind][idx] ?? ""}
                            onValueChange={(value) =>
                              setData((prev) => ({
                                ...prev,
                                goals: {
                                  ...prev.goals,
                                  [kind]: prev.goals[kind].map((item, i) => (i === idx ? value : item)),
                                },
                              }))
                            }
                            variant="bordered"
                            placeholder={`${GOAL_LABELS[kind]} goal ${idx + 1}`}
                            classNames={{
                              inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
                              input: "text-zinc-100 placeholder:text-zinc-500",
                            }}
                          />
                        ))}
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
                  quick loop: read your vision, pick the smallest next move, and schedule it before noise takes over.
                </p>
              </CardBody>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

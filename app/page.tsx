"use client";

import { Button, Card, CardBody, CardHeader, Chip, Input, Tab, Tabs, Textarea } from "@heroui/react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

type LifeArea = "health" | "work" | "relationships" | "money" | "mind";
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
  money: "Money",
  mind: "Mind",
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
    money: "",
    mind: "",
  },
  goals: {
    daily: ["", "", ""],
    weekly: ["", "", ""],
    monthly: ["", "", ""],
  },
  todayFocus: "",
  energyPlan: "",
};

export default function Home() {
  const [data, setData] = useState<LifeData>(defaultData);
  const [activeArea, setActiveArea] = useState<LifeArea>("health");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as LifeData;
      setData({ ...defaultData, ...parsed });
    } catch {
      setData(defaultData);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 1000);
    return () => clearTimeout(t);
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
            {saved && <span className="text-xs text-zinc-400">saved</span>}
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
                  <h2 className="text-xl font-medium">vision by life area</h2>
                  <p className="mt-1 text-sm text-zinc-400">one sharp sentence for each area</p>
                </div>
              </CardHeader>
              <CardBody className="pt-4">
                <Tabs
                  selectedKey={activeArea}
                  onSelectionChange={(key) => setActiveArea(key as LifeArea)}
                  variant="underlined"
                  color="primary"
                >
                  {(Object.keys(AREA_LABELS) as LifeArea[]).map((area) => (
                    <Tab key={area} title={AREA_LABELS[area]}>
                      <Textarea
                        minRows={4}
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
                        placeholder={`what's your long-term vision for ${AREA_LABELS[area].toLowerCase()}?`}
                      />
                    </Tab>
                  ))}
                </Tabs>
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

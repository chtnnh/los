"use client";

import { Button, Chip, Input, Textarea } from "@heroui/react";
import {
  PRIORITY_LABELS,
  PRIORITY_TAG_CLASSES,
  TIMELINE_LABELS,
  TIMELINE_TAG_CLASS,
  addChildSubGoalById,
  createEmptySubGoal,
  createId,
  removeSubGoalById,
  updateSubGoalById,
  type PriorityTag,
  type SubGoalEntry,
  type TimelineTag,
} from "@/lib/life-os-storage";

type SubGoalItemProps = {
  subGoal: SubGoalEntry;
  onUpdateSubGoals: (updater: (subGoals: SubGoalEntry[]) => SubGoalEntry[]) => void;
  editingSubGoalId: string;
  onSetEditingSubGoalId: (id: string) => void;
  depth?: number;
};

function ReadOnlySubGoal({ subGoal, onUpdateSubGoals, editingSubGoalId, onSetEditingSubGoalId, depth = 0 }: SubGoalItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSetEditingSubGoalId(subGoal.id)}
      className="w-full space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-2 text-left transition hover:border-zinc-600"
    >
      <div className="flex items-center gap-2">
        <span
          role="button"
          tabIndex={0}
          className={
            subGoal.completed
              ? "flex h-8 w-8 min-w-8 items-center justify-center rounded-full text-xl font-black leading-none text-emerald-300"
              : "flex h-8 w-8 min-w-8 items-center justify-center rounded-full text-xl font-black leading-none text-zinc-300"
          }
          onClick={(e) => {
            e.stopPropagation();
            onUpdateSubGoals((subGoals) =>
              updateSubGoalById(subGoals, subGoal.id, (s) => ({ ...s, completed: !s.completed })),
            );
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              e.preventDefault();
              onUpdateSubGoals((subGoals) =>
                updateSubGoalById(subGoals, subGoal.id, (s) => ({ ...s, completed: !s.completed })),
              );
            }
          }}
        >
          {subGoal.completed ? "✓" : "◯"}
        </span>
        <p className={`text-xs ${subGoal.completed ? "text-zinc-500 line-through" : "text-zinc-300"}`}>
          {subGoal.title.trim() || "untitled sub-goal"}
        </p>
      </div>
      {subGoal.description.trim().length > 0 && (
        <p className="text-xs leading-relaxed text-zinc-400">{subGoal.description}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {subGoal.dueDate.length > 0 && (
          <Chip size="sm" variant="flat" className="bg-zinc-800 text-zinc-300">
            due {subGoal.dueDate}
          </Chip>
        )}
        {subGoal.priority && (
          <Chip size="sm" variant="flat" className={PRIORITY_TAG_CLASSES[subGoal.priority]}>
            {PRIORITY_LABELS[subGoal.priority]}
          </Chip>
        )}
        {subGoal.timeline && (
          <Chip size="sm" variant="flat" className={TIMELINE_TAG_CLASS}>
            {TIMELINE_LABELS[subGoal.timeline]}
          </Chip>
        )}
      </div>
      {subGoal.children.length > 0 && (
        <div className="ml-4 mt-2 space-y-2">
          {subGoal.children.map((child) => (
            <SubGoalItem
              key={child.id}
              subGoal={child}
              onUpdateSubGoals={onUpdateSubGoals}
              editingSubGoalId={editingSubGoalId}
              onSetEditingSubGoalId={onSetEditingSubGoalId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </button>
  );
}

function EditableSubGoal({ subGoal, onUpdateSubGoals, editingSubGoalId, onSetEditingSubGoalId, depth = 0 }: SubGoalItemProps) {
  return (
    <div className="space-y-3 rounded-lg border border-cyan-500/40 bg-zinc-950/40 p-2">
      <div className="flex items-center gap-2">
        <Button
          isIconOnly
          size="sm"
          variant="light"
          className={
            subGoal.completed
              ? "h-8 w-8 min-w-8 rounded-full border-0 bg-transparent p-0 text-xl font-black leading-none text-emerald-300 shadow-none data-[hover=true]:bg-transparent"
              : "h-8 w-8 min-w-8 rounded-full border-0 bg-transparent p-0 text-xl font-black leading-none text-zinc-300 shadow-none data-[hover=true]:bg-transparent"
          }
          onPress={() =>
            onUpdateSubGoals((subGoals) =>
              updateSubGoalById(subGoals, subGoal.id, (s) => ({ ...s, completed: !s.completed })),
            )
          }
        >
          {subGoal.completed ? "✓" : "◯"}
        </Button>
        <Input
          variant="bordered"
          value={subGoal.title}
          onValueChange={(value) =>
            onUpdateSubGoals((subGoals) =>
              updateSubGoalById(subGoals, subGoal.id, (s) => ({ ...s, title: value })),
            )
          }
          placeholder="sub-goal title"
          classNames={{
            inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
            input: "text-zinc-100 placeholder:text-zinc-500",
          }}
        />
        <Button
          size="sm"
          variant="light"
          className="text-zinc-400"
          onPress={() =>
            onUpdateSubGoals((subGoals) =>
              addChildSubGoalById(subGoals, subGoal.id, {
                ...createEmptySubGoal(createId("subgoal")),
                title: "new sub-goal",
              }),
            )
          }
        >
          add child
        </Button>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          className="text-teal-400 data-[hover=true]:text-teal-300"
          aria-label="done editing"
          onPress={() => onSetEditingSubGoalId("")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-[1.2rem] w-[1.2rem]">
            <path d="M15.988 3.012A2.25 2.25 0 0 1 18 5.25v6.5A2.25 2.25 0 0 1 15.75 14H13.5v-3.379a3 3 0 0 0-.879-2.121l-3.12-3.121a3 3 0 0 0-1.402-.791 2.252 2.252 0 0 1 1.913-1.576L10.5 3h3.5a2.25 2.25 0 0 1 1.988 1.012ZM11.013 16.938a2.252 2.252 0 0 0 1.966-1.658L13 15.25V10.621a1.5 1.5 0 0 0-.44-1.06l-3.12-3.122a1.5 1.5 0 0 0-1.06-.44H4.25A2.25 2.25 0 0 0 2 8.25v6.5A2.25 2.25 0 0 0 4.25 17h4.5c.865 0 1.624-.488 2.003-1.204l.26.142Z" />
          </svg>
        </Button>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          className="text-rose-400 data-[hover=true]:text-rose-300"
          aria-label="delete sub-goal"
          onPress={() => {
            onSetEditingSubGoalId("");
            onUpdateSubGoals((subGoals) => removeSubGoalById(subGoals, subGoal.id));
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-[1.2rem] w-[1.2rem]">
            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
          </svg>
        </Button>
      </div>
      <Textarea
        minRows={2}
        variant="bordered"
        value={subGoal.description}
        onValueChange={(value) =>
          onUpdateSubGoals((subGoals) =>
            updateSubGoalById(subGoals, subGoal.id, (s) => ({ ...s, description: value })),
          )
        }
        placeholder="sub-goal description"
        classNames={{
          inputWrapper: "bg-zinc-950 border-zinc-700 data-[hover=true]:border-zinc-500",
          input: "text-zinc-100 placeholder:text-zinc-500 resize-y",
        }}
      />
      <Input
        type="date"
        label="sub-goal due date"
        labelPlacement="outside"
        variant="bordered"
        value={subGoal.dueDate}
        onValueChange={(value) =>
          onUpdateSubGoals((subGoals) =>
            updateSubGoalById(subGoals, subGoal.id, (s) => ({ ...s, dueDate: value })),
          )
        }
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
            const selected = subGoal.priority === priority;
            return (
              <Button
                key={`${subGoal.id}-priority-${priority}`}
                size="sm"
                variant={selected ? "flat" : "bordered"}
                className={
                  selected
                    ? PRIORITY_TAG_CLASSES[priority]
                    : "border-zinc-700 text-zinc-300"
                }
                onPress={() =>
                  onUpdateSubGoals((subGoals) =>
                    updateSubGoalById(subGoals, subGoal.id, (s) => ({
                      ...s,
                      priority: s.priority === priority ? "" : priority,
                    })),
                  )
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
            const selected = subGoal.timeline === timeline;
            return (
              <Button
                key={`${subGoal.id}-timeline-${timeline}`}
                size="sm"
                variant={selected ? "flat" : "bordered"}
                className={
                  selected
                    ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/40"
                    : "border-zinc-700 text-zinc-300"
                }
                onPress={() =>
                  onUpdateSubGoals((subGoals) =>
                    updateSubGoalById(subGoals, subGoal.id, (s) => ({
                      ...s,
                      timeline: s.timeline === timeline ? "" : timeline,
                    })),
                  )
                }
              >
                {TIMELINE_LABELS[timeline]}
              </Button>
            );
          })}
        </div>
      </div>
      {subGoal.children.length > 0 && (
        <div className="ml-4 mt-2 space-y-2">
          {subGoal.children.map((child) => (
            <SubGoalItem
              key={child.id}
              subGoal={child}
              onUpdateSubGoals={onUpdateSubGoals}
              editingSubGoalId={editingSubGoalId}
              onSetEditingSubGoalId={onSetEditingSubGoalId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SubGoalItem({ subGoal, onUpdateSubGoals, editingSubGoalId, onSetEditingSubGoalId, depth = 0 }: SubGoalItemProps) {
  if (subGoal.id === editingSubGoalId) {
    return <EditableSubGoal subGoal={subGoal} onUpdateSubGoals={onUpdateSubGoals} editingSubGoalId={editingSubGoalId} onSetEditingSubGoalId={onSetEditingSubGoalId} depth={depth} />;
  }
  return <ReadOnlySubGoal subGoal={subGoal} onUpdateSubGoals={onUpdateSubGoals} editingSubGoalId={editingSubGoalId} onSetEditingSubGoalId={onSetEditingSubGoalId} depth={depth} />;
}

"use client"

import { useDroppable } from "@dnd-kit/core";
import { Project } from "@/types";
import { ProjectCard } from "./ProjectCard";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
    id: string;
    projects: Project[];
    title: string;
}

export function KanbanColumn({ id, projects, title }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: id,
    });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "bg-muted/50 p-4 rounded-xl min-w-[280px] w-full flex flex-col gap-2 h-full min-h-[500px] border-2 border-transparent transition-colors",
                isOver && "border-primary/20 bg-muted/80"
            )}
        >
            <div className="font-bold mb-3 flex justify-between items-center text-xs uppercase tracking-wider text-muted-foreground">
                {title}
                <span className="bg-background px-2 py-0.5 rounded-full text-[10px] font-bold border border-border shadow-sm">
                    {projects.length}
                </span>
            </div>

            <SortableContext
                id={id}
                items={projects.map(p => p.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="flex flex-col gap-3 flex-1">
                    {projects.map((project) => (
                        <ProjectCard key={project.id} project={project} />
                    ))}
                    {projects.length === 0 && (
                        <div className="h-24 border-2 border-dashed border-muted-foreground/20 rounded-lg flex items-center justify-center text-muted-foreground text-xs">
                            Soltar aquí
                        </div>
                    )}
                </div>
            </SortableContext>
        </div>
    );
}

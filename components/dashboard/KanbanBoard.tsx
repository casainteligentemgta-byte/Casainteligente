"use client"

import { useState } from "react"
import { DndContext, DragOverlay, DragStartEvent, DragEndEvent, DragOverEvent, useSensor, useSensors, PointerSensor, KeyboardSensor, closestCorners } from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { Project, ProjectStatus } from "@/types"
import { KanbanColumn } from "./KanbanColumn"
import { ProjectCard } from "./ProjectCard"
import { updateProjectStatus } from "@/app/actions/projects"

const COLUMNS: ProjectStatus[] = ["Pendiente", "En Progreso", "Pruebas", "Completado"]

export function KanbanBoard({ initialProjects }: { initialProjects: Project[] }) {
    const [projects, setProjects] = useState(initialProjects)
    const [mounted, setMounted] = useState(false)
    const [activeProject, setActiveProject] = useState<Project | null>(null)

    useState(() => {
        setMounted(true)
    })

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event
        const project = projects.find(p => p.id === active.id)
        if (project) setActiveProject(project)
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event

        if (!over) {
            setActiveProject(null)
            return
        }

        const activeId = active.id
        const overId = over.id

        let newStatus: ProjectStatus | null = null;

        // Check if dropped directly on a column container
        if (COLUMNS.includes(overId as ProjectStatus)) {
            newStatus = overId as ProjectStatus
        } else {
            // Find the project we dropped over to determine the column
            const overProject = projects.find(p => p.id === overId)
            if (overProject) {
                newStatus = overProject.status
            }
        }

        if (newStatus && activeProject && activeProject.status !== newStatus) {
            // Optimistic update
            setProjects(current => current.map(p =>
                p.id === activeId ? { ...p, status: newStatus! } : p
            ))

            // Call server action
            await updateProjectStatus(activeId as string, newStatus)
        }

        setActiveProject(null)
    }

    if (!mounted) {
        return <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando tablero...</div>;
    }


    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex flex-col md:flex-row gap-6 h-full overflow-x-auto pb-4 snap-x snap-mandatory">
                {COLUMNS.map(status => (
                    <div key={status} className="snap-center h-full">
                        <KanbanColumn
                            id={status}
                            title={status}
                            projects={projects.filter(p => p.status === status)}
                        />
                    </div>
                ))}
            </div>
            <DragOverlay>
                {activeProject ? (
                    <div className="opacity-80 rotate-2 cursor-grabbing pointer-events-none">
                        <ProjectCard project={activeProject} isOverlay />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    )
}

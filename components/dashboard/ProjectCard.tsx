"use client"

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Project } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

interface ProjectCardProps {
    project: Project;
    isOverlay?: boolean;
}

export function ProjectCard({ project, isOverlay }: ProjectCardProps) {
    const {
        setNodeRef,
        attributes,
        listeners,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: project.id,
        data: {
            type: "Project",
            project,
        },
        disabled: isOverlay,
    });

    const style = {
        transition,
        transform: CSS.Transform.toString(transform),
    };

    const calculateROI = (sale: number, cost: number) => {
        return ((sale - cost) / sale) * 100;
    };

    const isLowMargin = project.budget && calculateROI(project.budget.sale_price, project.budget.cost_price) < 20;

    if (isOverlay) {
        return (
            <div className="touch-none mb-3 opacity-90 scale-105 shadow-xl cursor-grabbing">
                <Card className="cursor-grabbing border-primary">
                    <CardHeader className="p-3 pb-0">
                        <div className="flex justify-between items-start">
                            <CardTitle className="text-sm font-bold">{project.name}</CardTitle>
                            {isLowMargin && (
                                <Badge variant="destructive" className="ml-2 text-[10px] px-1 h-5">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    Margen Bajo
                                </Badge>
                            )}
                        </div>
                        <CardDescription className="text-xs truncate">{project.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 pt-2">
                        {project.budget && (
                            <div className="text-xs text-muted-foreground mt-1 flex justify-between">
                                <span>${project.budget.sale_price.toLocaleString()}</span>
                                <span className={isLowMargin ? 'text-destructive font-semibold' : 'text-green-600'}>
                                    ROI: {calculateROI(project.budget.sale_price, project.budget.cost_price).toFixed(1)}%
                                </span>
                            </div>
                        )}
                        <div className="mt-2 text-xs text-gray-400">ID: {project.id}</div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="opacity-30 bg-gray-50 p-2 h-[150px] rounded-lg border-2 border-primary border-dashed"
            />
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="touch-none mb-3"
        >
            <Card className="cursor-grab hover:shadow-md transition-shadow hover:border-primary/50">
                <CardHeader className="p-3 pb-0">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-sm font-bold">{project.name}</CardTitle>
                        {isLowMargin && (
                            <Badge variant="destructive" className="ml-2 text-[10px] px-1 h-5">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Margen Bajo
                            </Badge>
                        )}
                    </div>
                    <CardDescription className="text-xs truncate">{project.description}</CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-2">
                    {project.budget && (
                        <div className="text-xs text-muted-foreground mt-1 flex justify-between">
                            <span>${project.budget.sale_price.toLocaleString()}</span>
                            <span className={isLowMargin ? 'text-destructive font-semibold' : 'text-green-600'}>
                                ROI: {calculateROI(project.budget.sale_price, project.budget.cost_price).toFixed(1)}%
                            </span>
                        </div>
                    )}
                    <div className="mt-2 text-xs text-gray-400">ID: {project.id}</div>
                </CardContent>
            </Card>
        </div>
    );
}

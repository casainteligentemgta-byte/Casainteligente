// Arrastrar y soltar de mentira: en las capturas los renglones solo se ven, no se mueven.
import React from 'react';

export function DndContext({ children }: { children?: React.ReactNode }) { return <>{children}</>; }
export function DragOverlay({ children }: { children?: React.ReactNode }) { return <>{children}</>; }
export function SortableContext({ children }: { children?: React.ReactNode }) { return <>{children}</>; }
export class PointerSensor {}
export class MouseSensor {}
export class TouchSensor {}
export class KeyboardSensor {}
export const closestCenter = () => null;
export const useSensor = (..._a: unknown[]) => ({});
export const useSensors = (..._a: unknown[]) => [];
export const arrayMove = <T,>(lista: T[], de: number, a: number): T[] => {
  const copia = lista.slice();
  copia.splice(a, 0, ...copia.splice(de, 1));
  return copia;
};
export const sortableKeyboardCoordinates = () => undefined;
export const verticalListSortingStrategy = () => null;
export function useSortable(_o?: unknown) {
  return { attributes: {}, listeners: {}, setNodeRef: () => {}, setActivatorNodeRef: () => {}, transform: null, transition: undefined, isDragging: false };
}
export const CSS = { Transform: { toString: () => undefined }, Translate: { toString: () => undefined } };

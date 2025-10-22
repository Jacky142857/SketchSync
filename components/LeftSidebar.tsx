"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

import { getShapeInfo } from "@/lib/utils";
import { useWebSocket } from "@/lib/useWebSocket";

interface ShapeHierarchy {
  objectId: string;
  data: any;
  children: ShapeHierarchy[];
  parentId?: string;
}

const LeftSidebar = ({ allShapes }: { allShapes: Array<any> }) => {
  const { deleteShape, updateShapeHierarchy } = useWebSocket();
  const [expandedShapes, setExpandedShapes] = useState<Set<string>>(new Set());
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  console.log('[LeftSidebar] Received allShapes:', allShapes);
  console.log('[LeftSidebar] allShapes type:', typeof allShapes);
  console.log('[LeftSidebar] allShapes is array?:', Array.isArray(allShapes));
  console.log('[LeftSidebar] allShapes length:', allShapes?.length);

  // Build hierarchical structure from flat shapes list
  const shapeHierarchy = useMemo(() => {
    const hierarchy: ShapeHierarchy[] = [];
    const shapeMap = new Map<string, ShapeHierarchy>();

    console.log('[LeftSidebar] Building hierarchy from allShapes:', allShapes);

    // First pass: create all shape nodes
    allShapes?.forEach((shape: any, idx: number) => {
      console.log(`[LeftSidebar] Processing shape ${idx}:`, shape);
      // shape is [objectId, shapeData] from Map.entries()
      const objectId = shape[0];  // The key IS the objectId
      const shapeData = shape[1];  // The value is the shape data
      const parentId = shapeData?.parentId;

      console.log(`[LeftSidebar]   objectId: ${objectId}, parentId: ${parentId}`);

      if (objectId) {
        shapeMap.set(objectId, {
          objectId,
          data: shapeData,
          children: [],
          parentId: parentId || undefined
        });
      }
    });

    console.log('[LeftSidebar] shapeMap after first pass:', shapeMap);

    // Second pass: build parent-child relationships
    shapeMap.forEach((shapeNode) => {
      if (shapeNode.parentId && shapeMap.has(shapeNode.parentId)) {
        const parent = shapeMap.get(shapeNode.parentId)!;
        parent.children.push(shapeNode);
      } else {
        // Root level shapes (no parent or parent not found)
        hierarchy.push(shapeNode);
      }
    });

    console.log('[LeftSidebar] Final hierarchy:', hierarchy);

    return hierarchy;
  }, [allShapes]);

  const toggleExpand = (objectId: string) => {
    setExpandedShapes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(objectId)) {
        newSet.delete(objectId);
      } else {
        newSet.add(objectId);
      }
      return newSet;
    });
  };

  const handleDragStart = (e: React.DragEvent, objectId: string) => {
    setDraggedItem(objectId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, objectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedItem !== objectId) {
      setDropTarget(objectId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDropTarget(null);
  };

  const handleDrop = (e: React.DragEvent, targetObjectId: string) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('[LeftSidebar] handleDrop - draggedItem:', draggedItem, 'targetObjectId:', targetObjectId);

    if (draggedItem && draggedItem !== targetObjectId) {
      console.log('[LeftSidebar] Calling updateShapeHierarchy:', draggedItem, '->', targetObjectId);
      // Update the parent-child relationship
      updateShapeHierarchy(draggedItem, targetObjectId);
      // Auto-expand the target to show the new child
      setExpandedShapes(prev => new Set([...prev, targetObjectId]));
    }

    setDraggedItem(null);
    setDropTarget(null);
  };

  const renderShape = (shapeNode: ShapeHierarchy, depth: number = 0) => {
    const info = getShapeInfo(shapeNode.data?.type);
    const hasChildren = shapeNode.children.length > 0;
    const isExpanded = expandedShapes.has(shapeNode.objectId);
    const isDraggedOver = dropTarget === shapeNode.objectId;
    const isDragging = draggedItem === shapeNode.objectId;

    return (
      <div key={shapeNode.objectId} className="flex flex-col">
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, shapeNode.objectId)}
          onDragOver={(e) => handleDragOver(e, shapeNode.objectId)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, shapeNode.objectId)}
          className={`group flex items-center gap-2 py-2 hover:cursor-pointer hover:bg-primary-green hover:text-primary-black ${
            isDraggedOver ? 'bg-primary-green/50 border-l-2 border-primary-green' : ''
          } ${isDragging ? 'opacity-50' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 20}px` }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (confirm(`Delete ${info.name}?`)) {
              deleteShape(shapeNode.objectId);
            }
          }}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(shapeNode.objectId);
              }}
              className="w-4 h-4 flex items-center justify-center"
            >
              <svg
                width="8"
                height="8"
                viewBox="0 0 8 8"
                fill="none"
                className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              >
                <path d="M2 1L6 4L2 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          {!hasChildren && <div className="w-4" />}

          <Image
            src={info?.icon}
            alt='Layer'
            width={16}
            height={16}
            className='group-hover:invert'
          />
          <h3 className='text-sm font-normal capitalize'>{info.name}</h3>
        </div>

        {/* Render children */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col">
            {shapeNode.children.map((child) => renderShape(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="flex flex-col border-t border-primary-grey-200 bg-primary-black text-primary-grey-300 min-w-[227px] sticky left-0 h-full max-sm:hidden select-none overflow-y-auto pb-20">
      <h3 className="border-b border-primary-grey-200 px-5 py-3 text-xs uppercase">Layers</h3>

      <div className="flex flex-col">
        {shapeHierarchy.map((shapeNode) => renderShape(shapeNode, 0))}
      </div>
    </section>
  );
};

export default LeftSidebar;

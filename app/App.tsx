'use client'

import Live from "@/components/Live";
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import RightSidebar from "@/components/RightSidebar";
import { useEffect, useRef, useState } from "react";
import { fabric } from "fabric"
import { handleCanvasMouseDown, handleCanvasMouseUp, handleCanvasObjectModified, handleCanvasObjectScaling, handleCanvasSelectionCreated, handleCanvaseMouseMove, handlePathCreated, handleResize, initializeFabric, renderCanvas } from "@/lib/canvas";
import { ActiveElement, Attributes } from "@/types/type";
import { useStorage, useUndo, useRedo } from "@/lib/useWebSocket";
import { useWebSocket } from "@/lib/useWebSocket";
import { defaultNavElement } from "@/constants";
import { handleDelete, handleKeyDown } from "@/lib/key-events";
import { handleImageUpload } from "@/lib/shapes";


export default function Page() {
  const undo = useUndo();
  const redo = useRedo();
  const { syncShape, deleteShape, deleteAllShapes: deleteAll } = useWebSocket();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const isDrawing = useRef(false);
  const shapeRef = useRef<fabric.Object | null>(null);
  const selectedShapeRef = useRef<string | null>(null);
  const activeObjectRef = useRef<fabric.Object | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const isEditingRef  = useRef(false);
  const isModifyingRef = useRef(false);

  const [elementAttributes, setElementAttributes] = useState<Attributes>({
    width: '',
    height: '',
    fontSize:'',
    fontFamily:'',
    fontWeight:'',
    fill: '#aabbcc',
    stroke: '#aabbcc'
  });
  const [activeElement, setActiveElement] = useState<ActiveElement>({
    name:'',
    value:'',
    icon:''
  })
  const canvasObjects = useStorage((root) => root.canvasObjects)

  // Helper function to get all children of a shape recursively
  const getAllChildren = (parentId: string): string[] => {
    const children: string[] = [];
    const allShapesArray = Array.from(canvasObjects);

    allShapesArray.forEach(([objectId, shapeData]) => {
      if (shapeData.parentId === parentId) {
        children.push(objectId);
        // Recursively get children of this child
        children.push(...getAllChildren(objectId));
      }
    });

    return children;
  };

  // Helper function to move children relative to parent movement
  const moveChildrenWithParent = (parentObject: any, deltaX: number, deltaY: number, syncNow: boolean = false) => {
    if (!fabricRef.current) return;

    const parentId = parentObject.objectId;
    const childrenIds = getAllChildren(parentId);

    childrenIds.forEach(childId => {
      const childObject = fabricRef.current?.getObjects().find((obj: any) => obj.objectId === childId);
      if (childObject) {
        childObject.set({
          left: (childObject.left || 0) + deltaX,
          top: (childObject.top || 0) + deltaY
        });
        childObject.setCoords();

        // Only sync if explicitly requested (on mouse up)
        if (syncNow) {
          syncShapeInStorage(childObject);
        }
      }
    });

    fabricRef.current.renderAll();
  };

  const syncShapeInStorage = (object: any) => {
    if(!object) return;
    const { objectId } = object;
    const shapeData = object.toJSON();
    shapeData.objectId = objectId;

    syncShape(objectId, shapeData);
  }

  const deleteAllShapes = () => {
    deleteAll();
    return true;
  }

  const deleteShapeFromStorage = (objectId: string) => {
    deleteShape(objectId);
  }

  const handleActiveElement = (elem: ActiveElement) => {
    setActiveElement(elem);

    switch (elem?.value) {
      case 'reset': 
        deleteAllShapes();
        fabricRef.current?.clear();
        setActiveElement(defaultNavElement);
        break
      case 'delete':
        handleDelete(fabricRef.current as any, 
          deleteShapeFromStorage)
        setActiveElement(defaultNavElement)
        break;
      case 'image':
        imageInputRef.current?.click();
        isDrawing.current = false;

        if(fabricRef.current) {
          fabricRef.current.isDrawingMode = false;
        }
        break;
      default:
        break;
    }
    selectedShapeRef.current = elem?.value as string;
  }
  useEffect(() => {
    const canvas = initializeFabric({canvasRef, fabricRef});

    // Store previous positions for calculating deltas
    const previousPositions = new Map<string, { left: number; top: number }>();

    canvas.on("mouse:down", (options: any) => {
      handleCanvasMouseDown({
        options,
        canvas,
        isDrawing,
        shapeRef,
        selectedShapeRef
      });

      // Store initial position when starting to move an object
      const target = options.target;
      if (target && target.objectId) {
        previousPositions.set(target.objectId, {
          left: target.left || 0,
          top: target.top || 0
        });
      }
    })

    canvas.on("mouse:move", (options: any) => {
      handleCanvaseMouseMove({
        options,
        canvas,
        isDrawing,
        shapeRef,
        selectedShapeRef,
        syncShapeInStorage
      })
    })

    canvas.on("mouse:up", (options: any) => {
      handleCanvasMouseUp({
        canvas,
        isDrawing,
        shapeRef,
        selectedShapeRef,
        syncShapeInStorage,
        setActiveElement,
        activeObjectRef
      })
    })

    // Throttle for real-time sync during modifications
    let syncTimeout: NodeJS.Timeout | null = null;

    canvas.on("object:moving", (options: any) => {
      isModifyingRef.current = true;

      const target = options.target;
      if (target && target.objectId) {
        // Calculate delta from previous position
        const prevPos = previousPositions.get(target.objectId);
        if (prevPos) {
          const deltaX = (target.left || 0) - prevPos.left;
          const deltaY = (target.top || 0) - prevPos.top;

          // Move children with the same delta
          if (deltaX !== 0 || deltaY !== 0) {
            moveChildrenWithParent(target, deltaX, deltaY);
          }

          // Update previous position
          previousPositions.set(target.objectId, {
            left: target.left || 0,
            top: target.top || 0
          });
        }
      }

      // Throttle syncing to avoid overwhelming the server
      if (syncTimeout) clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        if (target && target.objectId) {
          syncShapeInStorage(target);
        }
      }, 50); // Sync every 50ms max
    })

    canvas.on("object:scaling", (options: any) => {
      isModifyingRef.current = true;
      // Throttle syncing
      if (syncTimeout) clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        const target = options.target;
        if (target && target.objectId) {
          syncShapeInStorage(target);
        }
      }, 50);
    })

    canvas.on("object:rotating", (options: any) => {
      isModifyingRef.current = true;
      // Throttle syncing
      if (syncTimeout) clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        const target = options.target;
        if (target && target.objectId) {
          syncShapeInStorage(target);
        }
      }, 50);
    })

    canvas.on("object:modified", (options: any) => {
      isModifyingRef.current = false;

      const target = options.target;

      // If this object was moved and has children, sync the children's final positions
      if (target && target.objectId) {
        const childrenIds = getAllChildren(target.objectId);
        if (childrenIds.length > 0) {
          // Sync all children after movement is complete
          childrenIds.forEach(childId => {
            const childObject = fabricRef.current?.getObjects().find((obj: any) => obj.objectId === childId);
            if (childObject) {
              syncShapeInStorage(childObject);
            }
          });
        }
      }

      handleCanvasObjectModified({
        options, syncShapeInStorage
      })
    })

    // Listen for text changes while editing (throttled)
    let textSyncTimeout: NodeJS.Timeout | null = null;
    canvas.on("text:changed", (options: any) => {
      if (textSyncTimeout) clearTimeout(textSyncTimeout);
      textSyncTimeout = setTimeout(() => {
        const target = options.target;
        if (target && target.objectId) {
          syncShapeInStorage(target);
        }
      }, 300); // Sync 300ms after user stops typing
    })

    canvas.on("selection:created", (options: any) => {
      handleCanvasSelectionCreated({
        options,
        isEditingRef,
        setElementAttributes,
      })
    })

    // Add right-click context menu for objects
    canvas.on("mouse:down", (options: any) => {
      if (options.e.button === 2) { // Right click
        const target = canvas.getActiveObject();
        if (target && (target as any).objectId) {
          // Prevent default context menu
          options.e.preventDefault();

          // Show delete confirmation
          if (confirm('Delete this object?')) {
            deleteShapeFromStorage((target as any).objectId);
            canvas.remove(target);
            canvas.renderAll();
          }
        }
      }
    })

    canvas.on("object:scaling", (options) => {
      handleCanvasObjectScaling({
        options,
        setElementAttributes,
      });
    });

    canvas.on("path:created", (options) => {
      handlePathCreated({
        options, syncShapeInStorage
      })
    });


    window.addEventListener("resize", () => {
      handleResize({
        canvas: fabricRef.current,
      });
    });

    window.addEventListener("keydown", (e: any) => {
      handleKeyDown({
        e,
        canvas: fabricRef.current,
        undo,
        redo,
        syncShapeInStorage,
        deleteShapeFromStorage,
      })
    })

    return () => {
      canvas.dispose();
    }
  }, [])

  // Listen for shape updates from other users and manually update canvas
  const ws = useWebSocket();

  // Render initial canvas objects when joining room
  useEffect(() => {
    if (!fabricRef.current || canvasObjects.size === 0) return;

    const existingObjectIds = new Set(
      fabricRef.current.getObjects().map((obj: any) => obj.objectId).filter(Boolean)
    );

    // Only render objects that aren't already on the canvas
    Array.from(canvasObjects).forEach(([objectId, shapeData]) => {
      if (!existingObjectIds.has(objectId)) {
        fabric.util.enlivenObjects(
          [shapeData],
          (enlivenedObjects: fabric.Object[]) => {
            enlivenedObjects.forEach((enlivenedObj) => {
              (enlivenedObj as any).objectId = objectId;
              fabricRef.current?.add(enlivenedObj);
            });
            fabricRef.current?.renderAll();
          },
          "fabric"
        );
      }
    });
  }, [canvasObjects.size]);

  useEffect(() => {
    ws.onShapeSynced((objectId, shapeData) => {
      if (!fabricRef.current) return;

      // Find if object already exists on canvas
      const existingObject = fabricRef.current.getObjects().find((obj: any) => obj.objectId === objectId);

      if (existingObject) {
        // Update existing object properties
        existingObject.set(shapeData);
        fabricRef.current.renderAll();
      } else {
        // Add new object to canvas
        fabric.util.enlivenObjects(
          [shapeData],
          (enlivenedObjects: fabric.Object[]) => {
            enlivenedObjects.forEach((enlivenedObj) => {
              (enlivenedObj as any).objectId = objectId;
              fabricRef.current?.add(enlivenedObj);
            });
          },
          "fabric"
        );
      }
    });
  }, [ws]);



  return (
    <main className="h-screen overflow-hidden">
      <Navbar 
        activeElement={activeElement}
        handleActiveElement={handleActiveElement}
        imageInputRef={imageInputRef}
        handleImageUpload={(e: any) => {
          e.stopPropagation();
          handleImageUpload({
            file: e.target.files[0],
            canvas: fabricRef as any,
            shapeRef,
            syncShapeInStorage
          })
        }}
      />
      <section className="flex h-full flex-row">
        <LeftSidebar allShapes={Array.from(canvasObjects)}/>
        <Live canvasRef={canvasRef}/>
        <RightSidebar
         elementAttributes={elementAttributes}
         setElementAttributes={setElementAttributes}
         fabricRef={fabricRef}
         isEditingRef={isEditingRef}
         activeObjectRef={activeObjectRef}
         syncShapeInStorage={syncShapeInStorage}
         />
      </section>
    </main>
  );
}
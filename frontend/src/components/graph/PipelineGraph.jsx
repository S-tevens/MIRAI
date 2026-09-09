import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Background, Controls, ReactFlow } from "@xyflow/react";
import { buildPipelineGraph, computeFitViewport } from "../../graphLayout";
import PipelineNode from "./nodes/PipelineNode";

const nodeTypes = { pipeline: PipelineNode };

export default function PipelineGraph({ status, run, grafanaPanelUrl, interactive = false }) {
  const wrapperRef = useRef(null);
  const [viewport, setViewport] = useState(null);
  const { nodes, edges } = useMemo(() => buildPipelineGraph(status, run, grafanaPanelUrl), [status, run, grafanaPanelUrl]);

  useLayoutEffect(() => {
    if (!wrapperRef.current) return;
    const { width, height } = wrapperRef.current.getBoundingClientRect();
    setViewport(computeFitViewport(nodes, width, height, interactive ? 60 : 24));
    // Only the initial fit depends on the container size; re-fitting on every
    // resize isn't needed since this graph's layout is static once mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  return (
    <div ref={wrapperRef} style={{ width: "100%", height: "100%" }}>
      {viewport && (
        <ReactFlow
          className="mirai-flow"
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={interactive}
          zoomOnScroll={interactive}
          zoomOnPinch={interactive}
          zoomOnDoubleClick={interactive}
          minZoom={0.1}
          maxZoom={interactive ? 2 : 1.5}
          defaultViewport={viewport}
          proOptions={{ hideAttribution: true }}
        >
          {interactive && <Background variant="dots" gap={18} size={1} />}
          {interactive && <Controls showInteractive={false} />}
        </ReactFlow>
      )}
    </div>
  );
}

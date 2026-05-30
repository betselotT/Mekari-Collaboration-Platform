"use client";

import { PointerEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Brush,
  Eraser,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { Socket } from "socket.io-client";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { apiClient } from "../../../lib/api";
import { useAuth } from "../../../lib/useAuth";
import { ensureSocket } from "../../../lib/useSocket";

type WhiteboardPoint = {
  x: number;
  y: number;
};

type WhiteboardStroke = {
  id: string;
  userId: string;
  tool: "pen" | "eraser";
  style?: "pen" | "marker" | "highlighter";
  color: string;
  size: number;
  points: WhiteboardPoint[];
  createdAt?: string;
};

const colors = ["#111827", "#2563eb", "#dc2626", "#16a34a", "#f59e0b", "#7c3aed"];
const penStyles: Array<{
  id: NonNullable<WhiteboardStroke["style"]>;
  label: string;
  size: number;
}> = [
  { id: "pen", label: "Pen", size: 5 },
  { id: "marker", label: "Marker", size: 12 },
  { id: "highlighter", label: "Highlighter", size: 20 },
];
const eraserSizes = [8, 16, 28, 40];

function makeStrokeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: WhiteboardStroke) {
  if (stroke.points.length === 0) return;

  const dpr = ctx.canvas.width / Math.max(1, ctx.canvas.clientWidth);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.size * dpr;
  ctx.strokeStyle = stroke.color;
  ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  if (stroke.tool === "pen" && stroke.style === "marker") {
    ctx.globalAlpha = 0.88;
  }
  if (stroke.tool === "pen" && stroke.style === "highlighter") {
    ctx.globalAlpha = 0.34;
  }

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  ctx.beginPath();
  const first = stroke.points[0];
  ctx.moveTo(first.x * width, first.y * height);

  for (let index = 1; index < stroke.points.length; index += 1) {
    const point = stroke.points[index];
    ctx.lineTo(point.x * width, point.y * height);
  }

  if (stroke.points.length === 1) {
    ctx.lineTo(first.x * width + 0.01, first.y * height + 0.01);
  }

  ctx.stroke();
  ctx.restore();
}

function WhiteboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = searchParams?.get("conversation") || "";
  const roomId = useMemo(() => (conversationId ? `dm:${conversationId}` : ""), [conversationId]);
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const drawingRef = useRef(false);
  const remoteCloseRef = useRef(false);
  const closeSentRef = useRef(false);
  const currentStrokeRef = useRef<WhiteboardStroke | null>(null);
  const strokesRef = useRef<WhiteboardStroke[]>([]);
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [penStyle, setPenStyle] = useState<NonNullable<WhiteboardStroke["style"]>>("pen");
  const [color, setColor] = useState(colors[0]);
  const [penSize, setPenSize] = useState(5);
  const [eraserSize, setEraserSize] = useState(16);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const activeSize = tool === "eraser" ? eraserSize : penSize;

  const redraw = useCallback((items: WhiteboardStroke[]) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    items.forEach((stroke) => drawStroke(ctx, stroke));
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    redraw(strokesRef.current);
  }, [redraw]);

  useEffect(() => {
    strokesRef.current = strokes;
    redraw(strokes);
  }, [redraw, strokes]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      setError("Open a whiteboard from a conversation.");
      return;
    }

    let mounted = true;
    setLoading(true);
    apiClient
      .get<{ board: { strokes: WhiteboardStroke[] } }>(
        `/api/whiteboards/${encodeURIComponent(roomId)}`
      )
      .then((res) => {
        if (!mounted) return;
        setStrokes(res.data.board.strokes || []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.response?.data?.error?.message || "Failed to load whiteboard");
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    let mounted = true;
    let cleanup: (() => void) | null = null;
    ensureSocket().then((socket) => {
      if (!mounted) return;
      socketRef.current = socket;
      socket.emit("join_whiteboard", roomId);

      const handleStroke = (payload: { roomId: string; stroke: WhiteboardStroke }) => {
        if (payload.roomId !== roomId) return;
        setStrokes((prev) =>
          prev.some((stroke) => stroke.id === payload.stroke.id) ? prev : [...prev, payload.stroke]
        );
      };
      const handleClear = (payload: { roomId: string }) => {
        if (payload.roomId === roomId) setStrokes([]);
      };
      const handleUndo = (payload: { roomId: string; strokeId: string }) => {
        if (payload.roomId !== roomId) return;
        setStrokes((prev) => prev.filter((stroke) => stroke.id !== payload.strokeId));
      };
      const handleWhiteboardClosed = (payload: { conversationId?: string; closedBy?: string }) => {
        if (!conversationId || payload.conversationId !== conversationId) return;
        remoteCloseRef.current = true;
        router.push(`/dashboard/messages?conversation=${encodeURIComponent(conversationId)}`);
      };

      socket.on("whiteboard_stroke", handleStroke);
      socket.on("whiteboard_clear", handleClear);
      socket.on("whiteboard_undo", handleUndo);
      socket.on("dm_whiteboard_closed", handleWhiteboardClosed);

      cleanup = () => {
        socket.off("whiteboard_stroke", handleStroke);
        socket.off("whiteboard_clear", handleClear);
        socket.off("whiteboard_undo", handleUndo);
        socket.off("dm_whiteboard_closed", handleWhiteboardClosed);
      };
    });

    return () => {
      mounted = false;
      cleanup?.();
      const socket = socketRef.current;
      if (!remoteCloseRef.current) closeRemoteWhiteboard();
      if (socket) socket.emit("leave_whiteboard", roomId);
    };
  }, [conversationId, roomId, router]);

  function closeRemoteWhiteboard() {
    if (!conversationId || closeSentRef.current) return;
    closeSentRef.current = true;
    socketRef.current?.emit("close_dm_whiteboard", conversationId);
  }

  function leaveWhiteboard() {
    if (conversationId && !remoteCloseRef.current) {
      closeRemoteWhiteboard();
      router.push(`/dashboard/messages?conversation=${encodeURIComponent(conversationId)}`);
      return;
    }

    router.back();
  }

  function pointerToPoint(event: PointerEvent<HTMLCanvasElement>): WhiteboardPoint {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  function startDrawing(event: PointerEvent<HTMLCanvasElement>) {
    if (!roomId || !user?._id) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    currentStrokeRef.current = {
      id: makeStrokeId(),
      userId: user._id,
      tool,
      style: tool === "pen" ? penStyle : "pen",
      color,
      size: activeSize,
      points: [pointerToPoint(event)],
    };
  }

  function continueDrawing(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    currentStrokeRef.current = {
      ...currentStrokeRef.current,
      points: [...currentStrokeRef.current.points, pointerToPoint(event)],
    };
    redraw([...strokesRef.current, currentStrokeRef.current]);
  }

  function finishDrawing() {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    drawingRef.current = false;
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    setStrokes((prev) => [...prev, stroke]);
    socketRef.current?.emit("whiteboard_stroke", { ...stroke, roomId });
  }

  function undoLastOwnStroke() {
    const stroke = [...strokes].reverse().find((item) => item.userId === user?._id);
    if (!stroke || !roomId) return;
    setStrokes((prev) => prev.filter((item) => item.id !== stroke.id));
    socketRef.current?.emit("whiteboard_undo", { roomId, strokeId: stroke.id });
  }

  function clearBoard() {
    if (!roomId) return;
    setStrokes([]);
    socketRef.current?.emit("whiteboard_clear", { roomId });
  }

  return (
    <DashboardLayout title="Collaborative Whiteboard">
      <div className="flex h-[calc(100vh-5rem)] min-h-[560px] flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={leaveWhiteboard}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                {loading ? "Loading board..." : error || "Draw together during a live session"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-neutral-200 p-1 dark:border-neutral-700">
              <button
                type="button"
                onClick={() => setTool("pen")}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${
                  tool === "pen"
                    ? "bg-primary-600 text-white"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
                title="Pen"
                aria-label="Pen"
              >
                <Brush className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setTool("eraser")}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${
                  tool === "eraser"
                    ? "bg-primary-600 text-white"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
                title="Eraser"
                aria-label="Eraser"
              >
                <Eraser className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-neutral-200 p-1 dark:border-neutral-700">
              {penStyles.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => {
                    setTool("pen");
                    setPenStyle(style.id);
                    setPenSize(style.size);
                  }}
                  className={`inline-flex h-9 items-center justify-center rounded-md px-3 text-xs font-semibold ${
                    tool === "pen" && penStyle === style.id
                      ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  }`}
                  title={`Use ${style.label}`}
                >
                  {style.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-neutral-200 p-1 dark:border-neutral-700">
              {colors.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setColor(item);
                    setTool("pen");
                  }}
                  className={`h-7 w-7 rounded-full border-2 ${
                    color === item && tool === "pen"
                      ? "border-neutral-900 dark:border-white"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: item }}
                  title={item}
                  aria-label={`Use color ${item}`}
                />
              ))}
            </div>

            <div className="flex items-center rounded-lg border border-neutral-200 p-1 dark:border-neutral-700">
              <button
                type="button"
                onClick={() =>
                  tool === "eraser"
                    ? setEraserSize((value) => Math.max(4, value - 4))
                    : setPenSize((value) => Math.max(2, value - 2))
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                aria-label={tool === "eraser" ? "Decrease eraser size" : "Decrease brush size"}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-12 text-center text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                {activeSize}px
              </span>
              <button
                type="button"
                onClick={() =>
                  tool === "eraser"
                    ? setEraserSize((value) => Math.min(64, value + 4))
                    : setPenSize((value) => Math.min(40, value + 2))
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                aria-label={tool === "eraser" ? "Increase eraser size" : "Increase brush size"}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-neutral-200 p-1 dark:border-neutral-700">
              {eraserSizes.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setTool("eraser");
                    setEraserSize(item);
                  }}
                  className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-xs font-semibold ${
                    tool === "eraser" && eraserSize === item
                      ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  }`}
                  title={`Eraser ${item}px`}
                >
                  {item}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={undoLastOwnStroke}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              disabled={!strokes.some((stroke) => stroke.userId === user?._id)}
              title="Undo"
              aria-label="Undo last stroke"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={clearBoard}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
              title="Clear"
              aria-label="Clear whiteboard"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div ref={containerRef} className="relative min-h-0 flex-1 bg-white">
          <canvas
            ref={canvasRef}
            className="block h-full w-full touch-none cursor-crosshair"
            onPointerDown={startDrawing}
            onPointerMove={continueDrawing}
            onPointerUp={finishDrawing}
            onPointerCancel={finishDrawing}
            onPointerLeave={finishDrawing}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function WhiteboardPage() {
  return (
    <Suspense fallback={null}>
      <WhiteboardContent />
    </Suspense>
  );
}

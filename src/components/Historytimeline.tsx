import React, { useState, useMemo } from "react";
import {
  Activity, User, Share2, CheckCircle, RotateCw, Plus, Clock,
  ChevronDown, ChevronUp, Search, X,
} from "lucide-react";

// ── Design tokens (local copy so component is self-contained) ─────────────────
const G = {
  bg:           "#080600",
  bgDeep:       "#050400",
  surface:      "#0f0d08",
  gold:         "#c9a96e",
  goldDim:      "rgba(201,169,110,0.15)",
  goldBorder:   "rgba(201,169,110,0.2)",
  border:       "rgba(201,169,110,0.1)",
  success:      "#6ee7b7",
  danger:       "#f87171",
  amber:        "#f59e0b",
  textPrimary:  "#f0e6d3",
  textSecondary:"#8a7355",
  textMuted:    "#4a3f2a",
  purple:       "#a78bfa",
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface HistoryEntry {
  id?: string;
  timestamp: string;
  action: string;
  by: string;
  to?: string;
  notes?: string;
  // enriched when built from full task list
  _taskId?: string;
  _taskTitle?: string;
}

export interface TaskWithHistory {
  id: string;
  title: string;
  history?: HistoryEntry[];
}

interface ActionConfig {
  color: string;
  Icon: React.ComponentType<any>;
  label: string;
}

// ── Action config map ─────────────────────────────────────────────────────────
const ACTION_CONFIG: Record<string, ActionConfig> = {
  created:       { color: G.gold,    Icon: Plus,        label: "Created"     },
  assigned:      { color: G.gold,    Icon: User,        label: "Assigned"    },
  forwarded:     { color: G.purple,  Icon: Share2,      label: "Forwarded"   },
  updated:       { color: G.amber,   Icon: RotateCw,    label: "Updated"     },
  approved:      { color: G.success, Icon: CheckCircle, label: "Approved"    },
  "in-progress": { color: G.purple,  Icon: Activity,    label: "In Progress" },
  completed:     { color: G.success, Icon: CheckCircle, label: "Completed"   },
  rejected:      { color: G.danger,  Icon: RotateCw,    label: "Rework"      },
};

const STATUS_FILTERS = ["all", "created", "assigned", "forwarded", "approved", "rejected", "completed"] as const;

// ── Props ─────────────────────────────────────────────────────────────────────
interface HistoryTimelineProps {
  /** Per-task history entries (use this OR tasks, not both) */
  history?: HistoryEntry[];
  /** All tasks — component will flatten their .history arrays */
  tasks?: TaskWithHistory[];
  getNameFn?: (email: string) => string;
  /** Pre-filter timeline to a single task */
  filterByTaskId?: string | null;
  compact?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
const HistoryTimeline: React.FC<HistoryTimelineProps> = ({
  history = [],
  tasks = [],
  getNameFn = (e) => e,
  filterByTaskId = null,
  compact = false,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery,  setSearchQuery]  = useState<string>("");
  const [expandedIds,  setExpandedIds]  = useState<Set<string | number>>(new Set());

  // Build master history from all tasks if no specific history given
  const masterHistory = useMemo<HistoryEntry[]>(() => {
    if (history.length > 0) return history;
    const all: HistoryEntry[] = [];
    tasks.forEach((task) => {
      (task.history ?? []).forEach((entry) => {
        all.push({ ...entry, _taskId: task.id, _taskTitle: task.title });
      });
    });
    return all.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [history, tasks]);

  const filtered = useMemo<HistoryEntry[]>(() => {
    let list = filterByTaskId
      ? masterHistory.filter((e) => e._taskId === filterByTaskId || !e._taskId)
      : masterHistory;

    if (statusFilter !== "all") list = list.filter((e) => e.action === statusFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e._taskTitle?.toLowerCase().includes(q) ||
          getNameFn(e.by).toLowerCase().includes(q) ||
          (e.to ? getNameFn(e.to).toLowerCase().includes(q) : false) ||
          (e.notes?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [masterHistory, statusFilter, searchQuery, filterByTaskId, getNameFn]);

  const toggleExpand = (id: string | number): void => {
    setExpandedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Filters ── */}
      {!compact && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
            <Search
              size={12}
              color={G.textMuted}
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search history…"
              style={{
                width: "100%", paddingLeft: 30, paddingRight: 10, paddingTop: 8, paddingBottom: 8,
                background: G.bgDeep, border: `1px solid ${G.border}`, borderRadius: 8,
                color: G.textPrimary, fontSize: 12, fontFamily: "'DM Sans', sans-serif",
                outline: "none",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: G.textMuted,
                  display: "flex",
                }}
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Status filters */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                style={{
                  padding: "5px 12px",
                  background: statusFilter === f ? G.goldDim : "transparent",
                  border: `1px solid ${statusFilter === f ? G.goldBorder : G.border}`,
                  borderRadius: 99,
                  color: statusFilter === f ? G.gold : G.textSecondary,
                  fontSize: 10,
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Timeline ── */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "32px 16px",
          color: G.textMuted, fontSize: 12, fontFamily: "'DM Mono', monospace",
        }}>
          No history entries found
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {/* Vertical line */}
          <div style={{
            position: "absolute", left: compact ? 8 : 10, top: 10, bottom: 10, width: 2,
            background: `linear-gradient(180deg, ${G.goldBorder}, rgba(201,169,110,0.05))`,
          }} />

          <div style={{ display: "flex", flexDirection: "column", gap: compact ? 10 : 14 }}>
            {filtered.map((entry, i) => {
              const key = entry.id ?? i;
              const cfg = ACTION_CONFIG[entry.action] ?? {
                color: G.textSecondary, Icon: Activity as React.ComponentType<any>, label: entry.action,
              };
              const { color, label } = cfg;
              const expanded = expandedIds.has(key);
              const hasDetails = !!entry.notes || !!entry._taskTitle;

              return (
                <div key={key} style={{ display: "flex", gap: compact ? 10 : 14, position: "relative" }}>
                  {/* Dot */}
                  <div style={{
                    flexShrink: 0,
                    width: compact ? 18 : 22, height: compact ? 18 : 22,
                    borderRadius: "50%",
                    background: G.bgDeep, border: `2px solid ${color}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    zIndex: 1, marginTop: 2,
                    boxShadow: `0 0 8px ${color}40`,
                  }}>
                    <div style={{
                      width: compact ? 5 : 6, height: compact ? 5 : 6,
                      borderRadius: "50%", background: color,
                    }} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, paddingBottom: compact ? 8 : 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: compact ? 12 : 13,
                        fontWeight: 600,
                        color: G.textPrimary,
                        textTransform: "capitalize" as const,
                      }}>
                        {label}
                      </span>
                      <span style={{
                        padding: "2px 8px",
                        background: `${color}18`,
                        color, border: `1px solid ${color}33`,
                        borderRadius: 99, fontSize: 9,
                        fontFamily: "'DM Mono', monospace",
                        fontWeight: 700, letterSpacing: "0.06em",
                        textTransform: "uppercase" as const,
                      }}>
                        {entry.action}
                      </span>
                      {entry._taskTitle && !filterByTaskId && (
                        <span style={{
                          fontSize: 10, color: G.textMuted, fontFamily: "'DM Mono', monospace",
                          maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {entry._taskTitle}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 12, color: G.textSecondary, marginTop: 3, marginBottom: 4 }}>
                      <strong style={{ color: G.textPrimary }}>{getNameFn(entry.by)}</strong>
                      {entry.to && (
                        <>
                          {" "}<span style={{ color: G.textMuted }}>→</span>{" "}
                          <strong style={{ color: G.textPrimary }}>{getNameFn(entry.to)}</strong>
                        </>
                      )}
                    </div>

                    {entry.notes && (!compact || expanded) && (
                      <div style={{
                        padding: "7px 10px",
                        background: G.surface, border: `1px solid ${G.border}`,
                        borderRadius: 6, fontSize: 12, color: G.textSecondary,
                        marginTop: 6, lineHeight: 1.55,
                      }}>
                        {entry.notes}
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 5 }}>
                      <div style={{
                        fontSize: 10, color: G.textMuted, fontFamily: "'DM Mono', monospace",
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <Clock size={9} />
                        {new Date(entry.timestamp).toLocaleString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </div>
                      {compact && hasDetails && (
                        <button
                          onClick={() => toggleExpand(key)}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: G.gold, fontSize: 10, fontFamily: "'DM Mono', monospace",
                            display: "flex", alignItems: "center", gap: 4, padding: 0,
                          }}
                        >
                          {expanded ? <><ChevronUp size={9} /> Less</> : <><ChevronDown size={9} /> More</>}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Count */}
      {!compact && filtered.length > 0 && (
        <div style={{
          textAlign: "right", fontSize: 10, color: G.textMuted, fontFamily: "'DM Mono', monospace",
        }}>
          {filtered.length} entr{filtered.length !== 1 ? "ies" : "y"}
        </div>
      )}
    </div>
  );
};

export default HistoryTimeline;
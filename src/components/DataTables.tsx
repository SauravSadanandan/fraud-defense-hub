import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatNumber, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AnalysisResult, DashboardState } from "@/engine/types";

function riskBadge(risk: string) {
  const map: Record<string, string> = {
    Critical: "bg-fraud-click/15 text-fraud-click border-fraud-click/30",
    High: "bg-fraud-bot/15 text-fraud-bot border-fraud-bot/30",
    Medium: "bg-fraud-warn/15 text-fraud-warn border-fraud-warn/30",
    Low: "bg-fraud-ok/15 text-fraud-ok border-fraud-ok/30",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", map[risk] || "")}>
      {risk}
    </Badge>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{msg}</div>;
}

export function DataTables({
  result,
  state,
  pidSet,
}: {
  result: AnalysisResult;
  state: DashboardState;
  pidSet: Set<string> | null;
}) {
  const [flaggedLimit, setFlaggedLimit] = useState(50);
  const signals = Object.entries(state.bySignal).sort((a, b) => b[1] - a[1]);
  const flaggedAll = result.mode === "Event" ? result.flaggedEvents : result.flaggedInstalls;
  const flagged = pidSet ? flaggedAll.filter((e) => pidSet.has(e.mediaSource)) : flaggedAll;
  const publishers = pidSet
    ? result.publishers.filter((p) => pidSet.has(p.mediaSource))
    : result.publishers;

  return (
    <Card className="rounded-2xl p-1">
      <Tabs defaultValue="signals" className="w-full">
        <div className="px-3 pt-3">
          <TabsList>
            <TabsTrigger value="signals">Fraud Signals</TabsTrigger>
            <TabsTrigger value="publishers">Publishers</TabsTrigger>
            <TabsTrigger value="devices">Device Models</TabsTrigger>
            <TabsTrigger value="flagged">
              {result.mode === "Event" ? "Flagged Events" : "Flagged Installs"}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="signals" className="p-3">
          {signals.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Signal</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signals.map(([sig, count]) => (
                  <TableRow key={sig}>
                    <TableCell className="font-medium">{sig}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(count)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {pct(count, state.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty msg="No fraud signals detected for this view." />
          )}
        </TabsContent>

        <TabsContent value="publishers" className="p-3">
          {publishers.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Media Source</TableHead>
                    <TableHead className="text-right">Sites</TableHead>
                    <TableHead className="text-right">Flagged</TableHead>
                    <TableHead className="text-right">Click Fraud %</TableHead>
                    <TableHead className="text-right">Avg CTIT (min)</TableHead>
                    <TableHead className="text-right">Bots</TableHead>
                    <TableHead>Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {publishers.map((p) => (
                    <TableRow key={p.mediaSource}>
                      <TableCell className="font-medium">{p.mediaSource}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.siteCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(p.total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.clickPct.toFixed(1)}%</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.avgCtitMin !== null ? p.avgCtitMin.toFixed(1) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(p.bots)}</TableCell>
                      <TableCell>{riskBadge(p.risk)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty msg="No publisher data available." />
          )}
        </TabsContent>

        <TabsContent value="devices" className="p-3">
          {result.deviceModels.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device Model</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Flagged</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.deviceModels.map((d) => (
                  <TableRow key={d.model}>
                    <TableCell className="font-medium">{d.model}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(d.count)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(d.flagged)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty msg="No device model data available." />
          )}
        </TabsContent>

        <TabsContent value="flagged" className="p-3">
          {flagged.length ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>AppsFlyer ID</TableHead>
                      <TableHead>Media Source</TableHead>
                      <TableHead>Site ID</TableHead>
                      {result.mode === "Event" && <TableHead>Event</TableHead>}
                      <TableHead>Country</TableHead>
                      <TableHead className="text-right">CTIT (min)</TableHead>
                      <TableHead>Signals</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flagged.slice(0, flaggedLimit).map((e, i) => (
                      <TableRow key={`${e.appsflyerId}-${i}`}>
                        <TableCell className="max-w-[140px] truncate font-mono text-xs">
                          {e.appsflyerId || "—"}
                        </TableCell>
                        <TableCell>{e.mediaSource}</TableCell>
                        <TableCell>{e.siteId || "—"}</TableCell>
                        {result.mode === "Event" && <TableCell>{e.eventName || "—"}</TableCell>}
                        <TableCell>{e.country || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {e.ctitMinutes !== null ? e.ctitMinutes.toFixed(1) : "—"}
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <div className="flex flex-wrap gap-1">
                            {e.signals.slice(0, 3).map((s, j) => (
                              <Badge key={j} variant="secondary" className="text-[10px] font-normal">
                                {s.replace(/\(.*?\)/g, "").trim()}
                              </Badge>
                            ))}
                            {e.signals.length > 3 && (
                              <span className="text-xs text-muted-foreground">+{e.signals.length - 3}</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {flagged.length > flaggedLimit && (
                <div className="mt-3 text-center">
                  <Button variant="outline" size="sm" onClick={() => setFlaggedLimit((l) => l + 100)}>
                    Show more ({formatNumber(flagged.length - flaggedLimit)} remaining)
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Empty msg="No flagged rows for this view." />
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}
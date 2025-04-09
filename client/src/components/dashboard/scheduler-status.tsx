import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  CalendarClock, 
  PlayCircle, 
  StopCircle, 
  RefreshCw, 
  Clock, 
  AlertCircle,
  Calendar
} from "lucide-react";

interface SchedulerStatus {
  activeJobs: string[];
  lastPriceCheck: string | null;
  totalPriceChecks: number;
  totalDiscrepanciesFound: number;
  nextScheduledRun?: string | null;
}

export function SchedulerStatus() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchStatus = async (showLoading = false) => {
    // Only show loading state on initial load or manual refresh
    if (showLoading) {
      setLoading(true);
    }
    
    try {
      const response = await fetch("/api/scheduler/status", {
        method: "GET"
      });
      const json = await response.json();
      setStatus(json);
    } catch (error) {
      console.error("Failed to fetch scheduler status:", error);
      // Only show toast on manual refresh to avoid repeated error messages
      if (showLoading) {
        toast({
          title: "Error",
          description: "Failed to fetch scheduler status",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Calculate next run time (midnight AEST)
  const calculateNextRun = () => {
    // Current time
    const now = new Date();
    
    // Calculate next AEST midnight (UTC+10)
    // AEST is 10 hours ahead of UTC
    const aestOffset = 10 * 60 * 60 * 1000; // 10 hours in milliseconds
    
    // Get current date in AEST
    const aestNow = new Date(now.getTime() + aestOffset);
    
    // Set to next midnight in AEST
    const aestMidnight = new Date(aestNow);
    aestMidnight.setHours(0, 0, 0, 0);
    
    // If it's already past midnight AEST, set to next day
    if (aestNow > aestMidnight) {
      aestMidnight.setDate(aestMidnight.getDate() + 1);
    }
    
    // Convert back to local time for display
    return new Date(aestMidnight.getTime() - aestOffset);
  };
  
  useEffect(() => {
    // Only show loading state on the initial fetch
    fetchStatus(true);
    // Refresh status only every 5 minutes (reduced from 30 seconds)
    // Don't show loading indicator for automatic refreshes to prevent UI flicker
    const interval = setInterval(() => fetchStatus(false), 300000);
    return () => clearInterval(interval);
  }, []);

  const startScheduler = async () => {
    try {
      setActionInProgress("start");
      const response = await fetch("/api/scheduler/price-check/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ interval: 86400000 }), // 24 hours
      });
      
      if (!response.ok) {
        throw new Error(`Failed to start scheduler: ${response.status}`);
      }
      
      toast({
        title: "Scheduler Started",
        description: "Price check scheduler has been started successfully",
      });
      fetchStatus(true);
    } catch (error) {
      console.error("Failed to start scheduler:", error);
      toast({
        title: "Error",
        description: "Failed to start scheduler",
        variant: "destructive",
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const stopScheduler = async () => {
    try {
      setActionInProgress("stop");
      const response = await fetch("/api/scheduler/price-check/stop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to stop scheduler: ${response.status}`);
      }
      
      toast({
        title: "Scheduler Stopped",
        description: "Price check scheduler has been stopped",
      });
      fetchStatus(true);
    } catch (error) {
      console.error("Failed to stop scheduler:", error);
      toast({
        title: "Error",
        description: "Failed to stop scheduler",
        variant: "destructive",
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const runCheckNow = async () => {
    try {
      setActionInProgress("run");
      const response = await fetch("/api/scheduler/price-check/run-now", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to run price check: ${response.status}`);
      }
      
      toast({
        title: "Price Check Started",
        description: "Price check has been initiated",
      });
      // Fetch updated status after initiating the price check
      fetchStatus(true);
    } catch (error) {
      console.error("Failed to run price check:", error);
      toast({
        title: "Error",
        description: "Failed to start price check",
        variant: "destructive",
      });
    } finally {
      setActionInProgress(null);
    }
  };
  
  const resetStats = async () => {
    try {
      setActionInProgress("reset");
      // This endpoint needs to be implemented on the server
      const response = await fetch("/api/scheduler/stats/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to reset stats: ${response.status}`);
      }
      
      toast({
        title: "Stats Reset",
        description: "Price check statistics have been reset",
      });
      fetchStatus(true);
    } catch (error) {
      console.error("Failed to reset stats:", error);
      toast({
        title: "Error",
        description: "Failed to reset statistics",
        variant: "destructive",
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const isSchedulerActive = status?.activeJobs?.includes("daily-price-check") || false;

  const formatTime = (timeString: string | null) => {
    if (!timeString) return "Never";
    const date = new Date(timeString);
    return date.toLocaleString();
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2 bg-gradient-to-r from-blue-50 to-slate-50 dark:from-blue-950/50 dark:to-slate-950/50 border-b">
        <div className="flex items-center">
          <CalendarClock className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
          <div>
            <CardTitle className="text-lg">Scheduled Price Checks</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status:</span>
            {loading ? (
              <Badge variant="outline" className="animate-pulse">
                Loading...
              </Badge>
            ) : isSchedulerActive ? (
              <Badge variant="default" className="bg-green-600 hover:bg-green-700">Active</Badge>
            ) : (
              <Badge variant="destructive">Inactive</Badge>
            )}
          </div>

          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            {isSchedulerActive ? (
              <div className="flex items-center gap-3 text-foreground">
                <Calendar className="h-10 w-10 text-primary" />
                <div>
                  <div className="font-medium">Next Price Check:</div>
                  <div className="text-sm">{formatTime(status?.nextScheduledRun || calculateNextRun().toISOString())}</div>
                  <div className="text-xs text-muted-foreground mt-1">Checks run daily at 12:00 AM AEST (UTC+10)</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <AlertCircle className="h-10 w-10 text-destructive" />
                <div>
                  <div className="font-medium">Schedule Inactive</div>
                  <div className="text-sm text-muted-foreground">Price checks are not currently scheduled</div>
                  <div className="text-xs text-muted-foreground mt-1">Click "Start Scheduler" to begin daily checks</div>
                </div>
              </div>
            )}
          </div>

          <Separator />
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Last Check</span>
              </div>
              <div className="text-sm">{formatTime(status?.lastPriceCheck || null)}</div>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm font-medium">Recent Activity</div>
              <div className="text-2xl font-bold">{status?.totalPriceChecks || 0} <span className="text-sm font-normal text-muted-foreground">checks performed</span></div>
              <div className="text-sm text-muted-foreground">{status?.totalDiscrepanciesFound || 0} discrepancies found</div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex w-full flex-col space-y-3">
          <div className="flex justify-between gap-3">
            {isSchedulerActive ? (
              <Button 
                variant="destructive" 
                onClick={stopScheduler} 
                disabled={actionInProgress !== null}
                className="flex items-center gap-2 w-full"
              >
                {actionInProgress === "stop" ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Stopping...
                  </>
                ) : (
                  <>
                    <StopCircle className="h-4 w-4" />
                    Stop Scheduler
                  </>
                )}
              </Button>
            ) : (
              <Button 
                variant="default" 
                onClick={startScheduler} 
                disabled={actionInProgress !== null}
                className="flex items-center gap-2 w-full"
              >
                {actionInProgress === "start" ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4" />
                    Start Scheduler
                  </>
                )}
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={runCheckNow} 
              disabled={actionInProgress !== null}
              className="flex items-center gap-2 w-full"
            >
              {actionInProgress === "run" ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Run Check Now
                </>
              )}
            </Button>
          </div>
          
          <Button 
            variant="ghost" 
            onClick={resetStats} 
            disabled={actionInProgress !== null}
            size="sm"
            className="flex items-center gap-2 w-full border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50"
          >
            {actionInProgress === "reset" ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span className="text-xs">Resetting Stats...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3" />
                <span className="text-xs">Reset Statistics</span>
              </>
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
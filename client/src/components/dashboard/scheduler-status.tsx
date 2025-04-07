import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CalendarClock, PlayCircle, StopCircle, RefreshCw, Clock } from "lucide-react";

interface SchedulerStatus {
  activeJobs: string[];
  lastPriceCheck: string | null;
  totalPriceChecks: number;
  totalDiscrepanciesFound: number;
}

export function SchedulerStatus() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/scheduler/status", {
        method: "GET"
      });
      const json = await response.json();
      setStatus(json);
    } catch (error) {
      console.error("Failed to fetch scheduler status:", error);
      toast({
        title: "Error",
        description: "Failed to fetch scheduler status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
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
      fetchStatus();
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
      fetchStatus();
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

  const isSchedulerActive = status?.activeJobs?.includes("daily-price-check") || false;

  const formatTime = (timeString: string | null) => {
    if (!timeString) return "Never";
    const date = new Date(timeString);
    return date.toLocaleString();
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" />
          Scheduled Price Checks
        </CardTitle>
        <CardDescription>
          Automatically check all products with supplier URLs for price discrepancies
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status:</span>
            {loading ? (
              <Badge variant="outline" className="animate-pulse">
                Loading...
              </Badge>
            ) : isSchedulerActive ? (
              <Badge variant="default" className="bg-green-600">Active</Badge>
            ) : (
              <Badge variant="destructive">Inactive</Badge>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Last Check: {formatTime(status?.lastPriceCheck || null)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Total Checks Performed:</span>
              <span className="font-medium">{status?.totalPriceChecks || 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Total Discrepancies Found:</span>
              <span className="font-medium">{status?.totalDiscrepanciesFound || 0}</span>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        {isSchedulerActive ? (
          <Button 
            variant="destructive" 
            onClick={stopScheduler} 
            disabled={actionInProgress !== null}
            className="flex items-center gap-2"
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
            className="flex items-center gap-2"
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
          className="flex items-center gap-2"
        >
          {actionInProgress === "run" ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Run Now
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
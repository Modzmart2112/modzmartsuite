import { useEffect, useState } from "react";
import { format, parseISO, addDays } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  CalendarClock,
  Clock,
  PlayCircle,
  RefreshCw,
  StopCircle,
  AlertCircle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SchedulerStatus {
  activeJobs: string[];
  lastPriceCheck: string | null;
  totalPriceChecks: number;
  totalDiscrepanciesFound: number;
  nextScheduledRun?: string | null;
}

export function SchedulerStatus() {
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: status, isLoading: loading } = useQuery({
    queryKey: ['/api/scheduler/status'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });
  
  const isSchedulerActive = !loading && status?.activeJobs?.includes('price-check');
  
  const startSchedulerMutation = useMutation({
    mutationFn: async () => {
      setActionInProgress("start");
      return await apiRequest('/api/scheduler/start', 'POST');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduler/status'] });
      toast({
        title: "Scheduler Started",
        description: "Automatic price checks will now run daily at 12am AEST",
      });
      setActionInProgress(null);
    },
    onError: (error) => {
      console.error("Failed to start scheduler:", error);
      toast({
        title: "Failed to Start Scheduler",
        description: "An error occurred while starting the scheduler",
        variant: "destructive",
      });
      setActionInProgress(null);
    }
  });
  
  const stopSchedulerMutation = useMutation({
    mutationFn: async () => {
      setActionInProgress("stop");
      return await apiRequest('/api/scheduler/stop', 'POST');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduler/status'] });
      toast({
        title: "Scheduler Stopped",
        description: "Automatic price checks have been disabled",
      });
      setActionInProgress(null);
    },
    onError: (error) => {
      console.error("Failed to stop scheduler:", error);
      toast({
        title: "Failed to Stop Scheduler",
        description: "An error occurred while stopping the scheduler",
        variant: "destructive",
      });
      setActionInProgress(null);
    }
  });
  
  const runCheckNowMutation = useMutation({
    mutationFn: async () => {
      setActionInProgress("run");
      return await apiRequest('/api/scheduler/run-check', 'POST');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduler/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products/discrepancies'] });
      toast({
        title: "Price Check Started",
        description: "A price check is now running. Results will appear shortly.",
      });
      setActionInProgress(null);
    },
    onError: (error) => {
      console.error("Failed to run price check:", error);
      toast({
        title: "Failed to Run Price Check",
        description: "An error occurred while starting the price check",
        variant: "destructive",
      });
      setActionInProgress(null);
    }
  });
  
  const resetStatsMutation = useMutation({
    mutationFn: async () => {
      setActionInProgress("reset");
      return await apiRequest('/api/scheduler/reset-stats', 'POST');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduler/status'] });
      toast({
        title: "Statistics Reset",
        description: "Scheduler statistics have been reset",
      });
      setActionInProgress(null);
    },
    onError: (error) => {
      console.error("Failed to reset stats:", error);
      toast({
        title: "Failed to Reset Stats",
        description: "An error occurred while resetting the statistics",
        variant: "destructive",
      });
      setActionInProgress(null);
    }
  });
  
  const startScheduler = () => {
    startSchedulerMutation.mutate();
  };
  
  const stopScheduler = () => {
    stopSchedulerMutation.mutate();
  };
  
  const runCheckNow = () => {
    runCheckNowMutation.mutate();
  };
  
  const resetStats = () => {
    resetStatsMutation.mutate();
  };
  
  // Calculate next scheduled run if not provided by the server
  const calculateNextRun = () => {
    const now = new Date();
    // Set to midnight AEST (UTC+10)
    const targetHour = 14; // UTC time (midnight AEST is 14:00 UTC the day before)
    
    let next = new Date(now);
    next.setUTCHours(targetHour, 0, 0, 0);
    
    // If we're past today's run time, set to tomorrow
    if (now.getUTCHours() >= targetHour) {
      next = addDays(next, 1);
    }
    
    return next;
  };
  
  const formatTime = (timeString: string | null) => {
    if (!timeString) return "Never";
    try {
      const date = parseISO(timeString);
      return format(date, "MMM d, yyyy 'at' h:mm a");
    } catch (error) {
      console.error("Failed to format time:", error);
      return "Invalid date";
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-slate-50 dark:from-blue-950/50 dark:to-slate-950/50 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <CalendarClock className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
            <CardTitle className="text-lg">Scheduled Price Checks</CardTitle>
          </div>
          {loading ? (
            <Badge variant="outline" className="animate-pulse px-3 py-0.5">
              Loading...
            </Badge>
          ) : isSchedulerActive ? (
            <Badge variant="default" className="bg-green-600 hover:bg-green-700 px-4 py-0.5">Active</Badge>
          ) : (
            <Badge variant="destructive" className="px-3 py-0.5">Inactive</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-2 pb-2">
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            {isSchedulerActive ? (
              <div className="flex items-center gap-3 text-foreground">
                <Calendar className="h-8 w-8 text-primary" />
                <div>
                  <div className="font-medium">Next Price Check:</div>
                  <div className="text-sm">{formatTime(status?.nextScheduledRun || calculateNextRun().toISOString())}</div>
                  <div className="text-xs text-muted-foreground mt-1">Checks run daily at 12:00 AM AEST (UTC+10)</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div>
                  <div className="font-medium">Schedule Inactive</div>
                  <div className="text-sm text-muted-foreground">Price checks are not currently scheduled</div>
                  <div className="text-xs text-muted-foreground mt-1">Click "Start Scheduler" to begin daily checks</div>
                </div>
              </div>
            )}
          </div>

          <Separator className="my-2" />
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Last Check</span>
              </div>
              <div className="text-sm">{formatTime(status?.lastPriceCheck || null)}</div>
            </div>
            
            <div>
              <div className="text-sm font-medium mb-1">Recent Activity</div>
              <div className="text-xl font-bold">{status?.totalPriceChecks || 0} <span className="text-sm font-normal text-muted-foreground">checks</span></div>
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
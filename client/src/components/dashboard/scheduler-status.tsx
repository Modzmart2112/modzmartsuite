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
    <Card className="w-full shadow-md hover:shadow-lg transition-shadow duration-300">
      {/* Keep the card header untouched as requested */}
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
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* Status banner with enhanced styling */}
          <div className={`p-5 rounded-lg ${isSchedulerActive 
            ? 'bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800/50' 
            : 'bg-gradient-to-br from-red-50/80 to-orange-50/80 dark:from-red-900/20 dark:to-orange-900/20 border border-red-100 dark:border-red-800/50'}`}>
            {isSchedulerActive ? (
              <div className="flex items-center gap-4">
                <div className="bg-blue-100 dark:bg-blue-800/30 rounded-full p-2.5">
                  <Calendar className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="font-medium text-blue-800 dark:text-blue-300">Next Price Check:</div>
                  <div className="text-lg font-semibold">{formatTime(status?.nextScheduledRun || calculateNextRun().toISOString())}</div>
                  <div className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1.5 flex items-center">
                    <Clock className="h-3 w-3 mr-1 inline" />
                    Checks run daily at 12:00 AM AEST (UTC+10)
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="bg-red-100 dark:bg-red-800/30 rounded-full p-2.5">
                  <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <div className="font-medium text-red-800 dark:text-red-300">Schedule Inactive</div>
                  <div className="text-base font-semibold">Price checks are not currently scheduled</div>
                  <div className="text-xs text-red-600/80 dark:text-red-400/80 mt-1.5 flex items-center">
                    <PlayCircle className="h-3 w-3 mr-1 inline" />
                    Click "Start Scheduler" to begin daily checks
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator className="bg-gray-200 dark:bg-gray-700" />
          
          {/* Stats section with enhanced styling */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-gray-50 dark:bg-gray-800/40 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Price Check</span>
              </div>
              <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">{formatTime(status?.lastPriceCheck || null)}</div>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-800/40 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recent Activity Summary</div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total checks:</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{status?.totalPriceChecks || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Discrepancies:</span>
                  <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{status?.totalDiscrepanciesFound || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-2 pb-6 px-6">
        <div className="flex w-full flex-col space-y-4">
          <div className="flex justify-between gap-4">
            {isSchedulerActive ? (
              <Button 
                variant="destructive" 
                onClick={stopScheduler} 
                disabled={actionInProgress !== null}
                className="flex items-center gap-2 w-full py-5 shadow-sm hover:shadow transition-shadow"
              >
                {actionInProgress === "stop" ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Stopping...
                  </>
                ) : (
                  <>
                    <StopCircle className="h-5 w-5" />
                    <span className="font-medium">Stop Scheduler</span>
                  </>
                )}
              </Button>
            ) : (
              <Button 
                variant="default" 
                onClick={startScheduler} 
                disabled={actionInProgress !== null}
                className="flex items-center gap-2 w-full py-5 shadow-sm hover:shadow transition-shadow bg-blue-600 hover:bg-blue-700"
              >
                {actionInProgress === "start" ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-5 w-5" />
                    <span className="font-medium">Start Scheduler</span>
                  </>
                )}
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={runCheckNow} 
              disabled={actionInProgress !== null}
              className="flex items-center gap-2 w-full py-5 shadow-sm hover:shadow transition-shadow border-gray-300 dark:border-gray-600"
            >
              {actionInProgress === "run" ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5" />
                  <span className="font-medium">Run Check Now</span>
                </>
              )}
            </Button>
          </div>
          
          <Button 
            variant="ghost" 
            onClick={resetStats} 
            disabled={actionInProgress !== null}
            size="sm"
            className="flex items-center gap-2 mx-auto px-6 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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
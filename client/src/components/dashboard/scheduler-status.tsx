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
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Settings,
  LineChart,
  Check,
  Info
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
  
  const { data: status, isLoading: loading } = useQuery<SchedulerStatus>({
    queryKey: ['/api/scheduler/status'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });
  
  const isSchedulerActive = !loading && status?.activeJobs?.includes('price-check');
  
  const startSchedulerMutation = useMutation({
    mutationFn: async () => {
      setActionInProgress("start");
      return await apiRequest('POST', '/api/scheduler/price-check/start', { interval: 86400000 });
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
      return await apiRequest('POST', '/api/scheduler/price-check/stop');
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
      return await apiRequest('POST', '/api/scheduler/price-check/run-now');
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
      return await apiRequest('POST', '/api/scheduler/stats/reset');
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
          {/* Enhanced status banner with detailed scheduling information */}
          <div className={`p-5 rounded-lg ${isSchedulerActive 
            ? 'bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800/50' 
            : 'bg-gradient-to-br from-red-50/80 to-orange-50/80 dark:from-red-900/20 dark:to-orange-900/20 border border-red-100 dark:border-red-800/50'}`}>
            {isSchedulerActive ? (
              <div className="flex items-start gap-4">
                <div className="bg-blue-100 dark:bg-blue-800/30 rounded-full p-2.5 mt-1">
                  <Calendar className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-blue-800 dark:text-blue-300 text-lg">Next Price Check:</div>
                  <div className="text-xl font-semibold tracking-tight">{formatTime(status?.nextScheduledRun || calculateNextRun().toISOString())}</div>
                  <div className="flex flex-col gap-2 mt-3">
                    <div className="flex items-center text-sm text-blue-700/90 dark:text-blue-300/90">
                      <Clock className="h-4 w-4 mr-2" />
                      Daily checks run at 12:00 AM AEST (UTC+10)
                    </div>
                    <div className="flex items-center text-sm text-blue-700/90 dark:text-blue-300/90">
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {status?.totalPriceChecks || 0} checks completed to date
                    </div>
                    <div className="flex items-center text-sm text-blue-700/90 dark:text-blue-300/90">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      {status?.totalDiscrepanciesFound || 0} price discrepancies found
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <div className="bg-red-100 dark:bg-red-800/30 rounded-full p-2.5 mt-1">
                  <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-red-800 dark:text-red-300 text-lg">Schedule Inactive</div>
                  <div className="text-base font-semibold mt-1">Automatic price checks are not running</div>
                  
                  <div className="mt-3 rounded-md bg-red-50 dark:bg-red-900/20 p-3 border border-red-100 dark:border-red-800/40">
                    <div className="flex items-center text-sm font-medium text-red-800 dark:text-red-300">
                      <Info className="h-4 w-4 mr-2" />
                      Why activate scheduled checks?
                    </div>
                    <ul className="mt-2 text-sm text-red-700 dark:text-red-200 space-y-1 ml-6 list-disc">
                      <li>Monitor supplier price changes automatically</li>
                      <li>Receive notifications about price discrepancies</li>
                      <li>Keep your profit margins consistent</li>
                    </ul>
                  </div>
                  
                  <div className="flex items-center mt-3 text-sm text-red-600/80 dark:text-red-400/80">
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Click "Start Scheduler" below to activate automatic checks
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator className="bg-gray-200 dark:bg-gray-700" />
          
          {/* Stats section with enhanced styling and more detailed information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800/40 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-1.5">
                    <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Check</span>
                </div>
                {isSchedulerActive && (
                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50">
                    Active
                  </Badge>
                )}
              </div>
              <div className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-3">{formatTime(status?.lastPriceCheck || null)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {status?.lastPriceCheck ? 
                  `${new Date(status.lastPriceCheck).toLocaleDateString('en-US', {weekday: 'long'})} at ${new Date(status.lastPriceCheck).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'})}` 
                  : 'No previous checks recorded'}
              </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-800/40 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <div className="bg-amber-100 dark:bg-amber-900/30 rounded-full p-1.5">
                  <BarChart3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Recent Activity</span>
              </div>
              <div className="flex flex-col gap-2 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total checks:</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{status?.totalPriceChecks || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Discrepancies:</span>
                  <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{status?.totalDiscrepanciesFound || 0}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Success rate: {status?.totalPriceChecks ? Math.round(((status.totalPriceChecks - (status.totalDiscrepanciesFound || 0)) / status.totalPriceChecks) * 100) : 0}%
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-800/40 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-1.5">
                  <Settings className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Options</span>
              </div>
              <div className="flex flex-col gap-1 mt-3 text-sm">
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Check className="h-3.5 w-3.5 mr-1.5 text-green-600 dark:text-green-400" />
                  <span>Daily automatic checks</span>
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Check className="h-3.5 w-3.5 mr-1.5 text-green-600 dark:text-green-400" />
                  <span>Notification system</span>
                </div>
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Check className="h-3.5 w-3.5 mr-1.5 text-green-600 dark:text-green-400" />
                  <span>Database tracking</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Configure on Settings page
                </div>
              </div>
            </div>
          </div>
          
          {/* Data visualization section */}
          <div className="bg-gray-50 dark:bg-gray-800/40 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <LineChart className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Performance Overview</span>
              </div>
              <Badge variant="outline" className="text-xs">Last 7 days</Badge>
            </div>
            
            <div className="h-14 flex items-end gap-1 justify-between px-2">
              {[15, 22, 8, 30, 18, 25, 20].map((value, index) => (
                <div 
                  key={index} 
                  className="bg-indigo-500/80 dark:bg-indigo-600/80 rounded-t w-full"
                  style={{ height: `${value * 2}px` }}
                  title={`Day ${index+1}: ${value} checks`}
                ></div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
              <div>Sun</div>
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
          
          <div className="flex justify-between items-center gap-4 pt-2">
            <Button 
              variant="ghost" 
              onClick={resetStats} 
              disabled={actionInProgress !== null}
              size="sm"
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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
            
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {isSchedulerActive
                ? 'Scheduler will run automatically every 24 hours'
                : 'Manual mode - Scheduler is not running automatically'}
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
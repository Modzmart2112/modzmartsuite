import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format, formatDistanceToNow } from "date-fns";
import { Loader2, Clock, RefreshCw, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";

export function ShopifySyncStatus() {
  // Fetch scheduler status from API with aggressive refresh
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/scheduler/status"],
    refetchInterval: 5000,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Fetch Shopify connection status with aggressive refresh
  const shopifyConnectionQuery = useQuery({
    queryKey: ["/api/shopify/status"],
    refetchInterval: 5000,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  
  // Fetch sync progress with aggressive refresh - using the scheduler endpoint
  const syncProgressQuery = useQuery({
    queryKey: ["/api/scheduler/shopify-sync-progress"],
    refetchInterval: 2000, // Poll more frequently for sync progress
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Formatted last sync time
  const lastSyncTime = data?.lastShopifySync 
    ? new Date(data.lastShopifySync) 
    : null;

  const formattedLastSync = lastSyncTime
    ? `${formatDistanceToNow(lastSyncTime)} ago (${format(lastSyncTime, "MMM d, yyyy h:mm a")})`
    : "Never";

  // Is Shopify sync job active
  const isShopifySyncActive = data?.activeJobs?.includes("hourly-shopify-sync") || false;
  
  // Sync progress data
  const syncProgress = syncProgressQuery.data;
  const isSyncing = syncProgress && (syncProgress.status === 'pending' || syncProgress.status === 'in-progress');
  
  // Handle percentage calculation more robustly
  let progressPercentage = 0;
  if (syncProgress?.details?.percentage !== undefined) {
    // Get percentage directly from details if available
    progressPercentage = syncProgress.details.percentage;
  } else if (syncProgress?.totalItems && syncProgress?.totalItems > 0 && syncProgress?.processedItems) {
    // Calculate percentage from processed/total if details not available
    progressPercentage = Math.round((syncProgress.processedItems / syncProgress.totalItems) * 100);
  }
  
  // Ensure progress percentage is bounded between 0-100
  progressPercentage = Math.max(0, Math.min(100, progressPercentage));
  
  const progressMessage = syncProgress?.message || 'Initializing...';
  const processedItems = syncProgress?.processedItems || 0;
  const totalItems = syncProgress?.totalItems || 0;
  
  // Debug the sync progress to console
  console.log("Sync progress:", syncProgress);

  // Handle manual sync
  const handleManualSync = async () => {
    try {
      // Use the correct endpoint path
      const response = await fetch("/api/scheduler/run-shopify-sync", {
        method: "POST",
      });
      
      if (response.ok) {
        toast({
          title: "Sync started",
          description: "Shopify product sync has been initiated.",
        });
        
        // Refetch all data after a short delay
        setTimeout(() => {
          refetch();
          syncProgressQuery.refetch();
        }, 1000);
      } else {
        const errorData = await response.json();
        toast({
          title: "Sync failed",
          description: errorData?.message || "Failed to start Shopify sync.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error starting sync:", error);
      toast({
        title: "Error",
        description: "An error occurred while trying to sync with Shopify.",
        variant: "destructive",
      });
    }
  };
  
  // Handle reset for stuck sync
  const handleResetSync = async () => {
    try {
      // Use the reset endpoint
      const response = await fetch("/api/scheduler/reset-shopify-sync", {
        method: "POST",
      });
      
      if (response.ok) {
        toast({
          title: "Sync reset",
          description: "Shopify sync status has been reset.",
        });
        
        // Refetch all data immediately
        refetch();
        syncProgressQuery.refetch();
      } else {
        const errorData = await response.json();
        toast({
          title: "Reset failed",
          description: errorData?.message || "Failed to reset Shopify sync.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error resetting sync:", error);
      toast({
        title: "Error",
        description: "An error occurred while trying to reset the sync status.",
        variant: "destructive",
      });
    }
  };

  // Connection status
  const isConnected = shopifyConnectionQuery.data?.connected || false;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center">
          <RefreshCw className={`h-5 w-5 mr-2 text-blue-500 ${isSyncing ? 'animate-spin' : ''}`} />
          Shopify Sync Status
        </CardTitle>
        <CardDescription>
          Automatic product synchronization with Shopify
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">Connection:</div>
            <div className="flex items-center">
              {shopifyConnectionQuery.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : isConnected ? (
                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-red-500 mr-1"></div>
              )}
              <span className={isConnected ? "text-green-500" : "text-red-500"}>
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">Sync Schedule:</div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1 text-blue-500" />
              <span>{isShopifySyncActive ? "Every hour" : "Not scheduled"}</span>
            </div>
          </div>
          
          {!isSyncing && (
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">Last Sync:</div>
              <div className="text-sm font-medium">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  formattedLastSync
                )}
              </div>
            </div>
          )}
          
          {isSyncing && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-blue-500">Sync in progress</span>
                <span>
                  {processedItems} / {totalItems} products
                  {progressPercentage > 0 && ` (${progressPercentage}%)`}
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{progressMessage}</p>
            </div>
          )}
          
          {isSyncing ? (
            <div className="flex gap-2 mt-2">
              <Button 
                size="sm"
                className="flex-1" 
                variant="outline" 
                onClick={handleResetSync}>
                <XCircle className="h-4 w-4 mr-2 text-red-500" />
                Reset Sync
              </Button>
              <Button 
                size="sm"
                className="flex-1" 
                disabled={true}>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </Button>
            </div>
          ) : (
            <Button 
              size="sm"
              className="w-full mt-2" 
              onClick={handleManualSync}
              disabled={!isConnected}>
              Run Sync Now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}